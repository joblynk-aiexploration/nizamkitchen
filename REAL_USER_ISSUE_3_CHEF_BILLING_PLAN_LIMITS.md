# REAL USER ISSUE #3 — CHEF BILLING SHOWS HOUSEHOLD LIMITS
## Defect Report & Remediation Record

**Severity:** P2 — Display-only (server-side entitlements correct; billing UI wrong)  
**Reported:** Production (nizamkitchen.com)  
**Status:** REMEDIATED — All engineering gates PASS

---

## 1. User-Reported Symptoms

A Home Chef seller viewed their Billing page and saw:

- **Meal plans** — (irrelevant: household feature)
- **Grocery lists per month** — (irrelevant: household feature)
- **Household members** — (irrelevant: household feature)
- **Saved restaurants** — (irrelevant: household feature)
- **Chef requests per month** — (irrelevant: household feature)
- Chef marketplace — Not included
- Grocery exports — Not included
- Restaurant search — Not included

Expected (Chef Free limits):
- **Active services** — 0 of 1
- **Menu items** — 5
- **Bookings per month** — 0 of 20
- **Staff members** — 0 of 1
- Analytics — Not included
- Customer messaging — Not included
- Priority listing — Not included
- Promotions — Not included

**Severity:** P2 — display only. Server-side enforcement (booking limits, service limits, staff limits) was already correct via `getEntitlement()`. No real quotas were wrong; only the labels and values shown to the seller were wrong.

---

## 2. Root Cause Analysis

### Root cause: hardcoded Household-centric limit table for all audiences

`src/app/(app)/billing/page.tsx` contained a hardcoded 8-row limit table:

```tsx
// OLD (production bug):
<LimitRow label="Meal plans" value={entitlement.limits.maxMealPlans} />
<LimitRow label="Grocery lists per month" value={entitlement.limits.maxGroceryListsPerMonth} />
<LimitRow label="Household members" value={entitlement.limits.maxHouseholdMembers} />
<LimitRow label="Saved restaurants" value={entitlement.limits.maxSavedRestaurants} />
<LimitRow label="Chef requests per month" value={entitlement.limits.maxChefRequestsPerMonth} />
<LimitRow label="Chef marketplace" value={entitlement.features.chefMarketplace} />
<LimitRow label="Grocery exports" value={entitlement.features.groceryExports} />
<LimitRow label="Restaurant search" value={entitlement.features.restaurantSearch} />
```

This rendered for **all organization types** — Household, Home Chef, Catering, Restaurant — regardless of the `entitlement.planAudience` field that was already available.

For a Home Chef on Chef Free (`home-chef-free`):
- `entitlement.limits.maxMealPlans = 0` → "Meal plans: 0" (wrong field, meaningless value)
- `entitlement.limits.maxActiveServices = 1` → **never displayed** (correct Chef limit, hidden)
- `entitlement.features.chefMarketplace = true` → "Chef marketplace: Included" (wrong label — chef marketplace is a buyer feature, not a seller feature)

### Why server-side entitlements were already correct

`getEntitlement(orgId)` in `entitlements.ts` correctly resolves:
- Plan catalog lookup by subscription `planSlug`
- Chef Free → `planAudience: "chef_staff"`, `limits.maxActiveServices = 1`, `limits.maxMenuItems = 5`, `limits.maxBookingsPerMonth = 20`, `limits.maxStaffMembers = 1`
- `-1` in catalog → `Infinity` via `toPublicLimit()` (Growth/Professional unlimited fields)

Enforcement guards (`canCreateService`, `canAcceptBooking`, `canInviteStaff`) all read from `entitlement.limits` correctly. Only the billing UI display was broken.

### Secondary issues also fixed

1. **Plan name fallback "Free / Starter"** was audience-agnostic. For a Chef org with no subscription row, the billing hero showed "Free / Starter" instead of "Chef Free". Fixed with audience-aware `planDisplayName` fallback.

2. **Plan description fallback** was "Start with core planning tools, then upgrade when your household or seller workflow needs more capacity." — Household-centric generic copy. Fixed with audience-specific descriptions.

3. **`getEntitlement()` called twice** per billing page request — once directly, once inside `getSellerUsage()`. Eliminated by replacing the standalone `getEntitlement()` call with a single `getSellerUsage()` call; the page now uses `sellerUsage.entitlement` directly.

---

## 3. Files Changed

### `src/app/(app)/billing/page.tsx`

**Import changes:**
- Removed: `import { getEntitlement } from "@/server/billing/entitlements"`
- Added: `import { type Entitlement, type PlanAudience } from "@/server/billing/entitlements"`
- Added: `import { getSellerUsage, type UsageMetric } from "@/server/billing/seller-usage"`

