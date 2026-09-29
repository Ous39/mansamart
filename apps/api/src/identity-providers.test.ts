import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { verifyIdentityToken } from "./identity-providers";

const pair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = pair.publicKey.export({ format: "jwk" }) as crypto.JsonWebKey & { kid: string; alg: string };
publicJwk.kid = "mansamart-test-key";
publicJwk.alg = "RS256";

function token(overrides: Record<string, unknown> = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: publicJwk.kid })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com",
    aud: "mansamart-test-client",
    sub: "provider-user-1",
    exp: Math.floor(Date.now() / 1000) + 300,
    iat: Math.floor(Date.now() / 1000),
    email: "member@example.com",
    email_verified: true,
    ...overrides,
  })).toString("base64url");
  const signature = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), pair.privateKey).toString("base64url");
  return `${header}.${claims}.${signature}`;
}

test("verifies a provider-signed Google identity token", async () => {
  process.env.GOOGLE_CLIENT_IDS = "mansamart-test-client";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
  try {
    const identity = await verifyIdentityToken("google", token());
    assert.equal(identity.subject, "provider-user-1");
    assert.equal(identity.email, "member@example.com");
    assert.equal(identity.emailVerified, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects an identity token for another OAuth client", async () => {
  process.env.GOOGLE_CLIENT_IDS = "mansamart-test-client";
  await assert.rejects(() => verifyIdentityToken("google", token({ aud: "attacker-client" })), /audience/);
});

