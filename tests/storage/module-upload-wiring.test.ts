import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockAudit } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    localizationLocale: { findMany: vi.fn() },
    storageFile: { findFirst: vi.fn() },
    menu: { findFirst: vi.fn() },
    menuItem: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    menuItemAvailability: { deleteMany: vi.fn(), create: vi.fn() },
    sellerVerificationPolicy: { findMany: vi.fn() },
    sellerVerificationProfile: { findUnique: vi.fn() },
    sellerPayoutAccount: { findFirst: vi.fn() },
    sellerVerificationOverride: { findFirst: vi.fn() },
    chefProfile: { findUnique: vi.fn(), upsert: vi.fn() },
    chefVerificationDocument: { create: vi.fn() },
    homeCateringProfile: { findUnique: vi.fn(), upsert: vi.fn() },
    billingUsageRecord: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (operations) => Promise.all(operations)),
  },
  mockAudit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: mockAudit }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: vi.fn(async () => true) }));

import { updateUserProfile } from "@/server/users/profile";
import { upsertMenuItem } from "@/server/menus";
import { addChefVerificationDocument, upsertChefProfile } from "@/server/chefs";
import { upsertHomeCateringProfile } from "@/server/home-catering";

describe("S3 upload wiring across product modules", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.storageFile.findFirst.mockResolvedValue({ id: "file-1", purpose: "menu_item_photo", module: "menus" });
    mockPrisma.localizationLocale.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.update.mockImplementation(async ({ data }) => ({ id: "user-1", ...data }));
    mockPrisma.menu.findFirst.mockResolvedValue({ id: "menu-1" });
    mockPrisma.menuItem.findFirst.mockResolvedValue(null);
    mockPrisma.menuItem.create.mockImplementation(async ({ data }) => ({ id: "item-1", ...data }));
    mockPrisma.menuItemAvailability.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.menuItemAvailability.create.mockImplementation(async ({ data }) => ({ id: `day-${data.dayOfWeek}`, ...data }));
    mockPrisma.sellerVerificationPolicy.findMany.mockResolvedValue([]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue(null);
    mockPrisma.sellerPayoutAccount.findFirst.mockResolvedValue(null);
    mockPrisma.sellerVerificationOverride.findFirst.mockResolvedValue(null);
    mockPrisma.billingUsageRecord.findMany.mockResolvedValue([]);
    mockPrisma.chefProfile.findUnique.mockResolvedValue({ id: "chef-profile-1", slug: "chef", status: "draft" });
    mockPrisma.chefProfile.upsert.mockImplementation(async ({ update }) => ({ id: "chef-profile-1", organizationId: "chef-org", verificationStatus: "unverified", ...update }));
    mockPrisma.chefVerificationDocument.create.mockImplementation(async ({ data }) => ({ id: "doc-1", ...data }));
    mockPrisma.homeCateringProfile.findUnique.mockResolvedValue({ id: "catering-profile-1", slug: "catering", status: "draft", verificationStatus: "unverified" });
    mockPrisma.homeCateringProfile.upsert.mockImplementation(async ({ update }) => ({ id: "catering-profile-1", organizationId: "cat-org", verificationStatus: "unverified", ...update }));
  });

  it("stores user profile photo and cover file IDs after validating ownership", async () => {
    mockPrisma.storageFile.findFirst.mockResolvedValueOnce({ id: "profile-file", purpose: "user_profile_photo", module: "users" });
    mockPrisma.storageFile.findFirst.mockResolvedValueOnce({ id: "cover-file", purpose: "user_cover_photo", module: "users" });

    await updateUserProfile({
      userId: "user-1",
      input: {
        fullName: "Household Owner",
        email: "household@nizamkitchen.dev",
        profilePhotoFileId: "profile-file",
        coverPhotoFileId: "cover-file",
        headline: "Family cook",
      },
    });

    expect(mockPrisma.storageFile.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ uploadedById: "user-1" }) }));
    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ profilePhotoFileId: "profile-file", coverPhotoFileId: "cover-file" }) }));
  });

  it("stores menu item photos as StorageFile references", async () => {
    await upsertMenuItem({
      organizationId: "seller-org",
      countryCode: "US",
      organizationType: "home_catering",
      actorUserId: "seller-1",
      input: {
        name: "Hyderabadi Chicken Dum Biryani tray",
        category: "biryani",
        currencyCode: "USD",
        photoFileId: "file-1",
        status: "active",
        pickupAvailable: true,
      },
    });

    expect(mockPrisma.storageFile.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "file-1", organizationId: "seller-org" }) }));
    expect(mockPrisma.menuItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ photoFileId: "file-1" }) }));
  });

  it("stores business profile and cover image file IDs", async () => {
    await upsertHomeCateringProfile({
      organizationId: "cat-org",
      countryCode: "US",
      actorUserId: "seller-1",
      input: {
        displayName: "Hyderabad Home Kitchen",
        profilePhotoFileId: "file-1",
        coverPhotoFileId: "file-2",
        cuisineSpecialties: "Hyderabadi",
        languages: "English, Urdu",
      },
    });

    expect(mockPrisma.homeCateringProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ profilePhotoFileId: "file-1", coverPhotoFileId: "file-2" }),
      create: expect.objectContaining({ profilePhotoFileId: "file-1", coverPhotoFileId: "file-2" }),
    }));
  });

  it("stores chef profile photos and private verification document IDs", async () => {
    await upsertChefProfile({
      organizationId: "chef-org",
      countryCode: "US",
      actorUserId: "chef-1",
      input: {
        displayName: "Dum Biryani Specialist",
        bio: "Authentic Hyderabadi cooking for families and occasions.",
        profilePhotoFileId: "file-1",
        coverPhotoFileId: "file-2",
        languages: "English",
        specialties: "Biryani",
      },
    });
    await addChefVerificationDocument({
      organizationId: "chef-org",
      countryCode: "US",
      actorUserId: "chef-1",
      documentType: "business_license",
      fileId: "doc-file",
    });

    expect(mockPrisma.chefProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ profilePhotoFileId: "file-1", coverPhotoFileId: "file-2" }),
    }));
    expect(mockPrisma.chefVerificationDocument.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fileId: "doc-file" }) }));
  });

  it("uses storage API routes from upload components and never embeds S3 secrets in UI source", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/components/storage/file-upload-field.tsx"), "utf8");
    const uploadRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/storage/upload/route.ts"), "utf8");
    expect(source).toContain('fetch("/api/storage/upload"');
    expect(uploadRoute).toContain("requireUser");
    expect(uploadRoute).toContain('uploadModule !== "users"');
    expect(uploadRoute).not.toContain("requireMembership");
    expect(source).not.toContain(["AWS", "ACCESS", "KEY", "ID"].join("_"));
    expect(source).not.toContain(["AWS", "SECRET", "ACCESS", "KEY"].join("_"));
    expect(source).not.toContain("secretAccessKey");
  });

  it("adds upload widgets for support, order, and chef request attachments", () => {
    const support = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/support/new/page.tsx"), "utf8");
    const foodOrder = fs.readFileSync(path.join(process.cwd(), "src/components/food-orders/order-forms.tsx"), "utf8");
    const chefRequest = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/home-chef/request/page.tsx"), "utf8");
    expect(support).toContain("support_attachment");
    expect(foodOrder).toContain("order_attachment");
    expect(chefRequest).toContain("order_attachment");
  });
});