**Data fetch (Promise.all):**
- Replaced `getEntitlement(...)` with `getSellerUsage(...)` (eliminates redundant double-entitlement DB call)
- `const entitlement = sellerUsage.entitlement;` (alias for readability; all downstream code unchanged)

**Plan name / description fallbacks:**
```typescript
const planDisplayName = plan?.name ?? FREE_PLAN_NAME[orgType] ?? "Free";
const planDisplayDescription = plan?.description ?? FREE_PLAN_DESCRIPTION[orgType] ?? "...";
```
Where `FREE_PLAN_NAME` maps `chef_business → "Chef Free"`, `home_catering → "Catering Free"`, etc.

**New helper function `resolveDisplayAudience`:**
```typescript
function resolveDisplayAudience(planAudience: PlanAudience, orgType: string): PlanAudience {
  if (planAudience !== "none") return planAudience;
  if (orgType === "chef_business") return "chef_staff";
  if (orgType === "home_catering") return "home_catering";
  if (orgType === "restaurant") return "restaurant";
  return "household";
}
```
Ensures chef orgs with no subscription (FALLBACK_ENTITLEMENT: `planAudience = "none"`) still see chef-specific fields instead of Household fields.

**New `UsageLimitRow` component:**
Renders `"X of Y"` or `"X (Unlimited)"` format for seller dimensions where real-time usage is tracked by `getSellerUsage()`. Falls back to showing the plan limit alone when usage is not tracked.

**New `PlanLimitRows` component:**
Audience-aware plan limits rendering:

| Audience | Fields shown |
|---|---|
| `chef_staff` | Active services (w/ usage), Menu items (limit), Bookings/month (w/ usage), Staff (w/ usage if limit > 0), Analytics, Customer messaging, Priority listing, Promotions |
| `home_catering` | Packages (w/ usage), Orders/month (w/ usage), Staff (w/ usage if limit > 0), Analytics, Customer messaging, Priority listing |
| `restaurant` | Menu items (w/ usage), Orders/month (w/ usage), Locations (limit), Staff (w/ usage if limit > 0), Analytics, Customer messaging |
| `household` (fallback) | Meal plans, Grocery lists/month, Household members, Saved restaurants, Chef requests/month, Chef marketplace, Grocery exports, Restaurant search |

**Hardcoded Household rows removed** from top-level page JSX — now live only inside the Household branch of `PlanLimitRows`.

### `tests/billing/chef-billing-limits.test.ts` (NEW FILE)

37 tests across 6 groups — see Section 4.

---

## 4. Test Coverage — 37 Tests

**File:** `tests/billing/chef-billing-limits.test.ts`

| Group | Tests | Coverage |
|---|---|---|
| Plan catalog — Chef Free limits | 6 | maxActiveServices=1, maxMenuItems=5, maxBookingsPerMonth=20, maxStaffMembers=1, maxMealPlans=0 (zero for household fields) |
| Plan catalog — Chef upgrade limits | 5 | Growth unlimited services/items, 150 bookings, 0 staff; Professional 10 staff, unlimited bookings |
| Entitlement engine helpers | 5 | isUnlimited(Infinity/−1) = true, isUnlimited(0/1) = false, household-free unlimited via catalog |
| billing/page.tsx — audience-aware source | 10 | getSellerUsage imported, Meal plans not hardcoded, Active services shown, Bookings shown, Menu items shown, planDisplayName used, resolveDisplayAudience present, PlanLimitRows used |
| seller-usage.ts — no Household leakage | 5 | chef_staff tracks services + bookings, no meal_plan/grocery_list metrics, menuItems for restaurant/catering only, staff cross-audience |
| Cross-audience regression | 6 | Household fallback still shows Meal plans + Grocery lists, Restaurant shows Orders/Locations, Catering shows Packages, Chef Free limit=1, Chef Growth limit=Unlimited, FALLBACK_ENTITLEMENT planAudience="none" (not "household") |

---

## 5. Engineering Gates

| Gate | Result |
|---|---|
| `npx prisma validate` | **Schema valid** |
| `npx tsc --noEmit` | **0 errors** |
| `npx tsc --noEmit --strict` | **0 errors** |
| `npx eslint` (changed files) | **0 errors** |
| `npx vitest run` (all 83 test files) | **1017 / 1017 PASS** |
| `npm run build` | **BUILD PASS** |

---

## 6. Source Audit Answers (Phase 17)

