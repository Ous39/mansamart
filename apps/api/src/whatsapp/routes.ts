import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  aiTokenAccounts,
  products,
  whatsappCampaigns,
  whatsappCarts,
  whatsappConnections,
  whatsappCustomers,
  whatsappMessages,
  whatsappThreads,
  whatsappWebhookEvents,
} from "@mansamart/database/schema";
import { db } from "../db";
import { requireAuth, requireRole } from "../auth";

function currentUser(req: Request) {
  return (req as any).user as { id: string; role: string; name: string };
}

function whatsappEnabled() {
  return process.env.WHATSAPP_ENABLED === "true";
}

function safeConnection(connection: typeof whatsappConnections.$inferSelect | undefined) {
  if (!connection) return null;
  return {
    id: connection.id,
    businessPhone: connection.businessPhone,
    displayName: connection.displayName,
    wabaId: connection.wabaId,
    phoneNumberId: connection.phoneNumberId,
    status: connection.status,
    aiEnabled: connection.aiEnabled,
    humanHandoffEnabled: connection.humanHandoffEnabled,
    catalogSyncEnabled: connection.catalogSyncEnabled,
    welcomeMessage: connection.welcomeMessage,
    fallbackMessage: connection.fallbackMessage,
    connectedAt: connection.connectedAt,
    lastWebhookAt: connection.lastWebhookAt,
  };
}

