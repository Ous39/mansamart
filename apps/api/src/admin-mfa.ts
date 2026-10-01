import crypto from "node:crypto";

export function isAdminMfaRequired(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "production" || env.ADMIN_MFA_REQUIRED === "true";
}

export function hashAdminMfaChallenge(challengeId: string, code: string, pepper: string) {
  if (pepper.length < 32) throw new Error("ADMIN_MFA_PEPPER must contain at least 32 characters");
  return crypto.createHmac("sha256", pepper).update(`${challengeId}:${code}`).digest("hex");
}

export function isAdminMfaCodeValid(expectedHash: string, challengeId: string, code: string, pepper: string) {
  const actualHash = hashAdminMfaChallenge(challengeId, code, pepper);
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
