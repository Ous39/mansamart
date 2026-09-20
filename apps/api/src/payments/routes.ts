import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { calculateCommission } from "@mansamart/business-logic";
import {
  auditLogs,
  escrowTransactions,
  notifications,
  orderTrackingEvents,
  orders,
  paymentAttempts,
  paymentRefunds,
  paymentWebhookEvents,
} from "@mansamart/database/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth";
import {
  createWaveCheckoutSession,
  getWaveConfig,
  isValidWaveLaunchUrl,
  refundWaveCheckoutSession,
  verifyWaveWebhookSignature,
  WaveApiError,
  WaveConfigurationError,
  waveReadiness,
} from "./wave";

const checkoutRequestSchema = z.object({
  orderId: z.string().uuid(),
  payerMobile: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
});

const waveEventSchema = z.object({
  id: z.string().min(1).max(255),
  type: z.string().min(1).max(255),
  data: z.object({
    id: z.string().min(1).max(255),
    amount: z.string().optional(),
    currency: z.string().optional(),
    client_reference: z.string().nullable().optional(),
    checkout_status: z.string().optional(),
    payment_status: z.string().optional(),
    transaction_id: z.string().nullable().optional(),
    last_payment_error: z.object({
      code: z.string().optional(),
      message: z.string().optional(),
    }).nullable().optional(),
  }).passthrough(),
}).passthrough();

