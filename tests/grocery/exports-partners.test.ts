import fs from "node:fs";
import path from "node:path";
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
  groceryListToClipboardText,
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

  it("formats copied grocery lists like a professional shopping checklist", () => {
    const text = groceryListToClipboardText(makeList());

    expect(text).toContain("NizamKitchen\nWeekly groceries");
    expect(text).toContain("1 recipe · 2 ingredients · Generated 5/18/2026");
    expect(text).toContain("Recipes\n- Biryani - 4 servings");
    expect(text).toContain("Vegetable\n[ ] 2 pieces Onion");
    expect(text).toContain("Grain\n[ ] 1.5 kg Basmati Rice");
    expect(text).toContain("Note: aged rice preferred");
  });

  it("keeps grocery print view focused on the list instead of the app dashboard", () => {
    const printPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/grocery-lists/[id]/print/page.tsx"), "utf8");
    const printActions = fs.readFileSync(path.join(process.cwd(), "src/components/grocery/print-grocery-list-actions.tsx"), "utf8");

    expect(printPage).toContain("body aside { display: none");
    expect(printPage).toContain("body main { min-height: auto");
    expect(printPage).toContain("Generated {generatedDate}");
    expect(printPage).toContain("PrintGroceryListActions");
    expect(printActions).toContain("Print");
    expect(printActions).toContain("window.print()");
    expect(printPage).not.toContain("window.print");
  });

  it("shows grocery partner logos when configured on export partner cards", () => {
    const exportPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/grocery-lists/[id]/export/page.tsx"), "utf8");

    expect(exportPage).toContain("partner.logoUrl");
    expect(exportPage).toContain("alt={`${partner.name} logo`}");
    expect(exportPage).toContain("partner.name.slice(0, 2).toUpperCase()");
  });

  it("uses a check mark instead of a dot for checked grocery items", () => {
    const listPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/grocery-lists/[id]/page.tsx"), "utf8");

    expect(listPage).toContain("✓");
    expect(listPage).not.toContain("block h-2.5 w-2.5 rounded-full");
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
    const longLogoUrl = `https://cdn.example.com/logo.png?token=${"a".repeat(1200)}`;

    await upsertGroceryPartner(adminSession as never, null, {
      countryCode: "US",
      name: "Local Grocery",
      websiteUrl: "https://example.com",
      logoUrl: longLogoUrl,
      integrationType: "manual_link",
      status: "active",
    });

    expect(mockPrisma.groceryPartner.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ countryCode: "US", status: "active", logoUrl: longLogoUrl }),
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
