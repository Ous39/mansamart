import assert from "node:assert/strict";
import test from "node:test";
import {
  canChangeDeliveryStatus,
  canRiderAccessDelivery,
  canReleaseDeliveryPayment,
  canVerifyOrderQr,
  isDeliveryOfferAcceptable,
  resolveRiderPresence,
} from "./rider-rules";

test("expired or previously answered delivery offers cannot be accepted", () => {
  const now = new Date("2026-09-09T12:00:00Z");
  assert.equal(isDeliveryOfferAcceptable({ status: "offered", expiresAt: "2026-09-09T12:01:00Z" }, now), true);
  assert.equal(isDeliveryOfferAcceptable({ status: "offered", expiresAt: "2026-09-09T11:59:59Z" }, now), false);
  assert.equal(isDeliveryOfferAcceptable({ status: "accepted", expiresAt: "2026-09-09T12:01:00Z" }, now), false);
});

test("only verified riders can become available and offline always clears availability", () => {
  assert.deepEqual(resolveRiderPresence({ verificationStatus: "pending", currentOnline: false, requestedOnline: true }), {
    ok: false,
    message: "Your rider profile must be verified before you can go online.",
  });
  assert.deepEqual(resolveRiderPresence({ verificationStatus: "verified", currentOnline: true, requestedOnline: false, requestedAvailable: true }), {
    ok: true,
    presence: { isOnline: false, isAvailable: false },
  });
  assert.deepEqual(resolveRiderPresence({ verificationStatus: "verified", currentOnline: true, requestedAvailable: true, hasActiveDelivery: true }), {
    ok: true,
    presence: { isOnline: true, isAvailable: false },
  });
});

test("location sharing is limited to the assigned rider's active delivery", () => {
  assert.equal(canRiderAccessDelivery("rider-1", { riderId: "rider-1", status: "in_transit" }), true);
  assert.equal(canRiderAccessDelivery("rider-1", { riderId: "rider-2", status: "in_transit" }), false);
  assert.equal(canRiderAccessDelivery("rider-1", { riderId: "rider-1", status: "delivered" }), false);
});

test("pickup and delivery cannot bypass their QR checkpoints", () => {
  assert.equal(canChangeDeliveryStatus("delivery_rider", "assigned", "picked_up"), false);
  assert.equal(canChangeDeliveryStatus("delivery_rider", "picked_up", "in_transit"), true);
  assert.equal(canChangeDeliveryStatus("delivery_rider", "in_transit", "delivered"), false);
  assert.equal(canChangeDeliveryStatus("delivery_rider", "in_transit", "failed"), true);
});

test("QR verification allows only order parties and the assigned rider", () => {
  const base = { actorRole: "delivery_rider", purpose: "pickup", orderUserId: "customer", orderRiderId: "rider-1", vendorIds: ["vendor-1"] };
  assert.equal(canVerifyOrderQr({ ...base, actorId: "rider-1" }), true);
  assert.equal(canVerifyOrderQr({ ...base, actorId: "rider-2" }), false);
  assert.equal(canVerifyOrderQr({ ...base, actorId: "vendor-1", actorRole: "vendor" }), true);
  assert.equal(canVerifyOrderQr({ ...base, actorId: "customer", actorRole: "user", purpose: "delivery" }), true);
  assert.equal(canVerifyOrderQr({ ...base, actorId: "vendor-1", actorRole: "vendor", purpose: "delivery" }), false);
});

test("delivery payment cannot be released before delivery verification", () => {
  assert.equal(canReleaseDeliveryPayment({ status: "in_transit", deliveryConfirmedAt: null }), false);
  assert.equal(canReleaseDeliveryPayment({ status: "delivered", deliveryConfirmedAt: null }), false);
  assert.equal(canReleaseDeliveryPayment({ status: "in_transit", deliveryConfirmedAt: new Date() }), false);
  assert.equal(canReleaseDeliveryPayment({ status: "delivered", deliveryConfirmedAt: new Date() }), true);
});
