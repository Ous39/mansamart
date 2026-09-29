import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { notificationPreferences, pushDevices, pushNotifications } from "@mansamart/database/schema";
import type { NotificationCategory } from "./push-rules";

export async function pushAllowed(userId: string, category: NotificationCategory): Promise<boolean> {
  if (category === "system") return true;
  const [preference] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
  if (!preference) return category !== "promotions";
  return Boolean(preference[category as keyof typeof preference]);
}

export async function deliverPushNotification(notificationId: string): Promise<void> {
  const [notification] = await db.select().from(pushNotifications).where(eq(pushNotifications.id, notificationId)).limit(1);
  if (!notification || notification.status !== "queued" || !notification.userId) return;
  const devices = await db.select().from(pushDevices).where(and(eq(pushDevices.userId, notification.userId), eq(pushDevices.enabled, true)));
  if (devices.length === 0) {
    await db.update(pushNotifications).set({ status: "skipped", lastError: "No enabled push devices" }).where(eq(pushNotifications.id, notification.id));
    return;
  }

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(devices.map(device => ({
        to: device.expoPushToken,
        sound: "default",
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
      }))),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Expo push service returned ${response.status}`);
    const payload = await response.json() as { data?: Array<{ status?: string; id?: string; message?: string }> };
    const tickets = Array.isArray(payload.data) ? payload.data : [];
    const accepted = tickets.find(ticket => ticket.status === "ok");
    if (!accepted) throw new Error(tickets[0]?.message || "Expo push service did not accept the notification");
    await db.update(pushNotifications).set({
      status: "sent",
      receiptId: accepted.id || null,
      sentAt: new Date(),
      attempts: sql`${pushNotifications.attempts} + 1`,
      lastError: null,
    }).where(eq(pushNotifications.id, notification.id));
  } catch (error) {
    await db.update(pushNotifications).set({
      status: "failed",
      attempts: sql`${pushNotifications.attempts} + 1`,
      lastError: error instanceof Error ? error.message.slice(0, 500) : "Push delivery failed",
    }).where(eq(pushNotifications.id, notification.id));
  }
}
