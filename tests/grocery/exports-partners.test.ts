import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, createAuditEvent, isFeatureEnabled, getGroceryList } = vi.hoisted(() => ({
  mockPrisma: {
    groceryListShare: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    groceryListExport: {
      create: vi.fn(),
    },
    groceryPartner: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    emailLog: {
      create: vi.fn(),
    },
  },
  createAuditEvent: vi.fn(),
  isFeatureEnabled: vi.fn(),
  getGroceryList: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled }));
vi.mock("@/server/grocery", () => ({ getGroceryList }));

import {
  createGroceryListShare,
  getSharedGroceryList,
  groceryListToCsv,
  groceryListToPdf,
  listActiveGroceryPartners,
  listAdminGroceryPartners,
  revokeGroceryListShare,
  upsertGroceryPartner,
} from "../../src/server/grocery-partners";

function makeList() {
  return {
    id: "list-1",
    name: "Weekly groceries",
    countryCode: "US",
    createdAt: new Date("2026-05-18T12:00:00Z"),
    recipes: [{ id: "glr-1", recipeNameSnapshot: "Biryani", targetServings: 4 }],
    warnings: [],
    items: [
      {
        id: "item-1",
        category: "vegetable",
        canonicalIngredientName: "Onion",
        displayQuantity: 2,
        displayUnit: "pieces",
        notes: null,
        sources: [{ id: "src-1", recipeNameSnapshot: "Biryani" }],
      },
      {
        id: "item-2",
        category: "grain",
        canonicalIngredientName: "Basmati Rice",
        displayQuantity: 1.5,
        displayUnit: "kg",
        notes: "aged rice preferred",
        sources: [{ id: "src-2", recipeNameSnapshot: "Biryani" }],
      },
    ],
  } as never;
}

const adminSession = {
  user: { id: "admin-1", email: "admin@example.test", status: "active" as const, platformRole: "platform_admin" as const },
  countryAssignments: [],
};

const householdSession = {
  user: { id: "household-1", email: "household@example.test", status: "active" as const, platformRole: null },
  countryAssignments: [],
};

describe("grocery exports and partner foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports grocery lists as CSV", () => {
    const csv = groceryListToCsv(makeList());

    expect(csv).toContain("item name,quantity,unit,category,source recipes,notes");
    expect(csv).toContain("Onion,2,pieces,vegetable,Biryani,");
    expect(csv).toContain("Basmati Rice,1.5,kg,grain,Biryani,aged rice preferred");
  });

  it("builds a PDF buffer without crashing", () => {
    const pdf = groceryListToPdf(makeList());

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.toString("utf8", 0, 8)).toBe("%PDF-1.4");
  });

  it("creates tokenized share links with only a hash stored", async () => {
    getGroceryList.mockResolvedValue(makeList());
    mockPrisma.groceryListShare.create.mockResolvedValue({ id: "share-1", groceryListId: "list-1" });
    mockPrisma.groceryListExport.create.mockResolvedValue({ id: "export-1" });

    const result = await createGroceryListShare("list-1", "org-1", "user-1", { expiresInDays: 7 });

    expect(result.token).toEqual(expect.any(String));
    expect(mockPrisma.groceryListShare.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          tokenHash: expect.not.stringContaining(result.token),
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "grocery_list.share_created" }));
  });

  it("blocks revoked share links", async () => {
    mockPrisma.groceryListShare.findUnique.mockResolvedValue({
      id: "share-1",
      revokedAt: new Date(),
      expiresAt: null,
      groceryList: makeList(),
    });

    await expect(getSharedGroceryList("raw-token")).resolves.toBeNull();
  });

  it("revokes share links only inside the owning organization", async () => {
    mockPrisma.groceryListShare.findFirst.mockResolvedValue({ id: "share-1", groceryListId: "list-1", organizationId: "org-1" });
    mockPrisma.groceryListShare.update.mockResolvedValue({ id: "share-1", revokedAt: new Date() });

    await revokeGroceryListShare("share-1", "list-1", "org-1", "user-1");

    expect(mockPrisma.groceryListShare.findFirst).toHaveBeenCalledWith({
      where: { id: "share-1", groceryListId: "list-1", organizationId: "org-1" },
    });
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "grocery_list.share_revoked" }));
  });

  it("shows active grocery partners by country only when feature flag is enabled", async () => {
    isFeatureEnabled.mockResolvedValue(true);
    mockPrisma.groceryPartner.findMany.mockResolvedValue([{ id: "partner-1", countryCode: "US", status: "active" }]);

    await listActiveGroceryPartners("US", "org-1");

    expect(mockPrisma.groceryPartner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryCode: "US", status: "active" } }),
    );
  });

  it("hides partners when grocery_partners is disabled", async () => {
    isFeatureEnabled.mockResolvedValue(false);

    await expect(listActiveGroceryPartners("US", "org-1")).resolves.toEqual([]);
    expect(mockPrisma.groceryPartner.findMany).not.toHaveBeenCalled();
  });

  it("does not allow household users to manage partners", async () => {
    await expect(upsertGroceryPartner(householdSession as never, null, {
      countryCode: "US",
      name: "Partner",
      integrationType: "export_only",
      status: "active",
    })).rejects.toThrow("Platform role is required");
  });

  it("allows platform admin to manage partners and logs audit", async () => {
    mockPrisma.groceryPartner.create.mockResolvedValue({ id: "partner-1", countryCode: "US" });

    await upsertGroceryPartner(adminSession as never, null, {
      countryCode: "US",
      name: "Local Grocery",
      websiteUrl: "https://example.com",
      integrationType: "manual_link",
      status: "active",
    });

    expect(mockPrisma.groceryPartner.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ countryCode: "US", status: "active" }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "grocery_partner.created" }));
  });

  it("scopes country manager partner listings to assigned countries", async () => {
    mockPrisma.groceryPartner.findMany.mockResolvedValue([]);
    const countryManager = {
      user: { id: "country-1", email: "country@example.test", status: "active" as const, platformRole: "country_manager" as const },
      countryAssignments: [{ countryCode: "US" }],
    };

    await listAdminGroceryPartners(countryManager as never, {});

    expect(mockPrisma.groceryPartner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ countryCode: { in: ["US"] } }),
      }),
    );
  });
});
