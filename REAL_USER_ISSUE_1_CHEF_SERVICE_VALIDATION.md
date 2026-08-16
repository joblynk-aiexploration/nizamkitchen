# REAL USER ISSUE #1 — CHEF SERVICE FORM VALIDATION
## Defect Report & Remediation Record

**Severity:** P2 — Data loss on form validation failure  
**Reported:** Production (nizamkitchen.com)  
**Status:** REMEDIATED — All engineering gates PASS

---

## 1. User-Reported Symptoms

A Home Chef seller filling out the Add Service form:

1. Filled in all fields (Service name, Service type, Base price, Price unit, Description)
2. Left Minimum Guests blank (the field was optional in the schema — unintentionally)
3. Clicked "Add service"
4. Received a validation failure response in **GREEN** styling
5. **All previously entered field values were erased** — the form reset to empty
6. No indication of which field caused the error

**Three distinct defects:**
- **1A**: Form state loss on validation failure (all field values erased)
- **1B**: Error messages displayed in green/success styling
- **1C**: `minGuests` was not enforced as required despite being a business requirement

---

## 2. Root Cause Analysis

### 1A — Form state loss

The original action used a redirect-based validation pattern:
```typescript
// Old pattern:
if (!validation.success) {
  redirect(`/chef/services?message=${encodeURIComponent("Validation failed...")}`);
}
```
A `redirect()` causes the Server Component to fully re-render, which re-renders the form from its initial (empty) state. No user input is preserved.

**Fix:** Converted `upsertChefServiceAction` to the `useActionState` pattern (React 19 / Next.js 15). The action now returns a `ServiceFormState` object with `fieldErrors` and `values` (the user's raw submitted values), which a new Client Component (`ServiceForm`) reads to repopulate the form without a navigation.

### 1B — Green error messages

The services page used a hardcoded green Card for query-param messages:
```tsx
// Old:
<Card className="border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-800">
  {params.message}
</Card>
```
This rendered ALL messages — including errors — in green. 

**Fix:** Replaced with `<FormMessage message={params.message} />` which uses regex-based tone detection to automatically choose between error (red), warning (amber), and success (green) styling.

### 1C — minGuests not enforced as required

In `chefServiceSchema`, `minGuests` was processed to `nullable()` but had no `.refine()` to reject `null`. The field appeared required in the UI but was never enforced server-side.

**Fix:** Added `.refine((v): v is number => v !== null, { message: "Minimum guests is required." })` after the `.nullable()` preprocessing chain.

---

## 3. Files Changed

### `src/lib/validation/chefs.ts`
Made `minGuests` required via `.refine()`:
```typescript
minGuests: z
  .preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return null;
      const n = Number(value);
      return isNaN(n) ? null : n;
    },
    z.number().int().min(1, "Minimum guests must be at least 1.").max(10000).nullable(),
  )
  .refine((v): v is number => v !== null, { message: "Minimum guests is required." }),
```
Updated `superRefine` guard to handle non-null check for the max > min validation.

### `src/components/ui/text-input.tsx`
Added `error?: string` prop with field-level error display:
- Red border styling on input when error present
- `aria-invalid={error ? true : undefined}` attribute
- `aria-describedby` linking input to the error `<span>`
- `role="alert"` on the error span for screen reader announcement

### `src/components/ui/select-input.tsx`
Same `error` prop pattern applied to the `<select>` element.

### `src/app/(app)/chef/actions.ts`
- Exported `ServiceFormState` type with `error`, `fieldErrors`, and `values` fields
- Replaced `upsertChefServiceAction(formData: FormData)` with `useActionState`-compatible `(prevState: ServiceFormState, formData: FormData) => Promise<ServiceFormState>`
- Action extracts `rawValues` from `formData` before any async operations to ensure they're always available for return on failure
- On validation failure: returns `{ error, fieldErrors, values: rawValues }` — no redirect
- On server error: returns `{ error: message, values: rawValues }` — no redirect
- On success: calls `revalidateChefPaths()` then `redirect(...)` — same as before

**Entitlement safety preserved:** `assertServiceLimit` is called inside `upsertChefService` (server module), which is never called on validation failure. Zero usage increment on invalid submission.

### `src/app/(app)/chef/services/service-form.tsx` (NEW FILE)
New Client Component (`"use client"`) extracted from the old server-rendered form:
- `useActionState(upsertChefServiceAction, INITIAL_STATE)` for state management
- `useRef<HTMLFormElement>` + `useEffect` to focus the first field with an error after submission
- Value resolution priority: `state.values` (post-error raw values) → `service` prop (DB values for edit) → `""` (empty for new)
- All fields wired with `error={fe.fieldName}` props
- Form-level error banner with `role="alert"` and rose/red styling
- `disabled={isPending}` on submit button with "Saving…" label during flight

### `src/app/(app)/chef/services/page.tsx`
- Replaced hardcoded green Card with `<FormMessage message={params.message} />`
- Replaced inline server-rendered `ChefServiceForm` function with `<ServiceForm>` Client Component import
- Removed service type and price unit option arrays from the server component (moved to `service-form.tsx`)
- `orgCurrencyCode` prop replaces old `currencyCode` prop name for consistency

### `tests/billing/subscription-system.test.ts`
Pre-existing ESLint fix: replaced 8 occurrences of `require("node:fs").readFileSync(...)` with top-level `import { readFileSync } from "node:fs"` to satisfy `@typescript-eslint/no-require-imports`.

---

## 4. Test Coverage — 24 Tests Added

**File:** `tests/chefs/services-page.test.ts` (rewritten)

| Group | Tests | Coverage |
|---|---|---|
| chefServiceSchema — minGuests required | 7 | Empty/null/zero/NaN rejection, maxGuests < minGuests, valid acceptance, re-submit acceptance |
| upsertChefServiceAction — validation failure | 5 | Returns fieldErrors + values, preserves all field values, no service created, maxGuests error, success path calls upsertChefService |
| ServiceForm client component | 7 | useActionState usage, form-level error banner, minGuests error prop, maxGuests error prop, serviceId hidden input, state.values preservation, isPending button |
| chef services page | 3 | FormMessage usage (no hardcoded green), Add/Update labels, ServiceForm import |
| TextInput component — error prop | 2 | error prop + role=alert + text-rose-600, aria-invalid |

---

## 5. Engineering Gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx eslint src/...` (changed files) | **0 errors** |
| `npx vitest run` (all tests) | **980 / 980 PASS** |
| `npx next build` | **BUILD PASS** |

---

## 6. Verdict

**READY FOR TARGETED BROWSER RETEST**

Expected behavior after fix:
1. Chef fills out Add Service form, leaves Min Guests blank, clicks "Add service"
2. Form stays in place (no page reload / navigation)
3. All previously entered values remain in their fields
4. "Minimum guests is required." appears in red below the Min Guests field
5. Red border appears on the Min Guests input
6. A red error banner appears at the top of the form: "Please correct the errors below."
7. Focus moves to the Min Guests field automatically
8. Chef fills in Min Guests and resubmits — service is created successfully
9. "Successfully saved chef service." confirmation appears in green via FormMessage
