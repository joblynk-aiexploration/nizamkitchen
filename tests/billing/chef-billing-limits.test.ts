import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_CATALOG } from "@/server/billing/plan-catalog";
import { isUnlimited } from "@/server/billing/entitlements";

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

  it("home-chef-free: maxStaffMembers = 0 (staff is a Professional+ feature, not Free)", () => {
    // 0 means staff accounts are NOT a feature of this plan tier.
    // Catering Free and Restaurant Free are both 0; Chef Free was incorrectly 1 (catalog typo).
    // Fixed to 0 to match the cross-audience pattern and TIER_SELLER_FEATURES.free.staffAccounts=false.
    // canInviteStaff() requires maxStaffMembers > 0, so Free correctly blocks staff invitations.
    expect(chefFree?.limitsJson.maxStaffMembers).toBe(0);
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
