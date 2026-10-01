import assert from "node:assert/strict";
import test from "node:test";
import { hasAdminPermission, isSafePlatformSettingValue, permissionsForRole } from "./admin-control";

test("super administrators receive every permission", () => {
  assert.equal(hasAdminPermission("super_admin", [], "staff.manage"), true);
  assert.equal(hasAdminPermission("super_admin", [], "payments.refund"), true);
});
test("staff roles receive least-privilege defaults and valid overrides", () => {
  assert.equal(hasAdminPermission("support_agent", [], "support.manage"), true);
  assert.equal(hasAdminPermission("support_agent", [], "payments.refund"), false);
  assert.equal(permissionsForRole("support_agent", ["reports.export", "not.real"]).includes("reports.export"), true);
});
test("platform settings reject arrays, null and oversized objects", () => {
  assert.equal(isSafePlatformSettingValue(false), true);
  assert.equal(isSafePlatformSettingValue({ enabled: true }), true);
  assert.equal(isSafePlatformSettingValue([]), false);
  assert.equal(isSafePlatformSettingValue(null), false);
  assert.equal(isSafePlatformSettingValue({ text: "x".repeat(10_001) }), false);
});
