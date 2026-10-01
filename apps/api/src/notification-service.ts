import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  notificationDeliveries, notificationPreferences, notifications, pushNotifications, users,
} from "@mansamart/database/schema";
import { deliverPushNotification } from "./push";
import { notificationCategory } from "./push-rules";
import { chooseChannels, notificationPriority, safeDedupeKey } from "./notification-rules";
import { sendTransactionalEmail } from "./email";

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  actionRoute?: string;
  data?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
};

function minuteInTimezone(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts();
    return Number(parts.find(part => part.type === "hour")?.value || 0) * 60 + Number(parts.find(part => part.type === "minute")?.value || 0);
  } catch {
    return new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
  }
}

export async function createOrchestratedNotification(input: CreateNotificationInput) {
  const category = notificationCategory(input.type);
  const priority = notificationPriority(input.type);
  const dedupeKey = input.dedupeKey || (input.entityId ? safeDedupeKey([input.userId, input.type, input.entityType, input.entityId, (input.data as any)?.status]) : null);
  const [created] = await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    actionRoute: input.actionRoute,
    category,
    priority,
    dedupeKey: dedupeKey || null,
    entityType: input.entityType,
    entityId: input.entityId,
    icon: category === "delivery" ? "bicycle-outline" : category === "payments" ? "wallet-outline" : "notifications-outline",
    color: category === "delivery" ? "#E8813A" : category === "payments" ? "#0EA47A" : "#2563EB",
  }).onConflictDoNothing().returning();
  if (!created) return null;

  let [preference] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, input.userId)).limit(1);
  if (!preference) [preference] = await db.insert(notificationPreferences).values({ userId: input.userId }).returning();
  const enabled = {
    orders: preference.orders, delivery: preference.delivery, payments: preference.payments,
    bookings: preference.bookings, messages: preference.messages, promotions: preference.promotions,
    security: preference.security, system: true,
    pushEnabled: preference.pushEnabled, emailEnabled: preference.emailEnabled,
    whatsappEnabled: preference.whatsappEnabled,
    whatsappOptedIn: Boolean(preference.whatsappOptInAt && preference.whatsappPhone),
    quietHoursEnabled: preference.quietHoursEnabled,
    quietHoursStart: preference.quietHoursStart, quietHoursEnd: preference.quietHoursEnd,
    unreadEscalationEnabled: preference.unreadEscalationEnabled,
  };
  const channels = chooseChannels(input.type, enabled, minuteInTimezone(preference.timezone));
  await db.insert(notificationDeliveries).values(channels.map(channel => ({
    notificationId: created.id,
    userId: input.userId,
    channel,
    status: channel === "in_app" ? "sent" : "queued",
    sentAt: channel === "in_app" ? new Date() : null,
    metadata: { actionRoute: input.actionRoute, ...input.data },
  }))).onConflictDoNothing();

  if ((category === "messages" || priority === "high") && enabled.whatsappEnabled && enabled.whatsappOptedIn && enabled.unreadEscalationEnabled && !channels.includes("whatsapp")) {
    await db.insert(notificationDeliveries).values({
      notificationId: created.id,
      userId: input.userId,
      channel: "whatsapp",
      status: "queued",
      templateName: category === "messages" ? "mansamart_unread_message" : "mansamart_action_required",
      scheduledAt: new Date(Date.now() + 5 * 60_000),
      metadata: { escalation: true, actionRoute: input.actionRoute, ...input.data },
    }).onConflictDoNothing();
  }

  const [push] = channels.includes("push") ? await db.insert(pushNotifications).values({
    userId: input.userId, title: input.title, body: input.body, category,
    data: { actionRoute: input.actionRoute, type: input.type, notificationId: created.id, ...input.data },
  }).returning() : [];
  if (push?.id) void deliverPushNotification(push.id).catch(() => {});
  void processNotificationDeliveries().catch(() => {});
  return created;
}

async function sendWhatsappTemplate(phone: string, templateName: string, title: string) {
  if (process.env.WHATSAPP_ENABLED !== "true") throw new Error("WhatsApp is disabled");
  const token = process.env.WHATSAPP_SYSTEM_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WhatsApp system sender is not configured");
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace(/\D/g, ""), type: "template", template: { name: templateName, language: { code: "en" }, components: [{ type: "body", parameters: [{ type: "text", text: title.slice(0, 120) }] }] } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`WhatsApp returned ${response.status}`);
  const payload = await response.json() as { messages?: Array<{ id?: string }> };
  return payload.messages?.[0]?.id || null;
}

export async function processNotificationDeliveries() {
  await db.update(notificationDeliveries).set({ status: "queued", lastError: "Recovered interrupted delivery", updatedAt: new Date() })
    .where(and(eq(notificationDeliveries.status, "processing"), lte(notificationDeliveries.updatedAt, new Date(Date.now() - 5 * 60_000))));
  const due = await db.select().from(notificationDeliveries).where(and(
    eq(notificationDeliveries.status, "queued"), lte(notificationDeliveries.scheduledAt, new Date()),
  )).limit(50);
  for (const delivery of due) {
    if (delivery.channel === "push" || delivery.channel === "in_app") continue;
    const [claimed] = await db.update(notificationDeliveries).set({ status: "processing", updatedAt: new Date() })
      .where(and(eq(notificationDeliveries.id, delivery.id), eq(notificationDeliveries.status, "queued"))).returning({ id: notificationDeliveries.id });
    if (!claimed) continue;
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, delivery.notificationId)).limit(1);
    const [user] = await db.select().from(users).where(eq(users.id, delivery.userId)).limit(1);
    const [preference] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, delivery.userId)).limit(1);
    if (!notification || !user || !preference || (delivery.metadata as any)?.escalation && notification.isRead) {
      await db.update(notificationDeliveries).set({ status: "cancelled", lastError: "Notification was read or recipient is unavailable", updatedAt: new Date() }).where(eq(notificationDeliveries.id, delivery.id));
      continue;
    }
    try {
      let providerMessageId: string | null = null;
      if (delivery.channel === "email") await sendTransactionalEmail(user.email, notification.title, notification.body, notification.actionRoute ? `https://mansamart.gm${notification.actionRoute}` : null);
      if (delivery.channel === "whatsapp") {
        if (!preference.whatsappEnabled || !preference.whatsappOptInAt || !preference.whatsappPhone) throw new Error("WhatsApp consent is missing");
        providerMessageId = await sendWhatsappTemplate(preference.whatsappPhone, delivery.templateName || "mansamart_transaction_update", notification.title);
      }
      await db.update(notificationDeliveries).set({ status: "sent", providerMessageId, sentAt: new Date(), attempts: sql`${notificationDeliveries.attempts} + 1`, lastError: null, updatedAt: new Date() }).where(eq(notificationDeliveries.id, delivery.id));
    } catch (error) {
      const attempts = delivery.attempts + 1;
      await db.update(notificationDeliveries).set({
        status: attempts >= 3 ? "failed" : "queued",
        attempts,
        scheduledAt: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000),
        lastError: error instanceof Error ? error.message.slice(0, 500) : "Delivery failed",
        updatedAt: new Date(),
      }).where(eq(notificationDeliveries.id, delivery.id));
    }
  }
}