function signatureMatches(req: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const signature = req.header("x-hub-signature-256");
  const rawBody = req.rawBody;
  if (!appSecret || !signature || !Buffer.isBuffer(rawBody)) return false;
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function webhookValue(body: any) {
  return body?.entry?.[0]?.changes?.[0]?.value ?? null;
}

async function recordIncomingMessage(body: any) {
  const value = webhookValue(body);
  const phoneNumberId = value?.metadata?.phone_number_id;
  const incoming = value?.messages?.[0];
  if (!phoneNumberId || !incoming?.from || !incoming?.id) return;

  const [connection] = await db.select().from(whatsappConnections)
    .where(eq(whatsappConnections.phoneNumberId, String(phoneNumberId))).limit(1);
  if (!connection) return;

  const profileName = value?.contacts?.[0]?.profile?.name || incoming.from;
  await db.insert(whatsappCustomers).values({
    vendorId: connection.vendorId,
    phone: String(incoming.from),
    displayName: String(profileName),
    lastMessageAt: new Date(),
  }).onConflictDoUpdate({
    target: [whatsappCustomers.vendorId, whatsappCustomers.phone],
    set: { displayName: String(profileName), lastMessageAt: new Date(), updatedAt: new Date() },
  });

  const [customer] = await db.select().from(whatsappCustomers).where(and(
    eq(whatsappCustomers.vendorId, connection.vendorId),
    eq(whatsappCustomers.phone, String(incoming.from)),
  )).limit(1);
  if (!customer) return;

  await db.insert(whatsappThreads).values({
    vendorId: connection.vendorId,
    customerId: customer.id,
    unreadCount: 1,
    lastMessagePreview: incoming.text?.body || `[${incoming.type || "message"}]`,
    lastMessageAt: new Date(),
  }).onConflictDoUpdate({
    target: [whatsappThreads.vendorId, whatsappThreads.customerId],
    set: {
      unreadCount: sql`${whatsappThreads.unreadCount} + 1`,
      lastMessagePreview: incoming.text?.body || `[${incoming.type || "message"}]`,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const [thread] = await db.select().from(whatsappThreads).where(and(
    eq(whatsappThreads.vendorId, connection.vendorId),
    eq(whatsappThreads.customerId, customer.id),
  )).limit(1);
  if (!thread) return;

  await db.insert(whatsappMessages).values({
    threadId: thread.id,
    providerMessageId: String(incoming.id),
    direction: "inbound",
    type: String(incoming.type || "text"),
    body: incoming.text?.body || null,
    deliveryStatus: "received",
    metadata: incoming,
  }).onConflictDoNothing();

  await db.update(whatsappConnections).set({ lastWebhookAt: new Date(), updatedAt: new Date() })
    .where(eq(whatsappConnections.id, connection.id));
}

export function registerWhatsappRoutes(app: Express) {
  app.get("/api/vendor/whatsapp/overview", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    const vendorId = currentUser(req).id;
    await db.insert(aiTokenAccounts).values({ vendorId }).onConflictDoNothing();
    const [tokenAccount] = await db.select().from(aiTokenAccounts).where(eq(aiTokenAccounts.vendorId, vendorId)).limit(1);

    const [connection, vendorProducts, customers, threads, carts, campaigns] = await Promise.all([
      db.select().from(whatsappConnections).where(eq(whatsappConnections.vendorId, vendorId)).limit(1),
      db.select().from(products).where(eq(products.vendorId, vendorId)),
      db.select().from(whatsappCustomers).where(eq(whatsappCustomers.vendorId, vendorId)),
      db.select().from(whatsappThreads).where(eq(whatsappThreads.vendorId, vendorId)).orderBy(desc(whatsappThreads.lastMessageAt)),
      db.select().from(whatsappCarts).where(eq(whatsappCarts.vendorId, vendorId)).orderBy(desc(whatsappCarts.updatedAt)),
      db.select().from(whatsappCampaigns).where(eq(whatsappCampaigns.vendorId, vendorId)).orderBy(desc(whatsappCampaigns.createdAt)),
    ]);

    const customersById = new Map(customers.map((customer) => [customer.id, customer]));
    const recentConversations = threads.slice(0, 8).map((thread) => ({
      ...thread,
      customer: customersById.get(thread.customerId) || null,
    }));
    const checkedOut = carts.filter((cart) => cart.status === "converted");

    return res.json({
      connection: safeConnection(connection[0]),
      tokens: tokenAccount,
      stats: {
        products: vendorProducts.filter((product) => product.inStock && product.stock > 0).length,
        customers: customers.length,
        conversations: threads.length,
        unread: threads.reduce((sum, thread) => sum + thread.unreadCount, 0),
        activeCarts: carts.filter((cart) => cart.status === "active").length,
        whatsappOrders: checkedOut.length,
        whatsappRevenue: checkedOut.reduce((sum, cart) => sum + cart.total, 0),
      },
      recentConversations,
      campaigns: campaigns.slice(0, 6),
    });
  });

  app.post("/api/vendor/whatsapp/connect", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    const vendorId = currentUser(req).id;
    const input = z.object({
      businessPhone: z.string().trim().min(7).max(20),
      displayName: z.string().trim().min(2).max(80),
      wabaId: z.string().trim().max(80).optional(),
      phoneNumberId: z.string().trim().max(80).optional(),
    }).parse(req.body);

    const [connection] = await db.insert(whatsappConnections).values({
      vendorId,
      ...input,
      status: input.phoneNumberId ? "pending_verification" : "pending",
    }).onConflictDoUpdate({
      target: whatsappConnections.vendorId,
      set: { ...input, status: input.phoneNumberId ? "pending_verification" : "pending", updatedAt: new Date() },
    }).returning();
    await db.insert(aiTokenAccounts).values({ vendorId }).onConflictDoNothing();
    return res.status(201).json({ connection: safeConnection(connection), message: "WhatsApp setup saved for verification." });
  });

  app.patch("/api/vendor/whatsapp/settings", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    const vendorId = currentUser(req).id;
    const input = z.object({
      aiEnabled: z.boolean().optional(),
      humanHandoffEnabled: z.boolean().optional(),
      catalogSyncEnabled: z.boolean().optional(),
      welcomeMessage: z.string().trim().min(1).max(500).optional(),
      fallbackMessage: z.string().trim().min(1).max(500).optional(),
    }).parse(req.body);
    const [connection] = await db.update(whatsappConnections).set({ ...input, updatedAt: new Date() })
      .where(eq(whatsappConnections.vendorId, vendorId)).returning();
    if (!connection) return res.status(404).json({ message: "Connect WhatsApp before changing these settings." });
    return res.json({ connection: safeConnection(connection) });
  });

  app.get("/api/vendor/whatsapp/conversations", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    const vendorId = currentUser(req).id;
    const threads = await db.select().from(whatsappThreads).where(eq(whatsappThreads.vendorId, vendorId)).orderBy(desc(whatsappThreads.lastMessageAt));
    const result = await Promise.all(threads.map(async (thread) => {
      const [customer] = await db.select().from(whatsappCustomers).where(eq(whatsappCustomers.id, thread.customerId)).limit(1);
      return { ...thread, customer };
    }));
    return res.json(result);
  });

  app.get("/api/vendor/whatsapp/conversations/:id/messages", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    const vendorId = currentUser(req).id;
    const [thread] = await db.select().from(whatsappThreads).where(and(
      eq(whatsappThreads.id, String(req.params.id)),
      eq(whatsappThreads.vendorId, vendorId),
    )).limit(1);
    if (!thread) return res.status(404).json({ message: "Conversation not found" });
    const rows = await db.select().from(whatsappMessages).where(eq(whatsappMessages.threadId, thread.id)).orderBy(desc(whatsappMessages.createdAt));
    await db.update(whatsappThreads).set({ unreadCount: 0, updatedAt: new Date() }).where(eq(whatsappThreads.id, thread.id));
    return res.json(rows.reverse());
  });

  app.get("/api/vendor/whatsapp/campaigns", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    const rows = await db.select().from(whatsappCampaigns).where(eq(whatsappCampaigns.vendorId, currentUser(req).id)).orderBy(desc(whatsappCampaigns.createdAt));
    return res.json(rows);
  });

  app.post("/api/vendor/whatsapp/campaigns", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    const input = z.object({
      name: z.string().trim().min(2).max(100),
      message: z.string().trim().min(2).max(1024),
      templateName: z.string().trim().max(100).optional(),
      tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    }).parse(req.body);
    const vendorId = currentUser(req).id;
    const optedIn = await db.select().from(whatsappCustomers).where(and(
      eq(whatsappCustomers.vendorId, vendorId),
      eq(whatsappCustomers.optInStatus, "opted_in"),
    ));
    const [campaign] = await db.insert(whatsappCampaigns).values({
      vendorId,
      name: input.name,
      message: input.message,
      templateName: input.templateName,
      audience: { tags: input.tags || [], optInOnly: true },
      recipientCount: optedIn.length,
    }).returning();
    return res.status(201).json(campaign);
  });

  app.post("/api/vendor/whatsapp/assistant/preview", requireAuth, requireRole("vendor"), async (req: Request, res: Response) => {
    const { question } = z.object({ question: z.string().trim().min(2).max(500) }).parse(req.body);
    const vendorId = currentUser(req).id;
    const catalog = await db.select().from(products).where(and(eq(products.vendorId, vendorId), eq(products.inStock, true)));
    const terms = question.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
    const matches = catalog.filter((product) => {
      const haystack = `${product.name} ${product.brand} ${product.category} ${product.description || ""}`.toLowerCase();
      return terms.some((term) => haystack.includes(term));
    }).slice(0, 3);
    const reply = matches.length
      ? `Yes, we have ${matches.map((product) => `${product.name} for D ${product.price.toLocaleString()}`).join(", ")}. Which one would you like to add to your cart?`
      : `I could not find an exact match in the current catalogue. Would you like a shop team member to help you?`;
    return res.json({ reply, products: matches.map(({ id, name, price, stock, images }) => ({ id, name, price, stock, images })), mode: "catalog-preview" });
  });

  app.get("/api/webhooks/whatsapp", (req: Request, res: Response) => {
    if (!whatsappEnabled()) return res.sendStatus(503);
    const mode = String(req.query["hub.mode"] || "");
    const token = String(req.query["hub.verify_token"] || "");
    const challenge = String(req.query["hub.challenge"] || "");
    if (mode === "subscribe" && process.env.WHATSAPP_VERIFY_TOKEN && token === process.env.WHATSAPP_VERIFY_TOKEN) return res.status(200).send(challenge);
    return res.sendStatus(403);
  });

  app.post("/api/webhooks/whatsapp", async (req: Request, res: Response) => {
    if (!whatsappEnabled()) return res.sendStatus(503);
    if (!signatureMatches(req)) return res.status(401).json({ message: "Invalid WhatsApp signature" });
    const value = webhookValue(req.body);
    const providerMessageId = value?.messages?.[0]?.id || value?.statuses?.[0]?.id;
    const raw = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body));
    const eventType = value?.messages?.length ? "message" : value?.statuses?.length ? "status" : "unknown";
    const providerStatus = value?.statuses?.[0]?.status || "received";
    const eventId = providerMessageId
      ? `${eventType}:${providerMessageId}:${providerStatus}`
      : crypto.createHash("sha256").update(raw).digest("hex");
    await db.insert(whatsappWebhookEvents).values({
      eventId: String(eventId),
      phoneNumberId: value?.metadata?.phone_number_id ? String(value.metadata.phone_number_id) : null,
      eventType,
      payload: req.body,
    }).onConflictDoNothing();
    try {
      await recordIncomingMessage(req.body);
      await db.update(whatsappWebhookEvents).set({ status: "processed", processedAt: new Date() })
        .where(eq(whatsappWebhookEvents.eventId, String(eventId)));
    } catch (error) {
      await db.update(whatsappWebhookEvents).set({ status: "failed", failureMessage: error instanceof Error ? error.message : "Unknown error" })
        .where(eq(whatsappWebhookEvents.eventId, String(eventId)));
      console.error("WhatsApp webhook processing failed", error);
    }
    return res.sendStatus(200);
  });

  app.get("/api/admin/whatsapp", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    const [connections, customers, threads, campaigns] = await Promise.all([
      db.select().from(whatsappConnections).orderBy(desc(whatsappConnections.createdAt)),
      db.select().from(whatsappCustomers),
      db.select().from(whatsappThreads),
      db.select().from(whatsappCampaigns),
    ]);
    return res.json({
      connections: connections.map(safeConnection),
      stats: {
        connectedStores: connections.filter((row) => row.status === "connected").length,
        pendingStores: connections.filter((row) => row.status.startsWith("pending")).length,
        customers: customers.length,
        conversations: threads.length,
        campaigns: campaigns.length,
      },
    });
  });
}