function paymentResponse(payment: typeof paymentAttempts.$inferSelect) {
  return {
    id: payment.id,
    orderId: payment.orderId,
    provider: payment.provider,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    launchUrl: payment.launchUrl,
    expiresAt: payment.expiresAt,
    paidAt: payment.paidAt,
    failureCode: payment.failureCode,
    failureMessage: payment.failureMessage,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

function redirectUrl(base: string, orderId: string, paymentId: string): string {
  const url = new URL(base);
  url.searchParams.set("order_id", orderId);
  url.searchParams.set("payment_id", paymentId);
  return url.toString();
}

function publicWaveError(error: unknown): { status: number; message: string; code: string } {
  if (error instanceof WaveConfigurationError) {
    return { status: 503, message: "Wave payments are not available yet", code: "wave-not-configured" };
  }
  if (error instanceof WaveApiError) {
    const retryable = error.status === 429 || error.status >= 500;
    return {
      status: retryable ? 503 : 502,
      message: retryable ? "Wave is temporarily unavailable. Please try again." : "Wave could not start this payment.",
      code: error.code,
    };
  }
  return { status: 500, message: "Payment service error", code: "payment-service-error" };
}

async function completeWavePayment(event: z.infer<typeof waveEventSchema>) {
  return db.transaction(async (tx) => {
    const [storedEvent] = await tx.insert(paymentWebhookEvents).values({
      provider: "wave",
      eventId: event.id,
      eventType: event.type,
      providerSessionId: event.data.id,
      payload: event as Record<string, unknown>,
      status: "received",
    }).onConflictDoNothing({ target: paymentWebhookEvents.eventId }).returning();

    if (!storedEvent) return { duplicate: true, processed: false };

    const [initialAttempt] = await tx.select().from(paymentAttempts)
      .where(eq(paymentAttempts.providerSessionId, event.data.id))
      .limit(1);
    if (!initialAttempt) {
      await tx.update(paymentWebhookEvents).set({
        status: "ignored",
        failureMessage: "No matching payment attempt",
        processedAt: new Date(),
      }).where(eq(paymentWebhookEvents.id, storedEvent.id));
      return { duplicate: false, processed: false };
    }

    await tx.execute(sql`SELECT id FROM payment_attempts WHERE id = ${initialAttempt.id} FOR UPDATE`);
    const [attempt] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.id, initialAttempt.id)).limit(1);
    if (!attempt) throw new Error("Payment attempt disappeared during webhook processing");

    if (event.type === "checkout.session.completed") {
      const mismatch =
        event.data.payment_status !== "succeeded" ||
        event.data.checkout_status !== "complete" ||
        event.data.client_reference !== attempt.clientReference ||
        event.data.amount !== String(attempt.amount) ||
        event.data.currency !== attempt.currency;

      if (mismatch) {
        await tx.update(paymentWebhookEvents).set({
          status: "rejected",
          failureMessage: "Checkout status, reference, amount, or currency did not match",
          processedAt: new Date(),
        }).where(eq(paymentWebhookEvents.id, storedEvent.id));
        await tx.insert(auditLogs).values({
          action: "payment.wave_webhook_rejected",
          entityType: "payment_attempt",
          entityId: attempt.id,
          metadata: { eventId: event.id },
        });
        return { duplicate: false, processed: false };
      }

      if (attempt.status !== "succeeded") {
        const paidAt = new Date();
        await tx.update(paymentAttempts).set({
          status: "succeeded",
          providerTransactionId: event.data.transaction_id || null,
          providerPayload: event as Record<string, unknown>,
          paidAt,
          failureCode: null,
          failureMessage: null,
          updatedAt: paidAt,
        }).where(eq(paymentAttempts.id, attempt.id));

        const [order] = await tx.select().from(orders).where(eq(orders.id, attempt.orderId)).limit(1);
        if (!order) throw new Error("Order not found for completed Wave payment");
        const commission = calculateCommission(order.subtotal);
        const [existingHold] = await tx.select({ id: escrowTransactions.id }).from(escrowTransactions)
          .where(and(eq(escrowTransactions.orderId, order.id), eq(escrowTransactions.reference, attempt.id)))
          .limit(1);
        if (!existingHold) {
          await tx.insert(escrowTransactions).values({
            orderId: order.id,
            payerId: order.userId,
            amount: order.total,
            productAmount: order.subtotal,
            deliveryFee: order.shipping,
            commissionAmount: commission.commission,
            vendorAmount: commission.sellerAmount,
            riderAmount: order.shipping,
            status: "held",
            method: "wave",
            reference: attempt.id,
          });
        }
        await tx.update(orders).set({
          status: "paid",
          paymentStatus: "paid",
          escrowStatus: "held",
          paymentMethod: "wave",
          updatedAt: paidAt,
        }).where(eq(orders.id, order.id));
        await tx.insert(orderTrackingEvents).values({
          orderId: order.id,
          status: "paid",
          title: "Wave payment received",
          message: "Wave confirmed the payment. The order can now be processed.",
          metadata: { paymentAttemptId: attempt.id, waveTransactionId: event.data.transaction_id || null },
        });
        if (order.userId) {
          await tx.insert(notifications).values({
            userId: order.userId,
            type: "payment",
            title: "Payment received",
            body: `Wave payment for order #${order.id.slice(0, 8).toUpperCase()} was confirmed.`,
            icon: "wallet-outline",
            color: "#0EA47A",
            actionRoute: `/order/${order.id}`,
          });
        }
        await tx.insert(auditLogs).values({
          actorId: order.userId,
          action: "payment.wave_succeeded",
          entityType: "payment_attempt",
          entityId: attempt.id,
          metadata: { eventId: event.id, orderId: order.id, transactionId: event.data.transaction_id || null },
        });
      }
      await tx.update(paymentWebhookEvents).set({ status: "processed", processedAt: new Date() })
        .where(eq(paymentWebhookEvents.id, storedEvent.id));
      return { duplicate: false, processed: true };
    }

    if (event.type === "checkout.session.payment_failed") {
      if (attempt.status !== "succeeded" && attempt.status !== "refunded") {
        await tx.update(paymentAttempts).set({
          status: "failed",
          failureCode: event.data.last_payment_error?.code || "wave-payment-failed",
          failureMessage: event.data.last_payment_error?.message || "Wave payment failed",
          providerPayload: event as Record<string, unknown>,
          updatedAt: new Date(),
        }).where(eq(paymentAttempts.id, attempt.id));
        await tx.update(orders).set({ paymentStatus: "failed", updatedAt: new Date() })
          .where(eq(orders.id, attempt.orderId));
      }
      await tx.update(paymentWebhookEvents).set({ status: "processed", processedAt: new Date() })
        .where(eq(paymentWebhookEvents.id, storedEvent.id));
      return { duplicate: false, processed: true };
    }

    await tx.update(paymentWebhookEvents).set({ status: "ignored", processedAt: new Date() })
      .where(eq(paymentWebhookEvents.id, storedEvent.id));
    return { duplicate: false, processed: false };
  });
}

