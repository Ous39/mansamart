import crypto from "node:crypto";

export type IdentityProvider = "google" | "apple";

export interface VerifiedIdentity {
  provider: IdentityProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  expiresAt: Date;
}

type JwtHeader = { alg?: string; kid?: string };
type JwtClaims = {
  iss?: string; aud?: string | string[]; sub?: string; exp?: number; iat?: number;
  email?: string; email_verified?: boolean | string; name?: string; nonce?: string;
};
type JsonWebKeyWithKid = JsonWebKey & { kid?: string; alg?: string; use?: string };

const jwksCache = new Map<string, { expiresAt: number; keys: JsonWebKeyWithKid[] }>();

function decodePart<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function providerConfig(provider: IdentityProvider) {
  if (provider === "google") {
    return {
      issuers: ["https://accounts.google.com", "accounts.google.com"],
      jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
      audiences: (process.env.GOOGLE_CLIENT_IDS || "").split(",").map(v => v.trim()).filter(Boolean),
    };
  }
  return {
    issuers: ["https://appleid.apple.com"],
    jwksUrl: "https://appleid.apple.com/auth/keys",
    audiences: (process.env.APPLE_CLIENT_IDS || "").split(",").map(v => v.trim()).filter(Boolean),
  };
}

async function getJwks(url: string): Promise<JsonWebKeyWithKid[]> {
  const cached = jwksCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Identity provider keys are unavailable");
  const body = await response.json() as { keys?: JsonWebKeyWithKid[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) throw new Error("Identity provider returned no signing keys");
  jwksCache.set(url, { keys: body.keys, expiresAt: Date.now() + 60 * 60_000 });
  return body.keys;
}

function matchesAudience(claim: string | string[] | undefined, allowed: string[]): boolean {
  const actual = Array.isArray(claim) ? claim : claim ? [claim] : [];
  return actual.some(value => allowed.includes(value));
}

export async function verifyIdentityToken(provider: IdentityProvider, token: string, expectedNonce?: string): Promise<VerifiedIdentity> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid identity token");
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const header = decodePart<JwtHeader>(encodedHeader);
  const claims = decodePart<JwtClaims>(encodedClaims);
  const config = providerConfig(provider);
  if (config.audiences.length === 0) throw new Error(`${provider} sign-in is not configured`);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported identity token signature");
  if (!claims.iss || !config.issuers.includes(claims.iss)) throw new Error("Invalid identity token issuer");
  if (!matchesAudience(claims.aud, config.audiences)) throw new Error("Invalid identity token audience");
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!claims.sub || !claims.exp || claims.exp <= nowSeconds || (claims.iat && claims.iat > nowSeconds + 300)) {
    throw new Error("Expired or invalid identity token");
  }
  if (expectedNonce) {
    const hashedNonce = crypto.createHash("sha256").update(expectedNonce).digest("hex");
    if (claims.nonce !== expectedNonce && claims.nonce !== hashedNonce) throw new Error("Identity token nonce mismatch");
  }

  const keys = await getJwks(config.jwksUrl);
  const jwk = keys.find(key => key.kid === header.kid && (!key.alg || key.alg === "RS256"));
  if (!jwk) throw new Error("Identity provider signing key was not found");
  const publicKey = crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: "jwk" });
  const valid = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedClaims}`),
    publicKey,
    Buffer.from(encodedSignature, "base64url"),
  );
  if (!valid) throw new Error("Invalid identity token signature");

  return {
    provider,
    subject: claims.sub,
    email: claims.email?.trim().toLowerCase() || null,
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: claims.name?.trim() || null,
    expiresAt: new Date(claims.exp * 1000),
  };
}

export function identityTokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
