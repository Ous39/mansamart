import crypto from "node:crypto";

export function normalizeGambianPhone(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  const national = digits.startsWith("220") ? digits.slice(3) : digits;
  if (!/^\d{7,9}$/.test(national)) {
    throw new Error("Enter a valid Gambian phone number");
  }
  return `+220${national}`;
}

export function generatePhoneOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function phoneOtpPepper(): string {
  const configured = process.env.PHONE_OTP_PEPPER;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PHONE_OTP_PEPPER must contain at least 32 characters");
  }
  return "mansamart-development-phone-otp-pepper-not-for-production";
}

export function hashPhoneOtp(challengeId: string, code: string): string {
  return crypto.createHmac("sha256", phoneOtpPepper()).update(`${challengeId}:${code}`).digest("hex");
}

export function verifyPhoneOtp(challengeId: string, code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPhoneOtp(challengeId, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function phoneOtpCanExposeDevelopmentCode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.PHONE_OTP_DEV_EXPOSE_CODE === "true";
}

