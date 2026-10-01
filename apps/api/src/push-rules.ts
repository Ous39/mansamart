export type NotificationCategory = "orders" | "delivery" | "payments" | "bookings" | "messages" | "promotions" | "security" | "system";

export function notificationCategory(type: string): NotificationCategory {
  const value = type.toLowerCase();
  if (value.includes("delivery") || value.includes("rider")) return "delivery";
  if (value.includes("payment") || value.includes("refund") || value.includes("payout")) return "payments";
  if (value.includes("booking") || value.includes("service")) return "bookings";
  if (value.includes("message") || value.includes("support")) return "messages";
  if (value.includes("promo") || value.includes("deal") || value.includes("coupon")) return "promotions";
  if (value.includes("security") || value.includes("login") || value.includes("password")) return "security";
  if (value.includes("order")) return "orders";
  return "system";
}

export function isExpoPushToken(value: string): boolean {
  return /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(value);
}

