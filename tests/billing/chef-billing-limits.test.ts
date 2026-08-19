import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_CATALOG } from "@/server/billing/plan-catalog";
import { isUnlimited, canInviteStaff, type Entitlement } from "@/server/billing/entitlements";

// ─────────────────────────────────────────────────────────────────────────────
// REAL USER ISSUE #3 — Regression tests
//
// Root cause: billing/page.tsx had a hardcoded Household-centric plan-limit
// table rendered for ALL organization types. A Home Chef seller saw
// "Meal plans / Grocery lists / Household members / Saved restaurants /
//  Chef requests" — none of which are relevant to their chef business.
//
// Fix: billing/page.tsx now calls getSellerUsage() to get audience-aware
// metrics and renders audience-specific limit rows via PlanLimitRows component.
// ─────────────────────────────────────────────────────────────────────────────

// ── Group 1: Plan catalog — Home Chef Free limits ────────────────────────────

describe("plan catalog — home-chef-free limits", () => {
  const chefFree = PLAN_CATALOG.find((p) => p.slug === "home-chef-free");

  it("home-chef-free plan exists in catalog", () => {
    expect(chefFree).toBeDefined();
    expect(chefFree?.planAudience).toBe("chef_staff");
  });

  it("home-chef-free: maxActiveServices = 1", () => {
    expect(chefFree?.limitsJson.maxActiveServices).toBe(1);
  });

  it("home-chef-free: maxMenuItems = 5", () => {
    expect(chefFree?.limitsJson.maxMenuItems).toBe(5);
  });

  it("home-chef-free: maxBookingsPerMonth = 20", () => {
    expect(chefFree?.limitsJson.maxBookingsPerMonth).toBe(20);
  });

  it("home-chef-free: maxStaffMembers = 1 (finalized product rule: Chef Free includes 1 staff seat)", () => {
    // Authoritative business rule: Chef Free ships with 1 staff member included.
    // The tier matrix (TIER_SELLER_FEATURES.free.staffAccounts = false) is a coarse tier label
    // and does not override the plan-level numeric limit. Enforcement reads maxStaffMembers directly.
    expect(chefFree?.limitsJson.maxStaffMembers).toBe(1);
  });

  it("home-chef-free: has no household capacity (maxMealPlans = 0)", () => {
    // Chef plans never allocate household-focused quotas — confirms the
    // displayed Household fields (Meal plans: 0, Grocery lists: 0) were
    // both wrong label AND semantically meaningless for chef sellers.
    expect(chefFree?.limitsJson.maxMealPlans).toBe(0);
    expect(chefFree?.limitsJson.maxGroceryListsPerMonth).toBe(0);
    expect(chefFree?.limitsJson.maxSavedRestaurants).toBe(0);
  });
});

// ── Group 2: Plan catalog — upgrade plan limits ──────────────────────────────

describe("plan catalog — chef upgrade plan limits", () => {
  const chefGrowth = PLAN_CATALOG.find((p) => p.slug === "home-chef-growth-monthly");
  const chefPro = PLAN_CATALOG.find((p) => p.slug === "home-chef-professional-monthly");

  it("home-chef-growth-monthly: maxActiveServices = -1 (unlimited in catalog)", () => {
    expect(chefGrowth?.limitsJson.maxActiveServices).toBe(-1);
  });

  it("home-chef-growth-monthly: maxBookingsPerMonth = 150", () => {
    expect(chefGrowth?.limitsJson.maxBookingsPerMonth).toBe(150);
  });

  it("home-chef-growth-monthly: maxStaffMembers = 0 (Growth has no staff seats)", () => {
    // Growth tier does not include staff accounts — staff row must be hidden.
    expect(chefGrowth?.limitsJson.maxStaffMembers).toBe(0);
  });

  it("home-chef-professional-monthly: maxStaffMembers = 10", () => {
    expect(chefPro?.limitsJson.maxStaffMembers).toBe(10);
  });

  it("home-chef-professional-monthly: maxBookingsPerMonth = -1 (unlimited)", () => {
    expect(chefPro?.limitsJson.maxBookingsPerMonth).toBe(-1);
  });
});

// ── Group 3: Entitlement engine helpers ──────────────────────────────────────

