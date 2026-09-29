import assert from "node:assert/strict";
import test from "node:test";
import { hashAdminMfaChallenge, isAdminMfaCodeValid, isAdminMfaRequired } from "./admin-mfa";

test("administrator MFA is mandatory in production and optional only in development", () => {
  assert.equal(isAdminMfaRequired({ NODE_ENV: "production" }), true);
  assert.equal(isAdminMfaRequired({ NODE_ENV: "development", ADMIN_MFA_REQUIRED: "true" }), true);
  assert.equal(isAdminMfaRequired({ NODE_ENV: "development", ADMIN_MFA_REQUIRED: "false" }), false);
});

test("administrator MFA codes are bound to their challenge and pepper", () => {
  const pepper = "a-long-random-administrator-pepper-value";
  const otherPepper = "a-different-random-admin-pepper-value";
  const hash = hashAdminMfaChallenge("challenge-one", "123456", pepper);
  assert.equal(isAdminMfaCodeValid(hash, "challenge-one", "123456", pepper), true);
  assert.equal(isAdminMfaCodeValid(hash, "challenge-two", "123456", pepper), false);
  assert.equal(isAdminMfaCodeValid(hash, "challenge-one", "654321", pepper), false);
  assert.equal(isAdminMfaCodeValid(hash, "challenge-one", "123456", otherPepper), false);
  assert.throws(() => hashAdminMfaChallenge("challenge-one", "123456", "too-short"));
});
