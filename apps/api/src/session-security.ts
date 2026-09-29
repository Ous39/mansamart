import crypto from "node:crypto";

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function sessionTokenLooksHashed(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
