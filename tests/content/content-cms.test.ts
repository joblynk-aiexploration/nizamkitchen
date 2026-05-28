import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    cmsPage: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    helpArticle: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    faqItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));

import { createAuditEvent } from "@/server/audit";
import {
  createCmsPage,
  createFaqItem,
  createHelpArticle,
  getPublishedCmsPage,
  listPublishedHelpCategories,
  slugify,
  updateHelpArticle,
} from "@/server/content";

function ownerSession() {
  return { user: { id: "owner-1", platformRole: "platform_owner" }, countryAssignments: [{ countryCode: "US" }] } as never;
}

describe("CMS help center and FAQ management", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.cmsPage.create.mockImplementation(async ({ data }) => ({ id: "page-1", ...data, createdAt: new Date(), updatedAt: new Date() }));
    mockPrisma.helpArticle.create.mockImplementation(async ({ data }) => ({ id: "article-1", ...data, createdAt: new Date(), updatedAt: new Date() }));
    mockPrisma.faqItem.create.mockImplementation(async ({ data }) => ({ id: "faq-1", ...data, createdAt: new Date(), updatedAt: new Date() }));
  });

  it("creates CMS pages with slug normalization, audience targeting, and publish metadata", async () => {
    const page = await createCmsPage(ownerSession(), {
      title: "Seller Launch Guide",
      slug: "Seller Launch Guide!",
      contentMarkdown: "Welcome sellers",
      status: "published",
      audience: "sellers",
      countryCode: "US",
      sortOrder: 10,
    });
    expect(page.slug).toBe("seller-launch-guide");
    expect(mockPrisma.cmsPage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        slug: "seller-launch-guide",
        status: "published",
        audience: "sellers",
        publishedById: "owner-1",
        publishedAt: expect.any(Date),
      }),
    }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "cms_page.created" }));
  });

  it("creates help articles and lets admins update publish status", async () => {
    await createHelpArticle(ownerSession(), {
      title: "Food safety basics",
      slug: "Food Safety Basics",
      category: "Food Safety",
      articleType: "food_safety_guide",
      contentMarkdown: "Keep documents private.",
      status: "draft",
      audience: "sellers",
    });
    expect(mockPrisma.helpArticle.create.mock.calls[0][0].data.category).toBe("food safety");

    mockPrisma.helpArticle.findUnique.mockResolvedValue({ id: "article-1", status: "draft", countryCode: null, publishedById: null, publishedAt: null });
    mockPrisma.helpArticle.update.mockImplementation(async ({ data }) => ({ id: "article-1", ...data }));
    await updateHelpArticle(ownerSession(), "article-1", {
      title: "Food safety basics",
      slug: "food-safety-basics",
      category: "Food Safety",
      articleType: "food_safety_guide",
      contentMarkdown: "Updated guide",
      status: "published",
      audience: "sellers",
    });
    expect(mockPrisma.helpArticle.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ publishedById: "owner-1", publishedAt: expect.any(Date) }),
    }));
  });

  it("creates FAQ items with reorder and targeting fields", async () => {
    await createFaqItem(ownerSession(), {
      question: "How do promotions work?",
      answerMarkdown: "Discounts are calculated server-side.",
      category: "payments",
      status: "published",
      audience: "all_users",
      sortOrder: 5,
    });
    expect(mockPrisma.faqItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ question: "How do promotions work?", sortOrder: 5, status: "published" }),
    }));
  });

  it("lists only published public help content and groups by category", async () => {
    mockPrisma.helpArticle.findMany.mockResolvedValue([
      { category: "households", title: "Meal plans", slug: "meal-plans", excerpt: null, articleType: "help_article", audience: "households" },
      { category: "households", title: "Grocery lists", slug: "grocery-lists", excerpt: null, articleType: "help_article", audience: "households" },
    ]);
    const categories = await listPublishedHelpCategories("US");
    expect(mockPrisma.helpArticle.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "published" }),
    }));
    expect(categories.households).toHaveLength(2);
  });

  it("fetches published CMS pages by slug and country fallback", async () => {
    mockPrisma.cmsPage.findFirst.mockResolvedValue({ id: "page-1", slug: "seller-guide", status: "published" });
    await getPublishedCmsPage("seller-guide", "US");
    expect(mockPrisma.cmsPage.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        slug: "seller-guide",
        status: "published",
        OR: [{ countryCode: null }, { countryCode: "US" }],
      }),
    }));
  });

  it("normalizes slugs safely", () => {
    expect(slugify("  Seller's Food Safety Guide! ")).toBe("seller-s-food-safety-guide");
  });
});
