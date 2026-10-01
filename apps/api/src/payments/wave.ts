import crypto from "node:crypto";

export type WaveConfig = {
  apiBaseUrl: string;
  apiKey: string;
  requestSigningSecret?: string;
  webhookSecret: string;
  currency: "GMD";
  successUrl: string;
  errorUrl: string;
};

export type WaveCheckoutSession = {
  id: string;
  amount: string;
  checkout_status: "open" | "complete" | "expired";
  client_reference?: string | null;
  currency: string;
  payment_status: "processing" | "cancelled" | "succeeded";
  success_url: string;
  error_url: string;
  wave_launch_url: string;
  transaction_id?: string | null;
  when_created?: string;
  when_expires?: string;
  when_completed?: string | null;
  last_payment_error?: { code?: string; message?: string } | null;
};

export type CreateWaveCheckoutInput = {
  amount: string;
  currency: string;
  client_reference: string;
  success_url: string;
  error_url: string;
  restrict_payer_mobile?: string;
};

export class WaveConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WaveConfigurationError";
  }
}

export class WaveApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WaveApiError";
  }
}

export function isWaveEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.WAVE_ENABLED?.trim().toLowerCase() === "true";
}

function requireHttpsUrl(name: string, value: string | undefined): string {
  if (!value) throw new WaveConfigurationError(`${name} is required when Wave is enabled`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new WaveConfigurationError(`${name} must be a valid URL`);
  }
  if (parsed.protocol !== "https:") throw new WaveConfigurationError(`${name} must use HTTPS`);
  return parsed.toString();
}

export function getWaveConfig(env: NodeJS.ProcessEnv = process.env): WaveConfig {
  if (!isWaveEnabled(env)) throw new WaveConfigurationError("Wave checkout is disabled");
  if (!env.WAVE_API_KEY) throw new WaveConfigurationError("WAVE_API_KEY is required when Wave is enabled");
  if (!env.WAVE_WEBHOOK_SECRET) throw new WaveConfigurationError("WAVE_WEBHOOK_SECRET is required when Wave is enabled");

  const currency = env.WAVE_CURRENCY?.trim().toUpperCase();
  if (currency !== "GMD") {
    throw new WaveConfigurationError("WAVE_CURRENCY must be GMD for MansaMart");
  }
  if (env.WAVE_GMD_CONFIRMED?.trim().toLowerCase() !== "true") {
    throw new WaveConfigurationError("Set WAVE_GMD_CONFIRMED=true only after Wave confirms GMD Checkout support for this wallet");
  }

  const apiBaseUrl = requireHttpsUrl("WAVE_API_BASE_URL", env.WAVE_API_BASE_URL || "https://api.wave.com");
  return {
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
    apiKey: env.WAVE_API_KEY,
    requestSigningSecret: env.WAVE_REQUEST_SIGNING_SECRET || undefined,
    webhookSecret: env.WAVE_WEBHOOK_SECRET,
    currency,
    successUrl: requireHttpsUrl("WAVE_SUCCESS_URL", env.WAVE_SUCCESS_URL),
    errorUrl: requireHttpsUrl("WAVE_ERROR_URL", env.WAVE_ERROR_URL),
  };
}

export function waveReadiness(env: NodeJS.ProcessEnv = process.env): { enabled: boolean; ready: boolean; currency: string } {
  if (!isWaveEnabled(env)) return { enabled: false, ready: false, currency: env.WAVE_CURRENCY || "GMD" };
  try {
    const config = getWaveConfig(env);
    return { enabled: true, ready: true, currency: config.currency };
  } catch {
    return { enabled: true, ready: false, currency: env.WAVE_CURRENCY || "GMD" };
  }
}

export function createWaveSignature(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const digest = crypto.createHmac("sha256", secret).update(`${timestamp}${rawBody}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

export function isValidWaveLaunchUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "pay.wave.com";
  } catch {
    return false;
  }
}

function constantTimeHexEqual(expectedHex: string, actualHex: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHex) || !/^[a-f0-9]{64}$/i.test(actualHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function verifyWaveWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!signatureHeader || !secret) return false;
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestampText = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestampText || !signatures.length || !/^\d+$/.test(timestampText)) return false;

  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp)) return false;
  if (timestamp < nowSeconds - 300 || timestamp > nowSeconds + 30) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody;
  const expected = crypto.createHmac("sha256", secret).update(`${timestampText}${body}`, "utf8").digest("hex");
  return signatures.some((signature) => constantTimeHexEqual(expected, signature));
}

type FetchLike = typeof fetch;

async function waveRequest<T>(
  config: WaveConfig,
  method: "GET" | "POST",
  path: string,
  body: Record<string, unknown> | undefined,
  fetchImpl: FetchLike,
): Promise<T> {
  const rawBody = body === undefined ? "" : JSON.stringify(body);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (config.requestSigningSecret) {
    headers["Wave-Signature"] = createWaveSignature(rawBody, config.requestSigningSecret);
  }

  let response: Response;
  try {
    response = await fetchImpl(new URL(path, `${config.apiBaseUrl}/`), {
      method,
      headers,
      body: body === undefined ? undefined : rawBody,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new WaveApiError(503, "wave-unavailable", error instanceof Error ? error.message : "Wave is unavailable");
  }

  const responseText = await response.text();
  let responseBody: Record<string, unknown> = {};
  if (responseText) {
    try {
      responseBody = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      if (response.ok) throw new WaveApiError(502, "invalid-wave-response", "Wave returned an invalid response");
    }
  }
  if (!response.ok) {
    const code = String(responseBody.code || responseBody.error || `wave-http-${response.status}`);
    const message = String(responseBody.message || "Wave rejected the request");
    throw new WaveApiError(response.status, code, message);
  }
  return responseBody as T;
}

export function createWaveCheckoutSession(
  config: WaveConfig,
  input: CreateWaveCheckoutInput,
  fetchImpl: FetchLike = fetch,
): Promise<WaveCheckoutSession> {
  return waveRequest<WaveCheckoutSession>(config, "POST", "/v1/checkout/sessions", input, fetchImpl);
}

export async function refundWaveCheckoutSession(
  config: WaveConfig,
  checkoutSessionId: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  if (!/^cos-[a-zA-Z0-9]+$/.test(checkoutSessionId)) {
    throw new WaveApiError(400, "invalid-checkout-session", "Invalid Wave checkout session ID");
  }
  await waveRequest<Record<string, never>>(
    config,
    "POST",
    `/v1/checkout/sessions/${encodeURIComponent(checkoutSessionId)}/refund`,
    undefined,
    fetchImpl,
  );
}
