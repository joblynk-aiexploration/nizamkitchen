import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getFormMessageTone } from "@/components/ui/form-message";

// ─────────────────────────────────────────────────────────────────────────────
// REAL USER ISSUE #2 — Regression tests
//
// Root cause: stripe-eligibility.ts (HEAD) returned
//   { eligible: false, reason: "This plan is not yet configured for online
//     purchase. Please contact support." }
// for any plan with stripePriceId = null.  All chef plans have null.
// FormMessage showed it in GREEN because "not yet configured" didn't match the
// warningPattern (only "not configured" was listed, not "not yet configured").
// The readiness card also said "Secure Stripe checkout is ready" while the
// checkout form was unavailable — a direct contradiction.
// ─────────────────────────────────────────────────────────────────────────────

// ── Group 1: stripe-eligibility.ts — stripePriceId gate removed ──────────────

describe("stripe-eligibility — stripePriceId gate removed", () => {
  const source = readFileSync("src/server/billing/stripe-eligibility.ts", "utf8");

  it("does NOT block plans that have no stripePriceId", () => {
    // The old production bug: !plan.stripePriceId returned eligible: false.
    expect(source).not.toContain("!plan.stripePriceId");
  });

  it("does NOT contain the exact user-reported error message", () => {
    expect(source).not.toContain("not yet configured for online purchase");
  });

  it("does NOT select stripePriceId in the plan query (no longer needed)", () => {
    // Removing stripePriceId from the query proves it is no longer evaluated.
    expect(source).not.toMatch(/select:[\s\S]{0,200}stripePriceId/);
  });

  it("returns eligible: true for valid paid plans (no stripePriceId block)", () => {
    expect(source).toContain("eligible: true");
    // The comment may still mention stripePriceId for documentation, but no code check on it.
    expect(source).not.toContain("!plan.stripePriceId");
    expect(source).not.toContain("plan.stripePriceId");
  });
});

// ── Group 2: billing/plans/page.tsx — live_checkout gate in canCheckout ───────

describe("billing/plans/page.tsx — live_checkout gate in canCheckout", () => {
  const source = readFileSync("src/app/(app)/billing/plans/page.tsx", "utf8");

  it("imports isGlobalFeatureEnabled for the live_checkout flag", () => {
    expect(source).toContain('isGlobalFeatureEnabled');
  });

  it("awaits the live_checkout feature flag in the data-fetch", () => {
    expect(source).toContain('isGlobalFeatureEnabled("live_checkout")');
  });

  it("includes liveCheckoutEnabled in the canCheckout expression", () => {
    expect(source).toContain("liveCheckoutEnabled && stripeConfigured");
  });

  it("does NOT compute canCheckout from stripeConfigured alone (regression guard)", () => {
    // The old production code: canCheckout = stripeConfigured && priceNum > 0 ...
    // This allowed the checkout form to appear when live_checkout was disabled.
    expect(source).not.toMatch(/canCheckout\s*=\s*stripeConfigured\s*&&/);
  });

  it("defines checkoutReady combining both liveCheckoutEnabled and stripeConfigured", () => {
    expect(source).toContain("checkoutReady");
    expect(source).toContain("liveCheckoutEnabled && stripeConfigured");
  });
});

// ── Group 3: readiness card — no longer misleads when live_checkout is off ───

describe("billing/plans/page.tsx — readiness card uses checkoutReady", () => {
  const source = readFileSync("src/app/(app)/billing/plans/page.tsx", "utf8");

  it("readiness card border uses checkoutReady, not stripeConfigured alone", () => {
    // Old: className={stripeConfigured ? "border-emerald-200..." : "border-amber-200..."}
    // New: className={checkoutReady ? "border-emerald-200..." : "border-amber-200..."}
    expect(source).toContain('checkoutReady ? "border-emerald-200 bg-emerald-50"');
    expect(source).not.toMatch(/className=\{stripeConfigured \? "border-emerald/);
  });

  it("readiness card dot indicator uses checkoutReady", () => {
    expect(source).toContain('checkoutReady ? "bg-emerald-500"');
  });

  it("readiness card heading uses checkoutReady for 'Secure Stripe checkout is ready'", () => {
    expect(source).toContain('checkoutReady\n                  ? "Secure Stripe checkout is ready"');
  });

  it("shows 'Checkout activation pending' when Stripe is configured but live_checkout is off", () => {
    expect(source).toContain("pendingActivation");
    expect(source).toContain('"Checkout activation pending"');
  });
});

// ── Group 4: billing/actions.ts — live_checkout platform gate ─────────────────

describe("billing/actions.ts — live_checkout gate in checkout action", () => {
  const source = readFileSync("src/app/(app)/billing/actions.ts", "utf8");

  it("imports isGlobalFeatureEnabled", () => {
    expect(source).toContain("isGlobalFeatureEnabled");
  });

  it("checks the live_checkout flag before creating a Stripe session", () => {
    expect(source).toContain('isGlobalFeatureEnabled("live_checkout")');
    expect(source).toContain("liveCheckoutEnabled");
  });

  it("throws a descriptive error when live checkout is not enabled", () => {
    expect(source).toContain("Online checkout is not enabled for this platform yet");
  });

  it("preserves the assertStripeCheckoutEligible guard after the flag check", () => {
    expect(source).toContain("assertStripeCheckoutEligible");
  });
});

// ── Group 5: FormMessage tone — no checkout failure message renders green ─────

describe("FormMessage — getFormMessageTone: checkout-blocked messages are not green", () => {
  it("classifies 'not yet configured' message as warning — not success/green", () => {
    // This was the exact user-reported message rendered in green (production bug).
    const msg = "This plan is not yet configured for online purchase. Please contact support.";
    expect(getFormMessageTone(msg)).toBe("warning");
    expect(getFormMessageTone(msg)).not.toBe("success");
  });

  it("classifies 'not enabled' checkout message as warning", () => {
    const msg = "Online checkout is not enabled for this platform yet. Please contact support to change your plan.";
    expect(getFormMessageTone(msg)).toBe("warning");
    expect(getFormMessageTone(msg)).not.toBe("success");
  });

  it("classifies 'not available' message as warning", () => {
    const msg = "This billing plan is not available for purchase.";
    expect(getFormMessageTone(msg)).toBe("warning");
    expect(getFormMessageTone(msg)).not.toBe("success");
  });

  it("classifies 'unable' messages as error", () => {
    const msg = "Unable to start subscription checkout. Please contact support or try again.";
    expect(getFormMessageTone(msg)).toBe("error");
    expect(getFormMessageTone(msg)).not.toBe("success");
  });

  it("classifies payment success messages as success", () => {
    const msg = "Payment successful. Your subscription is active, and your invoice and receipt are available in Billing.";
    expect(getFormMessageTone(msg)).toBe("success");
  });

  it("classifies payment-received confirmation as success", () => {
    const msg = "Payment received. Your subscription is being confirmed and will activate shortly.";
    expect(getFormMessageTone(msg)).toBe("success");
  });

  it("warningPattern source contains 'not yet configured' phrase", () => {
    const source = readFileSync("src/components/ui/form-message.tsx", "utf8");
    expect(source).toContain("not yet configured");
    expect(source).toContain("not available");
  });
});
