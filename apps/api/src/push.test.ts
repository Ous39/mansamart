import assert from "node:assert/strict";
import test from "node:test";
import { isExpoPushToken, notificationCategory } from "./push-rules";

test("validates Expo push token format", () => {
  assert.equal(isExpoPushToken("ExponentPushToken[abc_DEF-123]"), true);
  assert.equal(isExpoPushToken("ExpoPushToken[abc123]"), true);
  assert.equal(isExpoPushToken("https://example.com/token"), false);
});

test("maps notification types to user-controlled categories", () => {
  assert.equal(notificationCategory("order_confirmed"), "orders");
  assert.equal(notificationCategory("delivery_assigned"), "delivery");
  assert.equal(notificationCategory("payment_refund"), "payments");
  assert.equal(notificationCategory("support_message"), "messages");
  assert.equal(notificationCategory("flash_deal"), "promotions");
  assert.equal(notificationCategory("password_changed"), "security");
});