export function registerPaymentRoutes(app: Express) {
  app.get("/api/payments/config", (_req: Request, res: Response) => {
    const readiness = waveReadiness();
    return res.json({
      wave: readiness,
      commercialCurrency: "GMD",
    });
  });

  app.post("/api/payments/wave/checkout", requireAuth, requireRole("user"), async (req: Request, res: Response) => {
    let attemptId: string | undefined;
    try {
      const config = getWaveConfig();
      const user = (req as any).user;
      const input = checkoutRequestSchema.parse(req.body);
      const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.userId !== user.id) return res.status(403).json({ message: "Forbidden" });
      if (order.paymentStatus === "paid" || order.status === "paid") {
        return res.status(409).json({ message: "This order is already paid" });
      }
      if (order.total <= 0) return res.status(400).json({ message: "Order total must be greater than zero" });

      const [existing] = await db.select().from(paymentAttempts)
        .where(and(eq(paymentAttempts.orderId, order.id), eq(paymentAttempts.provider, "wave")))
        .orderBy(desc(paymentAttempts.createdAt))
        .limit(1);
      if (existing?.launchUrl && ["pending", "processing"].includes(existing.status) && (!existing.expiresAt || existing.expiresAt > new Date())) {
        return res.json(paymentResponse(existing));
      }

      const clientReference = `order:${order.id}:attempt:${crypto.randomUUID()}`;
      const [attempt] = await db.insert(paymentAttempts).values({
        orderId: order.id,
        userId: user.id,
        provider: "wave",
        status: "pending",
        amount: order.total,
        currency: config.currency,
        clientReference,
      }).returning();
      attemptId = attempt.id;

      const session = await createWaveCheckoutSession(config, {
        amount: String(attempt.amount),
        currency: attempt.currency,
        client_reference: attempt.clientReference,
        success_url: redirectUrl(config.successUrl, order.id, attempt.id),
        error_url: redirectUrl(config.errorUrl, order.id, attempt.id),
        ...(input.payerMobile ? { restrict_payer_mobile: input.payerMobile } : {}),
      });

      if (!session.id || !isValidWaveLaunchUrl(session.wave_launch_url) || session.amount !== String(attempt.amount) || session.currency !== attempt.currency || session.client_reference !== attempt.clientReference) {
        throw new WaveApiError(502, "wave-response-mismatch", "Wave returned checkout details that did not match the order");
      }

      const parsedExpiry = session.when_expires ? new Date(session.when_expires) : new Date(Date.now() + 30 * 60_000);
      const expiresAt = Number.isNaN(parsedExpiry.getTime()) ? new Date(Date.now() + 30 * 60_000) : parsedExpiry;

      const [updated] = await db.update(paymentAttempts).set({
        status: "processing",
        providerSessionId: session.id,
        launchUrl: session.wave_launch_url,
        providerPayload: session as unknown as Record<string, unknown>,
        expiresAt,
        updatedAt: new Date(),
      }).where(eq(paymentAttempts.id, attempt.id)).returning();
      await db.update(orders).set({ paymentMethod: "wave", paymentStatus: "processing", updatedAt: new Date() })
        .where(eq(orders.id, order.id));
      await db.insert(auditLogs).values({
        actorId: user.id,
        action: "payment.wave_checkout_created",
        entityType: "payment_attempt",
        entityId: attempt.id,
        metadata: { orderId: order.id, providerSessionId: session.id },
      });
      return res.status(201).json(paymentResponse(updated));
    } catch (error) {
      const publicError = publicWaveError(error);
      if (attemptId) {
        await db.update(paymentAttempts).set({
          status: "failed",
          failureCode: publicError.code,
          failureMessage: publicError.message,
          updatedAt: new Date(),
        }).where(eq(paymentAttempts.id, attemptId)).catch(() => undefined);
      }
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || "Invalid checkout request" });
      console.error("Wave checkout error:", publicError.code);
      return res.status(publicError.status).json({ message: publicError.message, code: publicError.code });
    }
  });

  app.get("/api/payments/:id", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [payment] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, req.params.id as string)).limit(1);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (user.role !== "admin" && payment.userId !== user.id) return res.status(403).json({ message: "Forbidden" });
    return res.json(paymentResponse(payment));
  });

  app.get("/api/admin/payments", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(paymentAttempts).orderBy(desc(paymentAttempts.createdAt)).limit(250);
    return res.json(rows.map(paymentResponse));
  });

  app.post("/api/webhooks/wave", async (req: Request, res: Response) => {
    const webhookSecret = process.env.WAVE_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(503).json({ message: "Webhook is not configured" });
    if (!Buffer.isBuffer(req.rawBody)) return res.status(400).json({ message: "Raw webhook body is required" });
    const rawBody = req.rawBody;
    if (!verifyWaveWebhookSignature(rawBody, req.header("Wave-Signature"), webhookSecret)) {
      return res.status(401).json({ message: "Invalid Wave signature" });
    }

    try {
      const event = waveEventSchema.parse(req.body);
      const result = await completeWavePayment(event);
      return res.status(200).json({ received: true, ...result });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid Wave event" });
      console.error("Wave webhook processing failed", error);
      return res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  app.post("/api/admin/payments/:id/refund", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
    let refundId: string | undefined;
    try {
      const config = getWaveConfig();
      const admin = (req as any).user;
      const { reason } = z.object({ reason: z.string().trim().min(5).max(500) }).parse(req.body);
      const paymentId = req.params.id as string;
      const [payment] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, paymentId)).limit(1);
      if (!payment) return res.status(404).json({ message: "Payment not found" });
      if (payment.status === "refunded") {
        const [existing] = await db.select().from(paymentRefunds)
          .where(and(eq(paymentRefunds.paymentAttemptId, payment.id), eq(paymentRefunds.status, "succeeded")))
          .limit(1);
        return res.json(existing || { status: "succeeded" });
      }
      if (payment.status !== "succeeded" || !payment.providerSessionId) {
        return res.status(409).json({ message: "Only a successful Wave payment can be refunded" });
      }

      const [refund] = await db.insert(paymentRefunds).values({
        paymentAttemptId: payment.id,
        orderId: payment.orderId,
        requestedBy: admin.id,
        provider: "wave",
        amount: payment.amount,
        currency: payment.currency,
        status: "pending",
        reason,
      }).returning();
      refundId = refund.id;
      await refundWaveCheckoutSession(config, payment.providerSessionId);

      const completedAt = new Date();
      const result = await db.transaction(async (tx) => {
        const [updatedRefund] = await tx.update(paymentRefunds).set({
          status: "succeeded",
          completedAt,
          updatedAt: completedAt,
        }).where(eq(paymentRefunds.id, refund.id)).returning();
        await tx.update(paymentAttempts).set({ status: "refunded", updatedAt: completedAt })
          .where(eq(paymentAttempts.id, payment.id));
        await tx.update(orders).set({
          status: "refunded",
          paymentStatus: "refunded",
          escrowStatus: "refunded",
          updatedAt: completedAt,
        }).where(eq(orders.id, payment.orderId));
        await tx.insert(orderTrackingEvents).values({
          orderId: payment.orderId,
          actorId: admin.id,
          actorRole: "admin",
          status: "refunded",
          title: "Payment refunded",
          message: "The Wave payment was refunded by an administrator.",
          metadata: { paymentAttemptId: payment.id, refundId: refund.id, reason },
        });
        await tx.insert(auditLogs).values({
          actorId: admin.id,
          action: "payment.wave_refunded",
          entityType: "payment_attempt",
          entityId: payment.id,
          metadata: { orderId: payment.orderId, refundId: refund.id, reason },
        });
        return updatedRefund;
      });
      return res.json(result);
    } catch (error) {
      const publicError = publicWaveError(error);
      if (refundId) {
        await db.update(paymentRefunds).set({
          status: "failed",
          failureCode: publicError.code,
          failureMessage: publicError.message,
          updatedAt: new Date(),
        }).where(eq(paymentRefunds.id, refundId)).catch(() => undefined);
      }
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message || "Invalid refund request" });
      console.error("Wave refund error:", publicError.code);
      return res.status(publicError.status).json({ message: publicError.message, code: publicError.code });
    }
  });
}
