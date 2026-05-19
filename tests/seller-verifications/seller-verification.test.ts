import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockAudit } = vi.hoisted(() => ({
  mockPrisma: {
    sellerVerificationProfile: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    sellerVerificationRequirement: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    sellerVerificationItem: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    sellerAttestation: { create: vi.fn() },
    sellerBackgroundCheck: { findMany: vi.fn() },
    kitchenSafetyReview: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    kitchenSafetyPhoto: { create: vi.fn() },
    storageFile: { findFirst: vi.fn() },
  },
  mockAudit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: mockAudit }));

import {
  acceptSellerAttestation,
  getOrCreateSellerVerificationProfile,
  getPublicSellerVerificationBadge,
  listRequirementsForSeller,
  reviewSellerVerificationItem,
  reviewSellerVerificationProfile,
  safeVerificationBadge,
  submitKitchenSafetyPhoto,
  submitSellerVerificationForReview,
  submitSellerVerificationDocument,
  upsertSellerVerificationRequirement,
} from "@/server/seller-verifications";
import { canAccessStorageFile } from "@/server/storage/storage-permissions";

function sellerSession(organizationType = "home_catering") {
  return {
    user: { id: "seller-1", email: "seller@example.test", status: "active", platformRole: null },
    activeOrganization: { id: "seller-org", countryCode: "US", organizationType, name: "Seller Org" },
    activeMembership: { role: organizationType === "restaurant" ? "restaurant_owner" : organizationType === "chef_business" ? "chef_owner" : "org_owner", status: "active" },
    countryAssignments: [],
  } as never;
}

function adminSession(role = "platform_admin") {
  return {
    user: { id: "admin-1", email: "admin@example.test", status: "active", platformRole: role },
    countryAssignments: [{ countryCode: "US" }],
  } as never;
}