1. **What audience does the affected Chef org resolve to?** `chef_staff` (via `billingPlanAudienceForOrganizationType("chef_business") → "chef_staff"`).

2. **What plan does it resolve to?** `home-chef-free` → `planSlug = "home-chef-free"`, `planName = "Chef Free"`, `planAudience = "chef_staff"`.

3. **What does `getEntitlement()` return for Chef Free?** `limits.maxActiveServices = 1`, `maxMenuItems = 5`, `maxBookingsPerMonth = 20`, `maxStaffMembers = 1`, all Household fields = 0.

4. **Are effective server-side limits Chef or Household limits?** **Chef limits — correct.** Server-side enforcement was never broken.

5. **Where do displayed Household fields originate?** From the old hardcoded 8-row JSX block in `billing/page.tsx` that used `entitlement.limits.maxMealPlans` etc. for all org types.

6. **Is the billing page using a generic static limit list?** Was: YES. Now: NO — audience-aware `PlanLimitRows`.

7. **Does it accidentally use Household fields as default?** Was: YES. Now: NO — `resolveDisplayAudience` maps to correct seller audience; Household is only the final fallback.

8. **Is "Free / Starter" a generic fallback?** Was: YES. Now: NO — `planDisplayName` uses `plan?.name` from the subscription first, then an org-type-keyed fallback ("Chef Free", "Catering Free", "Restaurant Free").

9. **Are usage meters also mapped incorrectly?** Was: YES — old LimitRow showed static household limits (all zeros for Chef). Now: `UsageLimitRow` shows `getSellerUsage()` real-time counts ("X of Y") for tracked dimensions; static limit shown where usage isn't tracked.

10. **Do seller enforcement actions use correct Chef limits?** YES — and always have. Enforcement was correct before this fix; only the display was wrong.

11. **Do `billing/plans/page.tsx` plans show correct audience?** YES — `billingPlanAudienceForOrganizationType` filters plans by audience; only Chef plans shown to Chef orgs.

12. **Are Household seller limits (maxActiveServices=0 for Chef plans) shown?** Was: displayed as "Meal plans: 0" (wrong label). Now: Chef dimensions are shown with correct labels.

13. **Does a Chef Free → Growth → Professional upgrade reflect correct limits?** YES — catalog values are authoritative. Growth: unlimited services/items, 150 bookings, 0 staff. Professional: unlimited services/items/bookings, 10 staff.

14. **Is there a silent Household fallback for unknown plans?** No — FALLBACK_ENTITLEMENT has `planAudience: "none"` and all limits = 0. `resolveDisplayAudience` maps "none" + known org type to correct seller audience.

15. **Legacy plan safety?** An org with no subscription gets FALLBACK_ENTITLEMENT (`planAudience = "none"`). `resolveDisplayAudience` uses `orgType` to determine the correct audience — a chef org sees chef fields with 0 limits, not Household fields.

16. **Admin billing consistency?** The admin org billing page (`/admin/billing/orgs/[orgId]`) independently calls `getEntitlement()`. Since the entitlement engine was always correct, admin has always shown correct effective limits. Only the seller-facing billing page was displaying wrong field labels.

---

## 7. Scope Preserved

| Constraint | Status |
|---|---|
| Stripe in TEST/SANDBOX mode unchanged | CONFIRMED — no payment code touched |
| DO NOT DEPLOY | CONFIRMED — no push to remote |
| Server-side entitlement enforcement unchanged | CONFIRMED — only UI rendering changed |
| Household billing unaffected (redirected from billing page) | CONFIRMED — household redirect still at top of BillingPage |
| Chef marketplace buyer feature preserved for Household | CONFIRMED — Household branch in PlanLimitRows unchanged |
| Admin billing view unchanged | CONFIRMED — `getEntitlement()` in admin pages is independent and was always correct |

---

## 8. Verdict

**READY FOR TARGETED BROWSER RETEST**

Expected behavior after fix — Home Chef Free billing page:

1. Visit `/billing` as a Home Chef seller
2. Hero shows: **Chef Free** (not "Free / Starter"), description about home chef business
3. Plan limits section shows:
   - Active services: 0 of 1
   - Menu items: 5
   - Bookings per month: 0 of 20
   - Staff members: 0 of 1
   - Analytics: Not included
   - Customer messaging: Not included
   - Priority listing: Not included
   - Promotions: Not included
4. **No Meal plans, Grocery lists, Household members, Saved restaurants, or Chef requests fields**
5. After upgrading to Growth: services/items shown as Unlimited, bookings as "X of 150", staff row hidden
6. After upgrading to Professional: bookings shown as Unlimited, staff row shows "X of 10"
