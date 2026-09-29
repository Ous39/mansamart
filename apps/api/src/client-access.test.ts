import assert from "node:assert/strict";
import test from "node:test";
import { parseClientAudience, roleAllowedForAudience } from "./client-access";

test("general web allows every non-admin role", () => {
  const web = parseClientAudience("web");
  for (const role of ["user", "vendor", "service_provider", "delivery_rider"]) {
    assert.equal(roleAllowedForAudience(web, role), true);
  }
  assert.equal(roleAllowedForAudience(web, "admin"), false);
});

test("each mobile app accepts only its intended accounts", () => {
  assert.equal(roleAllowedForAudience(parseClientAudience("customer"), "user"), true);
  assert.equal(roleAllowedForAudience(parseClientAudience("customer"), "vendor"), false);
  assert.equal(roleAllowedForAudience(parseClientAudience("business"), "vendor"), true);
  assert.equal(roleAllowedForAudience(parseClientAudience("business"), "service_provider"), true);
  assert.equal(roleAllowedForAudience(parseClientAudience("business"), "delivery_rider"), false);
  assert.equal(roleAllowedForAudience(parseClientAudience("rider"), "delivery_rider"), true);
  assert.equal(roleAllowedForAudience(parseClientAudience("rider"), "admin"), false);
});

test("administrator audience is isolated and unknown identities are rejected", () => {
  const admin = parseClientAudience("admin");
  assert.equal(roleAllowedForAudience(admin, "admin"), true);
  assert.equal(roleAllowedForAudience(admin, "user"), false);
  assert.equal(parseClientAudience("something-else"), null);
});