describe("seller verification infrastructure", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue(null);
    mockPrisma.sellerVerificationProfile.create.mockImplementation(async ({ data }) => ({ id: "profile-1", items: [], attestations: [], backgroundChecks: [], kitchenReviews: [], organization: { id: data.organizationId, name: "Seller Org", countryCode: data.countryCode }, ...data }));
    mockPrisma.sellerVerificationProfile.update.mockImplementation(async ({ data }) => ({ id: "profile-1", organizationId: "seller-org", countryCode: "US", ...data }));
    mockPrisma.sellerVerificationRequirement.findMany.mockResolvedValue([]);
    mockPrisma.sellerVerificationRequirement.create.mockImplementation(async ({ data }) => ({ id: "req-1", ...data }));
    mockPrisma.sellerVerificationItem.findFirst.mockResolvedValue(null);
    mockPrisma.sellerVerificationItem.findUnique.mockResolvedValue({ id: "item-1", verificationProfileId: "profile-1", verificationProfile: { id: "profile-1", organizationId: "seller-org", countryCode: "US" } });
    mockPrisma.sellerVerificationItem.create.mockImplementation(async ({ data }) => ({ id: "item-1", ...data }));
    mockPrisma.sellerVerificationItem.update.mockImplementation(async ({ data }) => ({ id: "item-1", verificationProfileId: "profile-1", ...data }));
    mockPrisma.storageFile.findFirst.mockResolvedValue({ id: "file-1", organizationId: "seller-org", status: "active" });
  });

  it("creates verification profiles for home catering, chef, and restaurant sellers", async () => {
    await getOrCreateSellerVerificationProfile(sellerSession("home_catering"));
    await getOrCreateSellerVerificationProfile(sellerSession("chef_business"));
    await getOrCreateSellerVerificationProfile(sellerSession("restaurant"));

    expect(mockPrisma.sellerVerificationProfile.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sellerType: "home_catering" }) }));
    expect(mockPrisma.sellerVerificationProfile.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sellerType: "chef_business" }) }));
    expect(mockPrisma.sellerVerificationProfile.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sellerType: "restaurant" }) }));
  });

  it("uploads a food handler certificate as a private S3-backed verification item", async () => {
    await submitSellerVerificationDocument(sellerSession("home_catering"), {
      requirementType: "food_handler_certificate",
      documentFileId: "file-1",
      expiresAt: "2027-01-01",
    });

    expect(mockPrisma.storageFile.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "file-1", organizationId: "seller-org" }) }));
    expect(mockPrisma.sellerVerificationItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ documentFileId: "file-1", status: "submitted" }) }));
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "seller_verification_item.submitted" }));
  });

  it("resubmits a rejected verification item instead of creating a duplicate", async () => {
    mockPrisma.sellerVerificationItem.findFirst.mockResolvedValue({ id: "item-rejected", status: "rejected" });

    await submitSellerVerificationDocument(sellerSession("chef_business"), {
      requirementType: "food_handler_certificate",
      documentFileId: "file-1",
      expiresAt: "2027-01-01",
    });

    expect(mockPrisma.sellerVerificationItem.create).not.toHaveBeenCalled();
    expect(mockPrisma.sellerVerificationItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "item-rejected" },
      data: expect.objectContaining({ status: "submitted", rejectionReason: null }),
    }));
  });

  it("records attestations, background consent, kitchen photos, and review submission audits", async () => {
    mockPrisma.sellerAttestation.create.mockImplementation(async ({ data }) => ({ id: "attestation-1", ...data }));
    mockPrisma.kitchenSafetyReview.findFirst.mockResolvedValue(null);
    mockPrisma.kitchenSafetyReview.create.mockImplementation(async ({ data }) => ({ id: "review-1", ...data }));
    mockPrisma.kitchenSafetyPhoto.create.mockImplementation(async ({ data }) => ({ id: "photo-1", ...data }));

    await acceptSellerAttestation(sellerSession(), {
      attestationType: "background_check_consent",
      version: "v1",
      textSnapshot: "I authorize a background check for seller verification.",
    });
    await submitKitchenSafetyPhoto(sellerSession(), {
      fileId: "file-1",
      category: "cooking_area",
      caption: "Clean cooking area",
    });
    await submitSellerVerificationForReview(sellerSession());

    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "background_check.consent_collected" }));
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "kitchen_safety_review.submitted" }));
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "seller_verification.submitted" }));
  });

  it("blocks household access to private verification documents by storage permission", () => {
    const file = { organizationId: "seller-org", uploadedById: "seller-1", visibility: "private", status: "active", countryCode: "US" } as never;
    const household = { user: { id: "household-1", status: "active", platformRole: null }, activeOrganization: { id: "household-org", countryCode: "US", organizationType: "household" } } as never;
    expect(canAccessStorageFile(household, file)).toBe(false);
  });

  it("filters configured requirements by country, region, and seller type", async () => {
    mockPrisma.sellerVerificationRequirement.findMany.mockResolvedValue([{ id: "req-us", sellerType: "home_catering", requirementType: "local_permit", countryCode: "US", region: "TX", title: "Texas permit" }]);
    const requirements = await listRequirementsForSeller({ countryCode: "US", region: "TX", sellerType: "home_catering" });
    expect(requirements[0].title).toBe("Texas permit");
    expect(mockPrisma.sellerVerificationRequirement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ sellerType: "home_catering", isActive: true }),
    }));
  });

  it("admin can configure requirements and review items, while seller cannot self-approve", async () => {
    await upsertSellerVerificationRequirement(adminSession(), {
      sellerType: "chef_business",
      requirementType: "background_check",
      title: "Background consent",
      isRequired: true,
    });
    await reviewSellerVerificationItem(adminSession(), { itemId: "item-1", status: "approved" });
    await expect(reviewSellerVerificationItem(sellerSession(), { itemId: "item-1", status: "approved" })).rejects.toThrow();

    expect(mockPrisma.sellerVerificationRequirement.create).toHaveBeenCalled();
    expect(mockPrisma.sellerVerificationItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "approved", reviewedById: "admin-1" }) }));
  });

  it("admin can reject or expire a profile without exposing private verification details", async () => {
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue({ id: "profile-1", organizationId: "seller-org", countryCode: "US" });

    await reviewSellerVerificationProfile(adminSession(), {
      profileId: "profile-1",
      status: "rejected",
      verificationLevel: "unverified",
      rejectionReason: "Certificate expired.",
      adminNotes: "Ask seller for a current certificate.",
    });

    expect(mockPrisma.sellerVerificationProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "rejected", rejectionReason: "Certificate expired.", reviewedById: "admin-1" }),
    }));
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "seller_verification.rejected" }));
  });

  it("returns safe public verification badges without private details", async () => {
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue({ status: "verified", verificationLevel: "fully_verified" });
    await expect(getPublicSellerVerificationBadge("seller-org")).resolves.toEqual({ label: "Fully verified", tone: "success" });
    expect(safeVerificationBadge({ status: "under_review", verificationLevel: "background_checked" })).toEqual({ label: "Unverified", tone: "neutral" });
  });

  it("does not add raw SSN fields or public document exposure in source", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const pages = fs.readFileSync(path.join(process.cwd(), "src/components/seller-verifications/seller-verification-page.tsx"), "utf8");
    const publicChef = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/chefs/[slug]/page.tsx"), "utf8");
    expect(schema).not.toMatch(/\b(ssn|social_security|nationalIdNumber)\b/i);
    expect(pages).toContain('visibility="private"');
    expect(publicChef).not.toContain("documentFileId");
  });
});
