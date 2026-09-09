import assert from "node:assert/strict";
import test from "node:test";
import { canUseCustomerCommerce, defaultWebPath, nextBookingStatus, nextVendorStatus, roleCanUseGeneralWeb, safeInternalPath } from "./web-rules";

test("general web accepts every non-admin role and rejects administrators", () => {
  for (const role of ["user", "vendor", "service_provider", "delivery_rider"] as const) assert.equal(roleCanUseGeneralWeb(role), true);
  assert.equal(roleCanUseGeneralWeb("admin"), false);
});

test("role dashboards and customer commerce stay separated", () => {
  assert.equal(defaultWebPath("user"), "/account");
  assert.equal(defaultWebPath("vendor"), "/vendor");
  assert.equal(defaultWebPath("service_provider"), "/provider");
  assert.equal(defaultWebPath("delivery_rider"), "/rider");
  assert.equal(canUseCustomerCommerce("user"), true);
  assert.equal(canUseCustomerCommerce("vendor"), false);
});

test("return paths cannot redirect outside MansaMart", () => {
  assert.equal(safeInternalPath("/cart?from=shop"), "/cart?from=shop");
  assert.equal(safeInternalPath("//example.com/steal", "/shop"), "/shop");
  assert.equal(safeInternalPath("https://example.com", "/shop"), "/shop");
  assert.equal(safeInternalPath("/\\example.com", "/shop"), "/shop");
});

test("business transitions advance one step at a time", () => {
  assert.equal(nextVendorStatus("pending"), "confirmed");
  assert.equal(nextVendorStatus("preparing"), "ready_for_pickup");
  assert.equal(nextVendorStatus("ready_for_pickup"), null);
  assert.equal(nextBookingStatus("pending"), "confirmed");
  assert.equal(nextBookingStatus("completed"), null);
});
