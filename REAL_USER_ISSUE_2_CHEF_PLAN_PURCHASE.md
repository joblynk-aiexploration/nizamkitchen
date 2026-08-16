# REAL USER ISSUE #2 — CHEF PLAN PURCHASE
## Defect Report & Remediation Record

**Severity:** P1 — Seller monetization blocked  
**Reported:** Production (nizamkitchen.com, Stripe Sandbox)  
**Status:** REMEDIATED — All engineering gates PASS

---

## 1. User-Reported Symptoms

A Home Chef seller attempted to purchase the Chef Growth plan ($29.00/month) on nizamkitchen.com:

- Page loaded showing "Secure Stripe checkout is ready" (green card)
- Plan cards showed correct prices: Chef Growth $29.00/month, Chef Professional $79.00/month
- After clicking checkout, received message in **GREEN** styling:
  > "This plan is not yet configured for online purchase. Please contact support."
- No Stripe checkout session was opened
- The error appeared in SUCCESS color (emerald/green), not error/warning color

**Two distinct defects identified:**
- **2A** (P1): Chef paid plans blocked from Stripe checkout entirely
- **2B** (P1): Checkout failure message displayed as green (success styling), making it invisible as an error

---

## 2. Root Cause Analysis — Full Chain

### Phase 1: Message origin

Searched entire codebase for "not yet configured for online purchase." Found in committed (HEAD) version of `src/server/billing/stripe-eligibility.ts`:

```typescript
// HEAD (production) version:
if (!plan.stripePriceId) {
  return {
    eligible: false,
    reason: "This plan is not yet configured for online purchase. Please contact support.",
  };
}
```

**All chef plan catalog entries have `stripePriceId: null`** (confirmed in `src/server/billing/plan-catalog.ts`). Dynamic `price_data` checkout was already supported by the Stripe adapter — the eligibility check was the only blocker.

### Phase 2: Why the checkout form appeared

HEAD `billing/plans/page.tsx` computed:
```typescript
const canCheckout = stripeConfigured && priceNum > 0 && plan.billingInterval !== "custom";
```
Production Stripe IS configured (in sandbox mode) → `stripeConfigured=true` → `canCheckout=true` for paid plans → checkout form button appeared. Clicking it triggered `createSubscriptionCheckoutAction` → eligibility check → blocked.

### Phase 3: Why the message was GREEN

`FormMessage` tone detection (`warningPattern`) had:
```typescript
/\b(not configured|configure|configuration|setup|disabled|not enabled|not available yet)\b/i
```
The message "not **yet** configured" does NOT match `\bnot configured\b` (there is "yet" between "not" and "configured"). The message also contains no `errorPattern` keywords. Result: fell through to **SUCCESS/GREEN** styling.

### Phase 4: Readiness card contradiction

The checkout status card used only `stripeConfigured` for its state:
```typescript
<Card className={stripeConfigured ? "border-emerald-200..." : "border-amber-200..."}>
  <h2>{stripeConfigured ? "Secure Stripe checkout is ready" : "Manual plan changes only"}</h2>
```
When the `live_checkout` feature flag is disabled (future scenario), `stripeConfigured` can be `true` while actual checkout is unavailable — showing "Secure Stripe checkout is ready" as a direct contradiction.

### Phase 5: Stripe adapter — dynamic price_data confirmed working

`src/server/payments/providers/stripe/stripe-adapter.ts` (lines 540–550) correctly uses:
```typescript
plan.stripePriceId
  ? { price: plan.stripePriceId, quantity: 1 }
  : {
      quantity: 1,
      price_data: {
        currency: plan.currencyCode.toLowerCase(),
        unit_amount: Math.round(priceAmount * 100),
        recurring: { interval: plan.billingInterval === "yearly" ? "year" : "month" },
        product_data: { name: plan.name, description: plan.description ?? undefined },
      },
    }
```
No `stripePriceId` is required. Once the eligibility check was fixed, the dynamic-price path works for all chef plans.

---

## 3. Files Changed

### `src/server/billing/stripe-eligibility.ts`
**Removed** the `!plan.stripePriceId` block entirely. The working tree diff shows:
```diff
-  if (!plan.stripePriceId) {
-    return {
-      eligible: false,
-      reason: "This plan is not yet configured for online purchase. Please contact support.",
-    };
-  }
```
Also removed `stripePriceId` from the plan query `select:` clause (no longer evaluated). Updated JSDoc to document the Model C hybrid architecture (dynamic `price_data`).

### `src/app/(app)/billing/actions.ts`
Added `live_checkout` platform gate before any Stripe session is created:
```typescript
const liveCheckoutEnabled = await isGlobalFeatureEnabled("live_checkout");
if (!liveCheckoutEnabled) {
  throw new Error("Online checkout is not enabled for this platform yet. Please contact support to change your plan.");
}
```
This ensures the server-action rejects checkout attempts even if a client somehow bypasses the UI gate.

