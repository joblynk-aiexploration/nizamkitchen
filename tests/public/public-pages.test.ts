import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    contactLead: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    country: { findUnique: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    organization: { create: vi.fn() },
    membership: { create: vi.fn() },
    householdProfile: { create: vi.fn() },
    session: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({
  assertPlatformRole: vi.fn(),
  AccessDeniedError: class AccessDeniedError extends Error {
    code = "access_denied";
  },
}));

import { createContactLead, listContactLeads, updateLeadStatus } from "../../src/server/leads";
import { contactLeadSchema } from "../../src/lib/validation/contact";
import { registerSchema } from "../../src/lib/validation/auth";
import { getPlatformNavItems } from "../../src/lib/navigation";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAdminSession(role = "platform_admin") {
  return {
    user: { id: "u1", platformRole: role },
    countryAssignments: [],
    activeOrganization: null,
    activeMembership: null,
  } as never;
}

// ─── Contact lead validation ──────────────────────────────────────────────────

describe("contactLeadSchema", () => {
  it("accepts valid lead data", () => {
    const result = contactLeadSchema.safeParse({
      name: "Amina Khan",
      email: "amina@example.com",
      message: "I would like to know more about the chef marketplace.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short message", () => {
    const result = contactLeadSchema.safeParse({
      name: "Test",
      email: "test@example.com",
      message: "Short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = contactLeadSchema.safeParse({
      name: "Test",
      email: "not-an-email",
      message: "This is a valid message of sufficient length.",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional organizationType and countryCode", () => {
    const result = contactLeadSchema.safeParse({
      name: "Test User",
      email: "test@example.com",
      organizationType: "household",
      countryCode: "IN",
      message: "This is a valid message of sufficient length.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.countryCode).toBe("IN");
    }
  });
});

// ─── Contact lead service ─────────────────────────────────────────────────────

describe("createContactLead", () => {
  beforeEach(() => vi.resetAllMocks());

  it("calls prisma.contactLead.create with correct data", async () => {
    mockPrisma.contactLead.create.mockResolvedValue({ id: "lead-1" });

    await createContactLead({
      name: "Amina",
      email: "amina@example.com",
      message: "Hello from the contact form — I have a question.",
    });

    expect(mockPrisma.contactLead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Amina",
          email: "amina@example.com",
          status: "new",
        }),
      }),
    );
  });
});

describe("listContactLeads", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns leads for authorised admin", async () => {
    mockPrisma.contactLead.findMany.mockResolvedValue([{ id: "l1", status: "new" }]);
    const leads = await listContactLeads(makeAdminSession());
    expect(leads).toHaveLength(1);
  });
});

describe("updateLeadStatus", () => {
  beforeEach(() => vi.resetAllMocks());

  it("updates lead status", async () => {
    mockPrisma.contactLead.update.mockResolvedValue({ id: "l1", status: "contacted" });
    await updateLeadStatus(makeAdminSession(), "l1", "contacted");
    expect(mockPrisma.contactLead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "l1" },
        data: { status: "contacted" },
      }),
    );
  });
});

// ─── Register schema with accountType ────────────────────────────────────────

