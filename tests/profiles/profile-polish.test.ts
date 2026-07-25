import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { userProfileSchema } from "@/lib/validation/user-profile";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    oAuthAccount: { findMany: vi.fn() },
    storageFile: { findFirst: vi.fn() },
    location: { upsert: vi.fn() },
    localizationLocale: { findMany: vi.fn() },
  },
}));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getBusinessProfileCompletion, getUserOAuthAvatarProxyUrl, getUserOAuthAvatarUrl, getUserProfileCompletion } from "@/server/users/profile";

describe("professional profile polish", () => {
  it("validates LinkedIn-style user profile fields", () => {
    const parsed = userProfileSchema.parse({
      fullName: "Household Owner",
      email: "OWNER@NIZAMKITCHEN.DEV",
      headline: "Hyderabadi family meal planner",
      bio: "Planning family meals, groceries, and favorite recipes.",
      locationText: "Chicago, IL",
      phone: "+1 5551234567",
      religion: "islam",
      preferredLanguage: "English",
      addressLine1: "123 Biryani Lane",
      city: "Chicago",
      region: "IL",
      countryCode: "US",
      postalCode: "60601",
      locationVisibility: "private",
      publicProfileEnabled: "on",
    });

    expect(parsed.email).toBe("owner@nizamkitchen.dev");
    expect(parsed.locationText).toBe("Chicago, IL");
    expect(parsed.phone).toBe("+1 5551234567");
    expect(parsed.religion).toBe("islam");
    expect(parsed.addressLine1).toBe("123 Biryani Lane");
    expect(parsed.city).toBe("Chicago");
    expect(parsed.preferredLanguage).toBe("English");
    expect(parsed.publicProfileEnabled).toBe(true);
  });

  it("calculates user profile completion from photos, headline, bio, and location", () => {
    expect(getUserProfileCompletion({
      profilePhotoFileId: "profile-file",
      coverPhotoFileId: "cover-file",
      headline: "Family cook",
      bio: "I plan weekly Hyderabadi meals.",
      locationText: "Hyderabad",
      phone: "+1 5551234567",
    })).toBe(100);

    expect(getUserProfileCompletion({
      profilePhotoFileId: null,
      coverPhotoFileId: null,
      headline: "Family cook",
      bio: null,
      location: "Hyderabad",
    })).toBe(33);

    expect(getUserProfileCompletion({
      profilePhotoFileId: null,
      oauthAvatarUrl: "/api/users/user-1/oauth-avatar",
      coverPhotoFileId: null,
    })).toBe(17);
  });

  it("serves Google and Facebook profile pictures through the same-origin avatar route", async () => {
    vi.mocked(prisma.oAuthAccount.findMany).mockResolvedValueOnce([
      {
        avatarUrl: null,
        rawProfileJson: { picture: "https://lh3.googleusercontent.com/a/avatar=s96-c" },
      },
    ] as never);

    await expect(getUserOAuthAvatarUrl("user-1")).resolves.toBe("https://lh3.googleusercontent.com/a/avatar=s96-c");
    expect(getUserOAuthAvatarProxyUrl("user-1", "https://lh3.googleusercontent.com/a/avatar=s96-c")).toBe("/api/users/user-1/oauth-avatar");
  });

  it("rejects unsupported free-text religion values", () => {
    expect(() => userProfileSchema.parse({
      fullName: "Household Owner",
      email: "owner@nizamkitchen.dev",
      phone: "+1 5551234567",
      religion: "Islm",
    })).toThrow("supported religion");
  });

  it("calculates business profile completion without fake ratings or private documents", () => {
    expect(getBusinessProfileCompletion({
      profilePhotoFileId: "profile-file",
      coverPhotoFileId: "cover-file",
      bio: "Authentic Hyderabadi cooking.",
      phone: "555-1234",
      verificationStatus: "pending",
      specialties: ["biryani", "haleem"],
    }, { services: 2, socialLinks: 1 })).toBe(100);

    expect(getBusinessProfileCompletion({
      profilePhotoFileId: null,
      coverPhotoFileId: null,
      bio: null,
      verificationStatus: "unverified",
      specialties: [],
    }, { services: 0, socialLinks: 0 })).toBe(0);
  });

  it("renders profile images through StorageFile-backed helpers and safe social links", () => {
    const components = fs.readFileSync(path.join(process.cwd(), "src/components/profiles/profile-components.tsx"), "utf8");
    const userProfile = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/users/[id]/page.tsx"), "utf8");
    const chefProfile = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/chefs/[slug]/page.tsx"), "utf8");
    const cateringProfile = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/caterers/[slug]/page.tsx"), "utf8");
    const chefEditProfile = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/chef/profile/page.tsx"), "utf8");
    const cateringEditProfile = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/catering/profile/page.tsx"), "utf8");
    const restaurantEditProfile = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/restaurant/profile/page.tsx"), "utf8");
    const settingsPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/settings/page.tsx"), "utf8");
    const adminUserPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/admin/users/[id]/page.tsx"), "utf8");
    const appShell = fs.readFileSync(path.join(process.cwd(), "src/components/layout/app-shell.tsx"), "utf8");
    const oauthAvatarRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/users/[id]/oauth-avatar/route.ts"), "utf8");

    expect(components).toContain("StorageImage");
    expect(components).toContain('rel="noopener noreferrer"');
    expect(userProfile).toContain("publicProfileEnabled");
    expect(userProfile).toContain("Private contact details are hidden.");
    expect(userProfile).toContain("Address details are private.");
    expect(fs.readFileSync(path.join(process.cwd(), "src/app/(app)/settings/profile/page.tsx"), "utf8")).toContain("Personal address");
    expect(fs.readFileSync(path.join(process.cwd(), "src/app/(app)/settings/profile/page.tsx"), "utf8")).toContain("Select a language");
    expect(fs.readFileSync(path.join(process.cwd(), "src/app/(app)/settings/profile/page.tsx"), "utf8")).toContain("PhoneNumberInput");
    expect(fs.readFileSync(path.join(process.cwd(), "src/app/(app)/settings/profile/page.tsx"), "utf8")).toContain("Select religion");
    expect(chefProfile).toContain("ProfileHeader");
    expect(cateringProfile).toContain("ProfileHeader");
    expect(chefEditProfile).toContain("ProfileCompletionCard");
    expect(cateringEditProfile).toContain("ProfileCompletionCard");
    expect(restaurantEditProfile).toContain("ProfileCompletionCard");
    expect(restaurantEditProfile).toContain("Restaurant details");
    expect(restaurantEditProfile).toContain("updateRestaurantProfileBasicsAction");
    expect(settingsPage).toContain("Edit chef profile");
    expect(settingsPage).toContain("Edit catering profile");
    expect(settingsPage).toContain("Edit restaurant profile");
    expect(settingsPage).toContain("Edit household settings");
    expect(adminUserPage).toContain("getUserOAuthAvatarImageUrl(user.id)");
    expect(appShell).toContain("getUserOAuthAvatarImageUrl(session.user.id)");
    expect(oauthAvatarRoute).toContain("fetch(avatarUrl");
    expect(oauthAvatarRoute).toContain("session.user.platformRole");
  });

  it("keeps public profiles from exposing verification documents or fake ratings", () => {
    const chefProfile = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/chefs/[slug]/page.tsx"), "utf8");
    const cateringProfile = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/caterers/[slug]/page.tsx"), "utf8");
    const components = fs.readFileSync(path.join(process.cwd(), "src/components/profiles/profile-components.tsx"), "utf8");

    expect(chefProfile).not.toContain("verificationDocuments");
    expect(cateringProfile).not.toContain("verificationDocuments");
    expect(components).toContain("Reviews will appear here after completed orders.");
    expect(cateringProfile).toContain("ReviewsPreviewSection");
  });

  it("gives household shoppers a clear caterer order CTA instead of only order history", () => {
    const cateringProfile = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/caterers/[slug]/page.tsx"), "utf8");

    expect(cateringProfile).toContain("Place my order");
    expect(cateringProfile).toContain("orders/new?menuItemId");
    expect(cateringProfile).toContain("View my orders");
  });

  it("shows restaurant cards and detail pages with menus, hours, and ordering CTA", () => {
    const restaurantsPage = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/restaurants/page.tsx"), "utf8");
    const restaurantProfile = fs.readFileSync(path.join(process.cwd(), "src/app/(app)/restaurants/[slug]/page.tsx"), "utf8");

    expect(restaurantsPage).toContain("View restaurant menu");
    expect(restaurantsPage).toContain("fulfillmentTimeSlots");
    expect(restaurantsPage).toContain("Menu live");
    expect(restaurantProfile).toContain("Hours and ordering windows");
    expect(restaurantProfile).toContain("Pickup and delivery");
    expect(restaurantProfile).toContain("Place my order");
    expect(restaurantProfile).toContain("orders/new?menuItemId");
  });
});
