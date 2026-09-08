import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { calculateDeliveryFee, calculateOrderTotal } from "@mansamart/business-logic";
import {
  createWaveCheckoutSession,
  createWaveSignature,
  getWaveConfig,
  isValidWaveLaunchUrl,
  verifyWaveWebhookSignature,
  WaveConfigurationError,
  waveReadiness,
  type WaveConfig,
} from "./wave";

const secret = "wave_sn_WHS_test_secret";

test("Wave signatures use timestamp plus the exact raw body", () => {
  const timestamp = 1_700_000_000;
  const body = '{"amount":"25","currency":"GMD"}';
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}${body}`).digest("hex");
  assert.equal(createWaveSignature(body, secret, timestamp), `t=${timestamp},v1=${expected}`);
  assert.equal(verifyWaveWebhookSignature(body, `t=${timestamp},v1=${expected}`, secret, timestamp), true);
});

test("Only the official Wave launch host is accepted", () => {
  assert.equal(isValidWaveLaunchUrl("https://pay.wave.com/c/cos-test123"), true);
  assert.equal(isValidWaveLaunchUrl("http://pay.wave.com/c/cos-test123"), false);
  assert.equal(isValidWaveLaunchUrl("https://pay.wave.com.attacker.example/c/test"), false);
});

test("Wave webhook verification supports rotation and rejects tampering and replay", () => {
  const timestamp = 1_700_000_000;
  const body = Buffer.from('{"id":"EV_test"}');
  const valid = createWaveSignature(body.toString("utf8"), secret, timestamp).split("v1=")[1];
  assert.equal(verifyWaveWebhookSignature(body, `t=${timestamp},v1=${"0".repeat(64)},v1=${valid}`, secret, timestamp), true);
  assert.equal(verifyWaveWebhookSignature(Buffer.from('{"id":"EV_changed"}'), `t=${timestamp},v1=${valid}`, secret, timestamp), false);
  assert.equal(verifyWaveWebhookSignature(body, `t=${timestamp},v1=${valid}`, secret, timestamp + 301), false);
  assert.equal(verifyWaveWebhookSignature(body, `t=${timestamp},v1=${valid}`, secret, timestamp - 31), false);
});

test("Wave cannot be enabled accidentally before GMD confirmation", () => {
  const base = {
    WAVE_ENABLED: "true",
    WAVE_API_KEY: "test-key",
    WAVE_WEBHOOK_SECRET: "test-webhook-secret",
    WAVE_CURRENCY: "GMD",
    WAVE_SUCCESS_URL: "https://mansamart.gm/payment/wave/success",
    WAVE_ERROR_URL: "https://mansamart.gm/payment/wave/error",
  } as NodeJS.ProcessEnv;
  assert.throws(() => getWaveConfig(base), WaveConfigurationError);
  assert.deepEqual(waveReadiness(base), { enabled: true, ready: false, currency: "GMD" });
  const ready = getWaveConfig({ ...base, WAVE_GMD_CONFIRMED: "true" });
  assert.equal(ready.currency, "GMD");
  assert.equal(waveReadiness({ ...base, WAVE_GMD_CONFIRMED: "true" }).ready, true);
});

test("Checkout sends credentials and request signature only from the server", async () => {
  const config: WaveConfig = {
    apiBaseUrl: "https://api.wave.com",
    apiKey: "server-only-key",
    requestSigningSecret: "request-secret",
    webhookSecret: "webhook-secret",
    currency: "GMD",
    successUrl: "https://mansamart.gm/payment/wave/success",
    errorUrl: "https://mansamart.gm/payment/wave/error",
  };
  const input = {
    amount: "250",
    currency: "GMD",
    client_reference: "order:1:attempt:1",
    success_url: config.successUrl,
    error_url: config.errorUrl,
  };
  let captured: { url?: string; init?: RequestInit } = {};
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({
      id: "cos-test123",
      amount: "250",
      currency: "GMD",
      client_reference: input.client_reference,
      checkout_status: "open",
      payment_status: "processing",
      success_url: input.success_url,
      error_url: input.error_url,
      wave_launch_url: "https://pay.wave.com/c/cos-test123",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const checkout = await createWaveCheckoutSession(config, input, fakeFetch);
  const headers = captured.init?.headers as Record<string, string>;
  assert.equal(captured.url, "https://api.wave.com/v1/checkout/sessions");
  assert.equal(headers.Authorization, "Bearer server-only-key");
  assert.match(headers["Wave-Signature"], /^t=\d+,v1=[a-f0-9]{64}$/);
  assert.deepEqual(JSON.parse(String(captured.init?.body)), input);
  assert.equal(checkout.wave_launch_url, "https://pay.wave.com/c/cos-test123");
});

test("Order pricing uses the shared delivery rules", () => {
  assert.equal(calculateDeliveryFee(1_999, "delivery"), 200);
  assert.equal(calculateDeliveryFee(2_000, "delivery"), 0);
  assert.equal(calculateDeliveryFee(100, "pickup"), 0);
  assert.equal(calculateDeliveryFee(100, "delivery", true), 0);
  assert.equal(calculateOrderTotal(1_000, 200, 50), 1_150);
});