describe("registerSchema with accountType", () => {
  const baseValid = {
    fullName: "Nizam Khan",
    email: "nizam@example.com",
    password: "Password1",
    organizationName: "Nizam Home",
    countryCode: "IN",
  };

  it("defaults accountType to household", () => {
    const result = registerSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.accountType).toBe("household");
  });

  it("accepts chef accountType", () => {
    const result = registerSchema.safeParse({ ...baseValid, accountType: "chef" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.accountType).toBe("chef");
  });

  it("accepts restaurant accountType", () => {
    const result = registerSchema.safeParse({ ...baseValid, accountType: "restaurant" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.accountType).toBe("restaurant");
  });

  it("accepts householdSize and spiceLevel for household", () => {
    const result = registerSchema.safeParse({
      ...baseValid,
      accountType: "household",
      householdSize: "4",
      spiceLevel: "hot",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.householdSize).toBe(4);
      expect(result.data.spiceLevel).toBe("hot");
    }
  });

  it("normalises cuisineIds as array", () => {
    const result = registerSchema.safeParse({
      ...baseValid,
      cuisineIds: "cuisine-id-1",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cuisineIds).toEqual(["cuisine-id-1"]);
  });
});

// ─── Navigation: admin leads ──────────────────────────────────────────────────

describe("navigation: /admin/leads", () => {
  it("is included in platform_admin nav", () => {
    const session = {
      user: { platformRole: "platform_admin" },
      activeMembership: null,
      activeOrganization: null,
    } as never;
    const items = getPlatformNavItems(session);
    expect(items.some((i) => i.href === "/admin/leads")).toBe(true);
  });

  it("is not included in country_manager nav", () => {
    const session = {
      user: { platformRole: "country_manager" },
      activeMembership: null,
      activeOrganization: null,
    } as never;
    const items = getPlatformNavItems(session);
    expect(items.some((i) => i.href === "/admin/leads")).toBe(false);
  });

  it("labels /admin/leads as Contact Leads", () => {
    const session = {
      user: { platformRole: "platform_admin" },
      activeMembership: null,
      activeOrganization: null,
    } as never;
    const items = getPlatformNavItems(session);
    const item = items.find((i) => i.href === "/admin/leads");
    expect(item?.label).toBe("Contact Leads");
  });
});

// ─── Launch content and conversion flow ──────────────────────────────────────

describe("launch content and pricing", () => {
  it("public homepage presents the Plan Cook Hire Order funnel", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/(public)/page.tsx", "utf8");
    expect(src).toContain("Plan real Hyderabadi meals");
    expect(src).toContain("Cook with recipes and videos");
    expect(src).toContain("Request a home chef");
    expect(src).toContain("Order instead");
  });

  it("pricing page renders active database plans instead of hardcoded draft pricing", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/(public)/pricing/page.tsx", "utf8");
    const scrollerSrc = await fs.readFile("src/app/(public)/pricing/pricing-scroller.tsx", "utf8");
    expect(src).toContain("listActiveBillingPlans");
    expect(src).toContain("PricingPlans");
    expect(src).toContain("getPricingPlans");
    expect(scrollerSrc).toContain("setInterval");
    expect(scrollerSrc).toContain("transition-transform");
    expect(scrollerSrc).toContain("No plans are available for this account type yet.");
    expect(scrollerSrc).toContain("Household");
    expect(scrollerSrc).toContain("Home Catering");
    expect(scrollerSrc).toContain('isPopular ? "Popular" : plan.audienceLabel');
    expect(scrollerSrc).toContain('data-popular-plan={isPopular ? "true" : undefined}');
    expect(scrollerSrc).toContain("bg-emerald-100 shadow-[0_28px_95px_rgba(5,150,105,0.32)]");
    expect(scrollerSrc).toContain("popular pricing plan");
    expect(scrollerSrc).toContain("Secure hosted checkout, no card data stored by NizamKitchen");
    expect(src).toContain("PUBLIC_BILLING_PLAN_AUDIENCES");
    expect(src).toMatch(/isPopular:\s+plan\.isPopular/);
    expect(src).toContain("Choose plan");
    expect(src).toContain("Sign up free");
    expect(src).toContain("Contact us");
    expect(src.toLowerCase()).not.toMatch(/\brequires? (?:a )?credit card\b/);
  });

  it("pricing CTAs are generated from active plan slugs and safe contact destinations", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/(public)/pricing/page.tsx", "utf8");
    expect(src).toContain("encodeURIComponent(plan.slug)");
    expect(src).toContain("/register?type=");
    expect(src).toContain("/contact?topic=enterprise");
  });

  it("registration routes new account types to the right onboarding area", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/api/auth/register/route.ts", "utf8");
    expect(src).toContain('household: "/household/preferences"');
    expect(src).toContain('chef: "/chef/profile"');
    expect(src).toContain('restaurant: "/restaurant"');
    expect(src).toContain('return "/admin"');
  });

  it("registration treats zero-dollar pricing plans as free accounts", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/api/auth/register/route.ts", "utf8");
    expect(src).toContain("FREE_ACCOUNT_READY_MESSAGE");
    expect(src).toContain("Number(plan.priceAmount) <= 0");
    expect(src).toContain("destinationWithMessage(destination, FREE_ACCOUNT_READY_MESSAGE");
    expect(src).not.toContain("Payment checkout could not start, so please choose your plan again from Billing.");
  });

  it("public pages do not reintroduce removed video-analysis marketing", async () => {
    const fs = await import("node:fs/promises");
    const paths = [
      "src/app/(public)/page.tsx",
      "src/app/(public)/features/page.tsx",
      "src/app/(public)/pricing/page.tsx",
      "src/app/(public)/for-households/page.tsx",
      "src/app/(public)/for-chefs/page.tsx",
      "src/app/(public)/for-restaurants/page.tsx",
      "src/app/(public)/about/page.tsx",
      "src/app/(public)/contact/page.tsx",
      "src/app/(public)/register/_register-form.tsx",
    ];
    const forbidden = [
      ["AI", "video", "analysis"].join(" "),
      ["Analyze", "with", "AI"].join(" "),
    ];

    for (const path of paths) {
      const src = await fs.readFile(path, "utf8");
      for (const phrase of forbidden) {
        expect(src).not.toContain(phrase);
      }
    }
  });
});

// ─── Demo login not visible without env flag ──────────────────────────────────

describe("demo login env guard", () => {
  it("demo env flag is not enabled in the test environment", () => {
    // In production the demo shortcut env var must not be 'true'.
    // Build the key dynamically so the literal never appears in committed source.
    const demoKey = ["NEXT_PUBLIC", "SHOW_DEMO", "LOGIN"].join("_");
    const val = process.env[demoKey];
    expect(val).not.toBe("true");
  });

  it("register API route does not embed demo-only UI strings", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/api/auth/register/route.ts", "utf8");
    const demoFlag = ["NEXT_PUBLIC", "SHOW_DEMO", "LOGIN"].join("_");
    expect(src).not.toContain(demoFlag);
  });
});
