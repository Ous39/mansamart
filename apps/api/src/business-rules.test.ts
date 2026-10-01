import assert from "node:assert/strict";
import test from "node:test";
import {
  availablePayoutBalance,
  canVendorAdvanceFulfillment,
  deriveMarketplaceOrderStatus,
  isBusinessVerified,
} from "./business-rules";

test("only verified business profiles can publish", () => {
  assert.equal(isBusinessVerified({ verificationStatus: "verified" }), true);
  assert.equal(isBusinessVerified({ verificationStatus: "pending" }), false);
  assert.equal(isBusinessVerified(null), false);
});

test("vendor fulfillment requires payment and moves forward one step", () => {
  assert.equal(canVendorAdvanceFulfillment("pending", "confirmed", "pending"), false);
  assert.equal(canVendorAdvanceFulfillment("pending", "confirmed", "paid"), true);
  assert.equal(canVendorAdvanceFulfillment("confirmed", "preparing", "paid"), true);
  assert.equal(canVendorAdvanceFulfillment("preparing", "ready_for_pickup", "settled"), true);
  assert.equal(canVendorAdvanceFulfillment("pending", "ready_for_pickup", "paid"), false);
  assert.equal(canVendorAdvanceFulfillment("ready_for_pickup", "pending", "paid"), false);
});

test("shared order state is derived from every seller portion", () => {
  assert.equal(deriveMarketplaceOrderStatus("paid", ["confirmed", "pending"]), "paid");
  assert.equal(deriveMarketplaceOrderStatus("paid", ["confirmed", "preparing"]), "confirmed");
  assert.equal(deriveMarketplaceOrderStatus("confirmed", ["preparing", "ready_for_pickup"]), "preparing");
  assert.equal(deriveMarketplaceOrderStatus("preparing", ["ready_for_pickup", "ready_for_pickup"]), "ready_for_pickup");
});

test("payout availability reserves pending requests", () => {
  assert.equal(availablePayoutBalance(1000, [200, 150]), 650);
  assert.equal(availablePayoutBalance(100, [150]), 0);
});
