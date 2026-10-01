import assert from "node:assert/strict";
import test from "node:test";
import { hashPhoneOtp, normalizeGambianPhone, verifyPhoneOtp } from "./phone-auth";

test("normalizes supported Gambian phone formats", () => {
  assert.equal(normalizeGambianPhone("+220 123 4567"), "+2201234567");
  assert.equal(normalizeGambianPhone("220 123 456 789"), "+220123456789");
});

test("rejects invalid Gambian phone numbers", () => {
  assert.throws(() => normalizeGambianPhone("123"), /valid Gambian phone/);
  assert.throws(() => normalizeGambianPhone("+221771234567"), /valid Gambian phone/);
});

test("OTP hashes are challenge-bound and compared safely", () => {
  const hash = hashPhoneOtp("challenge-one", "123456");
  assert.equal(verifyPhoneOtp("challenge-one", "123456", hash), true);
  assert.equal(verifyPhoneOtp("challenge-one", "654321", hash), false);
  assert.equal(verifyPhoneOtp("challenge-two", "123456", hash), false);
});

