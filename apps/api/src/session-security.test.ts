import assert from "node:assert/strict";
import test from "node:test";
import { hashSessionToken, sessionTokenLooksHashed } from "./session-security";

test("session tokens are stored as stable SHA-256 digests", () => {
  const token = "secret-bearer-token";
  const digest = hashSessionToken(token);
  assert.notEqual(digest, token);
  assert.equal(digest, hashSessionToken(token));
  assert.equal(sessionTokenLooksHashed(digest), true);
  assert.equal(sessionTokenLooksHashed(token), false);
});
