import assert from "node:assert/strict";
import test from "node:test";
import {
  canUpdateBookingStatus,
  hasVerifiedReviewHistory,
  isOrderReturnEligible,
  normalizeCartSelection,
} from "./customer-rules";

test("cart option keys are stable and keep distinct product selections separate", () => {
  const first = normalizeCartSelection({
    selectedSize: " M ",
    selectedOptions: { notes: "Gift", color: "Blue" },
  });
  const same = normalizeCartSelection({
    selectedOptions: { color: "Blue", notes: "Gift" },
    selectedSize: "M",
  });
  const different = normalizeCartSelection({ selectedOptions: { color: "Red" }, selectedSize: "M" });

  assert.equal(first.optionKey, same.optionKey);
  assert.notEqual(first.optionKey, different.optionKey);
  assert.deepEqual(first.selectedOptions, { color: "Blue", notes: "Gift", size: "M" });
});

test("customers can cancel only their own active booking", () => {
  const customer = { id: "customer-1", role: "user" };
  assert.equal(canUpdateBookingStatus(customer, { userId: "customer-1", providerId: "provider-1", status: "pending" }, "cancelled"), true);
  assert.equal(canUpdateBookingStatus(customer, { userId: "customer-2", providerId: "provider-1", status: "pending" }, "cancelled"), false);
  assert.equal(canUpdateBookingStatus(customer, { userId: "customer-1", providerId: "provider-1", status: "completed" }, "cancelled"), false);
  assert.equal(canUpdateBookingStatus(customer, { userId: "customer-1", providerId: "provider-1", status: "pending" }, "completed"), false);
});

test("providers can update only their own bookings through valid transitions", () => {
  const provider = { id: "provider-1", role: "service_provider" };
  assert.equal(canUpdateBookingStatus(provider, { userId: "customer-1", providerId: "provider-1", status: "pending" }, "confirmed"), true);
  assert.equal(canUpdateBookingStatus(provider, { userId: "customer-1", providerId: "provider-2", status: "pending" }, "confirmed"), false);
  assert.equal(canUpdateBookingStatus(provider, { userId: "customer-1", providerId: "provider-1", status: "pending" }, "completed"), false);
});

test("product reviews require a delivered order containing that product", () => {
  const delivered = [{ status: "delivered", items: [{ productId: "product-1" }] }];
  assert.equal(hasVerifiedReviewHistory("product", "product-1", delivered, []), true);
  assert.equal(hasVerifiedReviewHistory("product", "product-2", delivered, []), false);
  assert.equal(hasVerifiedReviewHistory("product", "product-1", [{ status: "pending", items: [{ productId: "product-1" }] }], []), false);
});

test("service reviews require a completed booking for that service", () => {
  assert.equal(hasVerifiedReviewHistory("service", "service-1", [], [{ status: "completed", serviceId: "service-1" }]), true);
  assert.equal(hasVerifiedReviewHistory("service", "service-1", [], [{ status: "confirmed", serviceId: "service-1" }]), false);
});

test("returns are limited to delivered orders inside the return window", () => {
  const now = new Date("2026-09-09T12:00:00.000Z");
  assert.equal(isOrderReturnEligible({ status: "delivered", updatedAt: "2026-09-05T12:00:00.000Z" }, now), true);
  assert.equal(isOrderReturnEligible({ status: "completed", updatedAt: "2026-08-01T12:00:00.000Z" }, now), false);
  assert.equal(isOrderReturnEligible({ status: "processing", updatedAt: "2026-09-08T12:00:00.000Z" }, now), false);
});
