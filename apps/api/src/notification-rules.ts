import { notificationCategory, type NotificationCategory } from "./push-rules";

export type NotificationPriority = "low" | "normal" | "high" | "critical";
export type NotificationChannel = "in_app" | "push" | "email" | "whatsapp";

export type ChannelPreferences = Record<NotificationCategory, boolean> & {
  pushEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  whatsappOptedIn: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  unreadEscalationEnabled: boolean;
};

const CRITICAL_TYPES = new Set(["security", "payment_failed", "payment_refund", "delivery_arriving", "order_cancelled"]);
const HIGH_TYPES = new Set(["new_order", "new_booking", "new_message", "delivery_offer", "rider_assigned", "payment_succeeded"]);

export function notificationPriority(type: string): NotificationPriority {
  const normalized = type.toLowerCase();
  if (CRITICAL_TYPES.has(normalized) || normalized.includes("security")) return "critical";
  if (HIGH_TYPES.has(normalized) || normalized.includes("new_order")) return "high";
  if (notificationCategory(normalized) === "promotions") return "low";
  return "normal";
}

export function isWithinQuietHours(nowMinutes: number, start: string, end: string): boolean {
  const parse = (value: string) => {
    const [hour = 0, minute = 0] = value.split(":").map(Number);
    return Math.max(0, Math.min(1439, hour * 60 + minute));
  };
  const from = parse(start);
  const to = parse(end);
  return from === to ? false : from < to ? nowMinutes >= from && nowMinutes < to : nowMinutes >= from || nowMinutes < to;
}

export function chooseChannels(type: string, preferences: ChannelPreferences, nowMinutes: number): NotificationChannel[] {
  const category = notificationCategory(type);
  const priority = notificationPriority(type);
  const channels: NotificationChannel[] = ["in_app"];
  if (!preferences[category] && priority !== "critical") return channels;
  const quiet = preferences.quietHoursEnabled && isWithinQuietHours(nowMinutes, preferences.quietHoursStart, preferences.quietHoursEnd);
  if (preferences.pushEnabled && (!quiet || priority === "critical")) channels.push("push");
  if (preferences.emailEnabled && (priority === "critical" || category === "payments")) channels.push("email");
  if (preferences.whatsappEnabled && preferences.whatsappOptedIn && priority === "critical") channels.push("whatsapp");
  return channels;
}

export function shouldEscalateUnread(input: {
  unread: boolean;
  category: NotificationCategory;
  priority: NotificationPriority;
  escalationEnabled: boolean;
  whatsappOptedIn: boolean;
  ageMs: number;
}) {
  return input.unread
    && input.escalationEnabled
    && input.whatsappOptedIn
    && input.ageMs >= 5 * 60_000
    && (input.category === "messages" || input.priority === "high" || input.priority === "critical");
}

export function safeDedupeKey(parts: Array<string | number | null | undefined>) {
  return parts.filter(part => part !== null && part !== undefined && String(part).trim()).map(String).join(":").slice(0, 240);
}