describe("entitlement engine — isUnlimited helper", () => {
  it("isUnlimited(Infinity) = true", () => {
    expect(isUnlimited(Infinity)).toBe(true);
  });

  it("isUnlimited(-1) = true (catalog sentinel maps to unlimited)", () => {
    // -1 is the catalog convention for unlimited; entitlement engine converts
    // it to Infinity via toPublicLimit. isUnlimited(-1) = true ensures any
    // code that bypasses toPublicLimit still treats -1 as unlimited.
    expect(isUnlimited(-1)).toBe(true);
  });

  it("isUnlimited(0) = false", () => {
    expect(isUnlimited(0)).toBe(false);
  });

  it("isUnlimited(1) = false (finite limit is not unlimited)", () => {
    expect(isUnlimited(1)).toBe(false);
  });

  it("household-free plan has unlimited maxMealPlans in catalog (-1)", () => {
    const hh = PLAN_CATALOG.find((p) => p.slug === "household-free");
    expect(hh?.limitsJson.maxMealPlans).toBe(-1);
    expect(isUnlimited(hh!.limitsJson.maxMealPlans)).toBe(true);
  });
});

// ── Group 4: billing/page.tsx — audience-aware source audit ──────────────────

describe("billing/page.tsx — audience-aware plan limits source", () => {
  const source = readFileSync("src/app/(app)/billing/page.tsx", "utf8");

  it("imports getSellerUsage for audience-aware metrics (not just getEntitlement)", () => {
    expect(source).toContain("getSellerUsage");
    expect(source).toContain('from "@/server/billing/seller-usage"');
  });

  it("does NOT render Meal plans via entitlement.limits directly in page JSX (now inside PlanLimitRows)", () => {
    // Old production bug: the page JSX contained
    //   <LimitRow label="Meal plans" value={entitlement.limits.maxMealPlans} />
    // for ALL org types. The fix moves it inside PlanLimitRows where it only
    // renders for the Household fallback branch. PlanLimitRows uses destructured
    // `limits` (not `entitlement.limits`), so this pattern must not appear.
    expect(source).not.toContain('label="Meal plans" value={entitlement.limits.maxMealPlans}');
    expect(source).toContain("<PlanLimitRows");
  });

  it("does NOT render Grocery lists via entitlement.limits directly in page JSX", () => {
    expect(source).not.toContain('label="Grocery lists per month" value={entitlement.limits.maxGroceryListsPerMonth}');
  });

  it("renders Active services for chef_staff audience", () => {
    expect(source).toContain('"Active services"');
  });

  it("renders Bookings per month for chef_staff audience", () => {
    expect(source).toContain('"Bookings per month"');
  });

  it("renders Menu items row for chef_staff audience", () => {
    // Chef Free has 5 menu items — this limit must be visible on the billing page.
    expect(source).toContain('"Menu items"');
  });

  it("uses planDisplayName instead of hardcoded 'Free / Starter'", () => {
    expect(source).toContain("planDisplayName");
    expect(source).not.toContain('"Free / Starter"');
  });

  it("uses planDisplayDescription with audience-specific fallback", () => {
    expect(source).toContain("planDisplayDescription");
    expect(source).toContain("chef_business");
    expect(source).not.toContain('"household or seller workflow"');
  });

  it("defines resolveDisplayAudience to handle planAudience=none for chef orgs", () => {
    expect(source).toContain("resolveDisplayAudience");
    expect(source).toContain('"chef_business"');
    expect(source).toContain('"chef_staff"');
  });

  it("passes sellerUsage.metrics to PlanLimitRows (audience-aware rendering)", () => {
    expect(source).toContain("sellerUsage.metrics");
    expect(source).toContain("PlanLimitRows");
  });
});

// ── Group 5: seller-usage source — chef metrics (no household leakage) ────────

