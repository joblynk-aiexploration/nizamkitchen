import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { handleStripeWebhook } = vi.hoisted(() => ({
  handleStripeWebhook: vi.fn(),
}));

vi.mock("@/server/payments/providers/stripe/stripe-webhooks", () => ({ handleStripeWebhook }));
vi.mock("@/server/observability/logger", () => ({ logError: vi.fn() }));
vi.mock("@/server/observability/system-alerts", () => ({ createSystemAlertForFailure: vi.fn() }));

import { POST as canonicalStripeWebhookPost } from "@/app/api/payments/stripe/webhook/route";
import { POST as legacyStripeWebhookPost } from "@/app/api/stripe/webhook/route";

function stripeRequest(pathname: string, body = "{\"id\":\"evt_test\"}", signature = "stripe-signature-test") {
  return new Request(`https://nk.friscodawah.org${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body,
  });
}

describe("Stripe webhook routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    handleStripeWebhook.mockResolvedValue({ status: "processed", eventId: "evt_test" });
  });

  it("keeps both canonical and legacy Stripe webhook route files registered", () => {
    expect(existsSync(path.join(process.cwd(), "src/app/api/payments/stripe/webhook/route.ts"))).toBe(true);
    expect(existsSync(path.join(process.cwd(), "src/app/api/stripe/webhook/route.ts"))).toBe(true);
  });

  it("does not let proxy auth redirects intercept Stripe webhook endpoints", () => {
    const proxySource = readFileSync(path.join(process.cwd(), "src/proxy.ts"), "utf8");

    expect(proxySource).not.toContain("\"/api\"");
    expect(proxySource).not.toContain("\"/api/stripe\"");
    expect(proxySource).not.toContain("\"/api/payments\"");
  });

  it("canonical POST endpoint forwards raw body and stripe-signature header", async () => {
    const response = await canonicalStripeWebhookPost(stripeRequest("/api/payments/stripe/webhook", "{\"hello\":\"stripe\"}", "sig_canonical"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: "processed" });
    expect(handleStripeWebhook).toHaveBeenCalledWith({ rawBody: "{\"hello\":\"stripe\"}", signature: "sig_canonical" });
  });

  it("legacy POST endpoint forwards to the same signature-verified handler", async () => {
    const response = await legacyStripeWebhookPost(stripeRequest("/api/stripe/webhook", "{\"hello\":\"legacy\"}", "sig_legacy"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: "processed" });
    expect(handleStripeWebhook).toHaveBeenCalledWith({ rawBody: "{\"hello\":\"legacy\"}", signature: "sig_legacy" });
  });

  it("rejects invalid signatures with a non-2xx response", async () => {
    handleStripeWebhook.mockRejectedValueOnce(new Error("bad signature"));

    const response = await legacyStripeWebhookPost(stripeRequest("/api/stripe/webhook", "{}", "bad"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "Stripe webhook could not be processed." });
  });

  it("acknowledges verified events when internal processing records a failed status", async () => {
    handleStripeWebhook.mockResolvedValueOnce({ status: "failed", eventId: "evt_failed" });

    const response = await canonicalStripeWebhookPost(stripeRequest("/api/payments/stripe/webhook"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: "failed" });
  });
});
