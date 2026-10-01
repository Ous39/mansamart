import assert from "node:assert/strict";
import test from "node:test";
import { chooseChannels, isWithinQuietHours, notificationPriority, safeDedupeKey, shouldEscalateUnread } from "./notification-rules";

const preferences = {
  orders: true, delivery: true, payments: true, bookings: true, messages: true,
  promotions: false, security: true, system: true, pushEnabled: true, emailEnabled: true,
  whatsappEnabled: true, whatsappOptedIn: true, quietHoursEnabled: true,
  quietHoursStart: "22:00", quietHoursEnd: "07:00", unreadEscalationEnabled: true,
};

test("quiet hours work across midnight", () => {
  assert.equal(isWithinQuietHours(23 * 60, "22:00", "07:00"), true);
  assert.equal(isWithinQuietHours(6 * 60, "22:00", "07:00"), true);
  assert.equal(isWithinQuietHours(12 * 60, "22:00", "07:00"), false);
});

test("critical alerts bypass quiet hours while promotions remain opt-in", () => {
  assert.deepEqual(chooseChannels("security", preferences, 23 * 60), ["in_app", "push", "email", "whatsapp"]);
  assert.deepEqual(chooseChannels("flash_deal", preferences, 12 * 60), ["in_app"]);
  assert.equal(notificationPriority("new_order"), "high");
});

test("unread seller messages escalate only after five minutes and opt-in", () => {
  const base = { unread: true, category: "messages" as const, priority: "high" as const, escalationEnabled: true, whatsappOptedIn: true };
  assert.equal(shouldEscalateUnread({ ...base, ageMs: 299_999 }), false);
  assert.equal(shouldEscalateUnread({ ...base, ageMs: 300_000 }), true);
  assert.equal(shouldEscalateUnread({ ...base, whatsappOptedIn: false, ageMs: 600_000 }), false);
});

test("dedupe keys are deterministic and bounded", () => {
  assert.equal(safeDedupeKey(["order", "123", "paid"]), "order:123:paid");
  assert.ok(safeDedupeKey(["x".repeat(300)]).length <= 240);
});