describe("seller-usage.ts — chef_staff metric tracking", () => {
  const source = readFileSync("src/server/billing/seller-usage.ts", "utf8");

  it("tracks services count for chef_staff audience", () => {
    expect(source).toContain('planAudience === "chef_staff"');
    expect(source).toContain('"services"');
  });

  it("tracks bookings count for chef_staff audience (when limit > 0)", () => {
    expect(source).toContain('"bookings"');
    expect(source).toContain("maxBookingsPerMonth > 0");
  });

  it("does NOT add meal_plan or grocery_list metrics for chef_staff", () => {
    // These are Household-only usage events and must never appear in seller metrics.
    expect(source).not.toContain('"meal_plan"');
    expect(source).not.toContain('"meal_plans"');
    expect(source).not.toContain('"grocery_list"');
    expect(source).not.toContain('"grocery_lists"');
  });

  it("tracks menuItems for restaurant and home_catering (not chef_staff)", () => {
    // menuItems are tracked only for restaurant + catering audiences.
    expect(source).toContain('"menuItems"');
    expect(source).toMatch(/planAudience === "restaurant" \|\| planAudience === "home_catering"/);
  });

  it("tracks staff for any audience when maxStaffMembers > 0", () => {
    // Staff is cross-audience (chef Professional and restaurant plans include staff seats).
    expect(source).toContain('"staff"');
    expect(source).toContain("maxStaffMembers > 0");
  });
});

// ── Group 6: Cross-audience regression ───────────────────────────────────────

describe("cross-audience regression — billing page renders correct rows per audience", () => {
  const source = readFileSync("src/app/(app)/billing/page.tsx", "utf8");

  it("Household fallback still renders Meal plans and Grocery lists rows", () => {
    // PlanLimitRows fallthrough (audience = household) must still show household fields.
    const planLimitRowsFn = source.slice(
      source.indexOf("function PlanLimitRows"),
      source.indexOf("\nfunction LimitRow"),
    );
    expect(planLimitRowsFn).toContain('"Meal plans"');
    expect(planLimitRowsFn).toContain('"Grocery lists per month"');
    expect(planLimitRowsFn).toContain('"Household members"');
    expect(planLimitRowsFn).toContain('"Saved restaurants"');
  });

  it("Restaurant audience renders Menu items and Orders per month rows", () => {
    const planLimitRowsFn = source.slice(
      source.indexOf("function PlanLimitRows"),
      source.indexOf("\nfunction LimitRow"),
    );
    expect(planLimitRowsFn).toContain('"Orders per month"');
    expect(planLimitRowsFn).toContain('"Locations"');
  });

  it("Catering audience renders Packages and Orders per month rows", () => {
    const planLimitRowsFn = source.slice(
      source.indexOf("function PlanLimitRows"),
      source.indexOf("\nfunction LimitRow"),
    );
    expect(planLimitRowsFn).toContain('"Packages"');
  });

  it("Chef Free effective service limit is 1 (from catalog)", () => {
    const chefFree = PLAN_CATALOG.find((p) => p.slug === "home-chef-free");
    expect(chefFree!.limitsJson.maxActiveServices).toBe(1);
    expect(isUnlimited(chefFree!.limitsJson.maxActiveServices)).toBe(false);
  });

  it("Chef Growth effective service limit is unlimited (from catalog)", () => {
    const chefGrowth = PLAN_CATALOG.find((p) => p.slug === "home-chef-growth-monthly");
    expect(chefGrowth!.limitsJson.maxActiveServices).toBe(-1);
    expect(isUnlimited(chefGrowth!.limitsJson.maxActiveServices)).toBe(true);
  });

  it("FALLBACK_ENTITLEMENT (no subscription) planAudience is 'none' — not 'household'", () => {
    // The fallback must never silently adopt Household limits for an org
    // that has no subscription. Source check verifies the sentinel.
    const entSource = readFileSync("src/server/billing/entitlements.ts", "utf8");
    expect(entSource).toContain('planAudience: "none"');
    expect(entSource).not.toMatch(/FALLBACK_ENTITLEMENT[\s\S]{0,200}planAudience: "household"/);
  });
});

// ── Group 7: Staff enforcement — Chef Free 1-seat business rule ───────────────
//
// Required tests for the corrected Chef Free maxStaffMembers = 1 business rule.
// Business rule (finalized): Chef Free → 1 staff seat. Professional → 10 staff seats.
// Chef Growth staff policy is unspecified in finalized rules; current value (0) retained.

