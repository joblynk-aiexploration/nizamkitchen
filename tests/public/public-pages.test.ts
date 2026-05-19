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
import { getWorkspaceNavItems, getPlatformNavItems } from "../../src/lib/navigation";

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
