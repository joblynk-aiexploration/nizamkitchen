import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    businessSocialLink: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));

import { createAuditEvent } from "@/server/audit";
import {
  deleteBusinessSocialLink,
  listPublicBusinessSocialLinks,
  moderateDeleteBusinessSocialLink,
  upsertBusinessSocialLink,
} from "@/server/business-social-links";
import { businessSocialLinkSchema, normalizeSocialUrl } from "@/lib/validation/social-links";

function adminSession(role = "platform_admin") {
  return {
    user: { id: "admin-1", email: "admin@example.test", status: "active", platformRole: role },
    countryAssignments: [{ countryCode: "US" }],
  } as never;
}

describe("business social links", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.businessSocialLink.create.mockResolvedValue({
      id: "link-1",
      organizationId: "org-1",
      profileType: "home_catering",
      platform: "instagram",
      url: "https://instagram.com/nizam",
      isPublic: true,
    });
  });

  it("normalizes and validates approved social URLs", () => {
    expect(normalizeSocialUrl("instagram", " instagram.com/nizam ")).toBe("https://instagram.com/nizam");
    expect(normalizeSocialUrl("youtube", "https://www.youtube.com/@nizam")).toBe("https://www.youtube.com/@nizam");
    expect(normalizeSocialUrl("whatsapp", "https://wa.me/15551234567")).toBe("https://wa.me/15551234567");
    expect(normalizeSocialUrl("website", "https://example.com/menu")).toBe("https://example.com/menu");
  });

  it("rejects unsafe URLs and embed HTML", () => {
    expect(() => normalizeSocialUrl("website", "javascript:alert(1)")).toThrow();
    expect(() => normalizeSocialUrl("website", "data:text/html,hi")).toThrow();
    expect(() => normalizeSocialUrl("website", "<iframe src='https://example.com'></iframe>")).toThrow();
    expect(() => normalizeSocialUrl("instagram", "https://evil.example/nizam")).toThrow();
  });

  it("home catering seller adds Instagram link", async () => {
    await upsertBusinessSocialLink({
      organizationId: "org-1",
      organizationType: "home_catering",
      countryCode: "US",
      actorUserId: "seller-1",
      input: {
        profileType: "home_catering",
        platform: "instagram",
        url: "instagram.com/nizam",
        isPublic: "on",
      },
    });
    expect(mockPrisma.businessSocialLink.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org-1", profileType: "home_catering", platform: "instagram" }),
    }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "business_social_link.created" }));
  });

  it("chef adds YouTube link and restaurant adds website link", () => {
    expect(businessSocialLinkSchema.parse({
      profileType: "chef_business",
      platform: "youtube",
      url: "youtube.com/@chef",
    }).url).toBe("https://youtube.com/@chef");
    expect(businessSocialLinkSchema.parse({
      profileType: "restaurant",
      platform: "website",
      url: "https://restaurant.example",
    }).url).toBe("https://restaurant.example/");
  });

  it("public profile displays public links and hides private links by query", async () => {
    mockPrisma.businessSocialLink.findMany.mockResolvedValue([]);
    await listPublicBusinessSocialLinks("org-1", "home_catering");
    expect(mockPrisma.businessSocialLink.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-1", profileType: "home_catering", isPublic: true },
    }));
  });

  it("seller cannot delete another organization social link", async () => {
    mockPrisma.businessSocialLink.findFirst.mockResolvedValue(null);
    await expect(deleteBusinessSocialLink({
      organizationId: "org-a",
      countryCode: "US",
      actorUserId: "seller-a",
      input: { linkId: "link-other" },
    })).rejects.toThrow("not found");
  });

  it("admin can remove unsafe link", async () => {
    mockPrisma.businessSocialLink.findUnique.mockResolvedValue({
      id: "link-1",
      organizationId: "org-1",
      platform: "website",
      organization: { countryCode: "US" },
    });
    mockPrisma.businessSocialLink.delete.mockResolvedValue({ id: "link-1" });
    await moderateDeleteBusinessSocialLink({ session: adminSession(), linkId: "link-1" });
    expect(mockPrisma.businessSocialLink.delete).toHaveBeenCalledWith({ where: { id: "link-1" } });
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "business_social_link.moderated" }));
  });

  it("country manager cannot moderate links outside assigned countries", async () => {
    mockPrisma.businessSocialLink.findUnique.mockResolvedValue({
      id: "link-1",
      organizationId: "org-1",
      platform: "website",
      organization: { countryCode: "GB" },
    });
    await expect(moderateDeleteBusinessSocialLink({ session: adminSession("country_manager"), linkId: "link-1" })).rejects.toThrow();
  });
});