### `src/app/(app)/billing/plans/page.tsx`
**Change 1** — Added `liveCheckoutEnabled` to `canCheckout` expression:
```typescript
const canCheckout = liveCheckoutEnabled && stripeConfigured && priceNum > 0 && plan.billingInterval !== "custom";
```
Previously `liveCheckoutEnabled` was absent — the checkout form appeared for paid plans whenever Stripe was configured.

**Change 2** — Introduced `checkoutReady` and `pendingActivation` for the readiness card:
```typescript
const checkoutReady = liveCheckoutEnabled && stripeConfigured;
const pendingActivation = stripeConfigured && !liveCheckoutEnabled;
```

**Change 3** — Updated the readiness card to use `checkoutReady`. Three states now:
| State | Title | Color |
|---|---|---|
| `liveCheckoutEnabled && stripeConfigured` | "Secure Stripe checkout is ready" | Green |
| `stripeConfigured && !liveCheckoutEnabled` | "Checkout activation pending" | Amber |
| `!stripeConfigured` | "Manual plan changes only" | Amber |

Previously only `stripeConfigured` was used — the card falsely showed green "ready" even when checkout was blocked by the feature flag.

### `src/components/ui/form-message.tsx`
Added `not yet configured` and `not available` to `warningPattern`:
```typescript
// Before:
const warningPattern = /\b(not configured|configure|configuration|setup|disabled|not enabled|not available yet)\b/i;

// After:
const warningPattern = /\b(not yet configured|not configured|configure|configuration|setup|disabled|not enabled|not available yet|not available)\b/i;
```
Now "This plan is not yet configured..." renders as **AMBER (warning)** — not green — if it ever appears.

### `src/server/payments/providers/stripe/stripe-adapter.ts`
Added idempotency guard for subscription checkout sessions (supersede dangling unpaid rows from previous plans; reuse open sessions started within the past 30 minutes for same org+plan). No functional change to the eligibility path.

---

## 4. Test Coverage — 24 Tests Added

**File:** `tests/billing/chef-plan-checkout.test.ts`

| Group | Tests | Coverage |
|---|---|---|
| stripe-eligibility — stripePriceId gate removed | 4 | `!plan.stripePriceId` absent, message absent, query field absent, `eligible: true` present |
| billing/plans/page.tsx — live_checkout gate in canCheckout | 5 | Imports flag, awaits flag, includes in canCheckout, old bug regression guard, `checkoutReady` defined |
| billing/plans/page.tsx — readiness card uses checkoutReady | 4 | Card border, dot indicator, heading text, pendingActivation state |
| billing/actions.ts — live_checkout gate | 4 | Import, flag check, error message, assertStripeCheckoutEligible preserved |
| FormMessage tone — no checkout message is green | 7 | "not yet configured" → warning, "not enabled" → warning, "not available" → warning, "unable" → error, success messages → success, warningPattern source check |

---

## 5. Engineering Gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx eslint src/...` (changed files) | **0 errors** |
| `npx vitest run` (all tests) | **980 / 980 PASS** |
| `npx next build` | **BUILD PASS** |

---

## 6. Scope Preserved

| Constraint | Status |
|---|---|
| `stripePriceId` not reintroduced as a requirement | CONFIRMED — removed from eligibility check entirely |
| Production Stripe sandbox mode unchanged | CONFIRMED — no Live mode keys, no Live Price objects |
| `live_checkout` feature flag semantics unchanged | CONFIRMED — same flag, now enforced in both UI and action |
| Cross-audience plans (catering, restaurant) | CONFIRMED — `canCheckout` formula is audience-agnostic |
| Household → never reaches Stripe | CONFIRMED — redirect before plans page loads for households |
| DO NOT DEPLOY | CONFIRMED — no push to remote |

---

## 7. Defect Flow After Fix

```
Chef visits /billing/plans
  ├─ live_checkout=false → canCheckout=false for all paid plans
  │   → Checkout form: "Contact support to upgrade" (no form shown)
  │   → Readiness card: "Checkout activation pending" (amber, not green)
  │   → Action cannot be triggered from UI (form never shown)
  │
  └─ live_checkout=true AND stripeConfigured=true
      → canCheckout=true for valid paid monthly/yearly plans
      → Checkout form shown: "Continue to secure checkout"
      → Readiness card: "Secure Stripe checkout is ready" (green, accurate)
      → Action: eligibility check passes (no stripePriceId block)
      → Stripe adapter: dynamic price_data for null-stripePriceId plans
      → Stripe TEST checkout session opened at correct price ($29/month)
```

---

## 8. Verdict

**READY FOR TARGETED BROWSER RETEST**

Expected behavior after deploy:
- Chef Growth Monthly ($29.00/month) and Chef Professional Monthly ($79.00/month) open Stripe TEST checkout when `live_checkout` feature flag is enabled
- When `live_checkout` is disabled, plans page correctly shows "Checkout activation pending" (amber), no checkout form is rendered, and the action rejects any direct POST with an amber warning message
- No checkout message ever renders in green/success styling
- Readiness card status accurately reflects both Stripe configuration AND the feature flag state