describe("staff enforcement — Chef Free maxStaffMembers = 1 business rule", () => {
  // Test 1: effective limit in catalog (maxStaffMembers = 1 for Chef Free)
  // — already covered in Group 1 ("home-chef-free: maxStaffMembers = 1")

  // Test 2: Billing page renders staff row for plans where limit > 0
  it("billing/page.tsx: staff row shown when maxStaffMembers > 0 (Chef Free = 1)", () => {
    const source = readFileSync("src/app/(app)/billing/page.tsx", "utf8");
    // The billing page must gate the staff row on the numeric limit, not a feature flag.
    expect(source).toContain("maxStaffMembers > 0");
    expect(source).toContain('"Staff members"');
  });

  // Test 3: canInviteStaff returns true for Chef Free (maxStaffMembers = 1) — first seat allowed
  it("canInviteStaff: maxStaffMembers=1 (Chef Free) → true (first staff member permitted)", () => {
    const stub = { limits: { maxStaffMembers: 1 } } as unknown as Entitlement;
    expect(canInviteStaff(stub)).toBe(true);
  });

  // Test 4: canInviteStaff returns false for Chef Growth (maxStaffMembers = 0) — no seats, blocks immediately
  it("canInviteStaff: maxStaffMembers=0 (Chef Growth) → false (no staff seats on this plan)", () => {
    const stub = { limits: { maxStaffMembers: 0 } } as unknown as Entitlement;
    expect(canInviteStaff(stub)).toBe(false);
  });

  // Test 3+4 cont: assertStaffLimit enforcement logic (requires DB — verified via source)
  it("assertStaffLimit: skips at limit=0, throws STAFF_LIMIT_EXCEEDED when current >= limit", () => {
    const source = readFileSync("src/server/billing/enforcement.ts", "utf8");
    // limit=0: return early (plan has no staff feature — invitation is separately blocked by canInviteStaff)
    expect(source).toContain("if (limit === 0) return;");
    // limit=1, current=0: 0 < 1 → no throw (first member allowed)
    // limit=1, current=1: 1 >= 1 → throws (second member blocked)
    expect(source).toContain("if (current >= limit)");
    expect(source).toContain("STAFF_LIMIT_EXCEEDED");
  });

  // Test 5: Seller billing and server enforcement agree — canInviteStaff checks numeric limit only
  it("canInviteStaff: reads maxStaffMembers numeric limit, not features.staffAccounts boolean", () => {
    const source = readFileSync("src/server/billing/entitlements.ts", "utf8");
    const fnStart = source.indexOf("export function canInviteStaff");
    const fnEnd = source.indexOf("\n}", fnStart) + 2;
    const fnBody = source.slice(fnStart, fnEnd);
    expect(fnBody).toContain("maxStaffMembers");
    expect(fnBody).not.toContain("staffAccounts");
  });

  // Test 5 cont: buildEntitlement derives staffAccounts from numeric limit, not tier matrix
  it("buildEntitlement: staffAccounts derived from maxStaffMembers (overrides TIER_SELLER_FEATURES tier boolean)", () => {
    const source = readFileSync("src/server/billing/entitlements.ts", "utf8");
    // The override after spreading TIER_SELLER_FEATURES ensures Chef Free (limit=1) gets
    // staffAccounts=true even though the free tier matrix has staffAccounts=false.
    expect(source).toContain("staffAccounts: toPublicLimit(limitsJson.maxStaffMembers) > 0");
  });

  // Test 6: Household limits do not appear on Chef billing (covered in Group 4)
  // — see "does NOT render Meal plans via entitlement.limits directly in page JSX"

  // Test 7: Restaurant and Catering Free plans are NOT affected — still 0 staff (regression)
  it("cross-audience regression: Catering Free and Restaurant Free retain maxStaffMembers = 0", () => {
    const cateringFree = PLAN_CATALOG.find((p) => p.slug === "catering-free");
    const restaurantFree = PLAN_CATALOG.find((p) => p.slug === "restaurant-free");
    expect(cateringFree).toBeDefined();
    expect(restaurantFree).toBeDefined();
    expect(cateringFree?.limitsJson.maxStaffMembers).toBe(0);
    expect(restaurantFree?.limitsJson.maxStaffMembers).toBe(0);
  });

  // Test 8: Chef Growth maxStaffMembers unchanged — not accidentally downgraded by stale feature-gate logic
  it("home-chef-growth-monthly: maxStaffMembers not altered (established catalog value 0 preserved)", () => {
    const chefGrowth = PLAN_CATALOG.find((p) => p.slug === "home-chef-growth-monthly");
    // Chef Growth staff policy (0) is retained unchanged. The finalized product spec defines
    // only Chef Free (1) and Professional (10). Growth is not specified; catalog value is authoritative.
    expect(chefGrowth?.limitsJson.maxStaffMembers).toBe(0);
  });
});
