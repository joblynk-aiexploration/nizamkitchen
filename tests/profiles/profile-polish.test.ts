import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { userProfileSchema } from "@/lib/validation/user-profile";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: vi.fn() }, storageFile: { findFirst: vi.fn() } } }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));

import { getBusinessProfileCompletion, getUserProfileCompletion } from "@/server/users/profile";

describe("professional profile polish", () => {
  it("validates LinkedIn-style user profile fields", () => {
    const parsed = userProfileSchema.parse({
      fullName: "Household Owner",
      headline: "Hyderabadi family meal planner",
      bio: "Planning family meals, groceries, and favorite recipes.",
      locationText: "Chicago, IL",
      phone: "+1 555 123 4567",
      preferredLanguage: "English",
      publicProfileEnabled: "on",
    });

    expect(parsed.locationText).toBe("Chicago, IL");
    expect(parsed.phone).toBe("+1 555 123 4567");
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
    })).toBe(100);

    expect(getUserProfileCompletion({
      profilePhotoFileId: null,
      coverPhotoFileId: null,
      headline: "Family cook",
      bio: null,
      location: "Hyderabad",
    })).toBe(40);
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

    expect(components).toContain("StorageImage");
    expect(components).toContain('rel="noopener noreferrer"');
    expect(userProfile).toContain("publicProfileEnabled");
    expect(userProfile).toContain("Private contact details are hidden.");
    expect(chefProfile).toContain("ProfileHeader");
    expect(cateringProfile).toContain("ProfileHeader");
    expect(chefEditProfile).toContain("ProfileCompletionCard");
    expect(cateringEditProfile).toContain("ProfileCompletionCard");
    expect(restaurantEditProfile).toContain("ProfileCompletionCard");
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
});
