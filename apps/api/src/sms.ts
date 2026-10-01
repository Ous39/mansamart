export function isPhoneOtpConfigured(): boolean {
  if (process.env.PHONE_OTP_ENABLED !== "true") return false;
  if (process.env.NODE_ENV !== "production" && process.env.PHONE_OTP_DEV_EXPOSE_CODE === "true") return true;
  return Boolean(
    process.env.PHONE_OTP_PEPPER && process.env.PHONE_OTP_PEPPER.length >= 32 &&
    process.env.SMS_PROVIDER_URL && process.env.SMS_PROVIDER_TOKEN && process.env.SMS_SENDER_ID
  );
}

export async function sendPhoneOtp(phone: string, code: string): Promise<void> {
  if (process.env.NODE_ENV !== "production" && process.env.PHONE_OTP_DEV_EXPOSE_CODE === "true") return;
  const url = process.env.SMS_PROVIDER_URL;
  const token = process.env.SMS_PROVIDER_TOKEN;
  const sender = process.env.SMS_SENDER_ID;
  if (!url || !token || !sender) throw new Error("SMS provider is not configured");
  if (process.env.NODE_ENV === "production" && new URL(url).protocol !== "https:") {
    throw new Error("Production SMS provider URL must use HTTPS");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      to: phone,
      sender,
      message: `Your MansaMart verification code is ${code}. It expires in 10 minutes. Do not share it.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`SMS provider returned ${response.status}`);
}
