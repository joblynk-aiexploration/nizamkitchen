import { Prisma, type ContentAudience, type ContentStatus, type HelpArticleType, type PlatformRole } from "@prisma/client";
import { z } from "zod";
import { assertCountryAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";

type AdminSession = {
  user: { id: string; platformRole: PlatformRole | null };
  countryAssignments?: Array<{ countryCode: string }>;
};

const optionalText = (max = 2000) =>
  z.preprocess((value) => (value == null ? "" : String(value).trim()), z.string().max(max).optional());

const contentStatus = z.enum(["draft", "published", "archived"]);
const contentAudience = z.enum(["all_users", "households", "chefs", "home_catering", "restaurants", "sellers", "admins"]);

export const cmsPageSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(120),
  excerpt: optionalText(500),
  contentMarkdown: z.string().trim().min(2).max(50_000),
  status: contentStatus.default("draft"),
  audience: contentAudience.default("all_users"),
  countryCode: z.string().trim().length(2).toUpperCase().optional().or(z.literal("")),
  metaTitle: optionalText(160),
  metaDescription: optionalText(300),
  sortOrder: z.coerce.number().int().min(0).max(100_000).default(100),
});

export const helpArticleSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  articleType: z.enum(["help_article", "onboarding_guide", "seller_guide", "food_safety_guide", "support_documentation"]).default("help_article"),
  excerpt: optionalText(500),
  contentMarkdown: z.string().trim().min(2).max(50_000),
  status: contentStatus.default("draft"),
  audience: contentAudience.default("all_users"),
  countryCode: z.string().trim().length(2).toUpperCase().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(100_000).default(100),
});

export const faqItemSchema = z.object({
  question: z.string().trim().min(2).max(220),
  answerMarkdown: z.string().trim().min(2).max(20_000),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  status: contentStatus.default("draft"),
  audience: contentAudience.default("all_users"),
  countryCode: z.string().trim().length(2).toUpperCase().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(100_000).default(100),
});

export async function getContentDashboard(session: AdminSession) {
  const [pages, helpArticles, faqs] = await Promise.all([
    prisma.cmsPage.findMany({ where: countryScopedCmsWhere(session), orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }], take: 100 }),
    prisma.helpArticle.findMany({ where: countryScopedHelpWhere(session), orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }], take: 100 }),
    prisma.faqItem.findMany({ where: countryScopedFaqWhere(session), orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }], take: 100 }),
  ]);
  return { pages, helpArticles, faqs };
}

export async function listCmsPages(session: AdminSession) {
  return prisma.cmsPage.findMany({ where: countryScopedCmsWhere(session), orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }] });
}

export async function listHelpArticles(session: AdminSession) {
  return prisma.helpArticle.findMany({ where: countryScopedHelpWhere(session), orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }] });
}

export async function listFaqItems(session: AdminSession) {
  return prisma.faqItem.findMany({ where: countryScopedFaqWhere(session), orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }] });
}

export async function getCmsPageForAdmin(session: AdminSession, id: string) {
  const page = await prisma.cmsPage.findUnique({ where: { id } });
  if (page?.countryCode) assertCountryAccess(session as never, page.countryCode);
  return page;
}

export async function getHelpArticleForAdmin(session: AdminSession, id: string) {
  const article = await prisma.helpArticle.findUnique({ where: { id } });
  if (article?.countryCode) assertCountryAccess(session as never, article.countryCode);
  return article;
}

export async function getFaqItemForAdmin(session: AdminSession, id: string) {
  const faq = await prisma.faqItem.findUnique({ where: { id } });
  if (faq?.countryCode) assertCountryAccess(session as never, faq.countryCode);
  return faq;
}

export async function createCmsPage(session: AdminSession, input: unknown) {
  assertContentManager(session);
  const parsed = cmsPageSchema.parse(input);
  if (parsed.countryCode) assertCountryAccess(session as never, parsed.countryCode);
  const page = await prisma.cmsPage.create({
    data: {
      ...cmsPageData(parsed),
      createdById: session.user.id,
      publishedById: parsed.status === "published" ? session.user.id : null,
      publishedAt: parsed.status === "published" ? new Date() : null,
    },
  });
  await auditContent(session, "cms_page.created", "cms_page", page.id, page.countryCode, { slug: page.slug, status: page.status });
  return page;
}

export async function updateCmsPage(session: AdminSession, id: string, input: unknown) {
  assertContentManager(session);
  const existing = await getCmsPageForAdmin(session, id);
  if (!existing) throw new Error("CMS page not found.");
  const parsed = cmsPageSchema.parse(input);
  const page = await prisma.cmsPage.update({
    where: { id },
    data: {
      ...cmsPageData(parsed),
      updatedById: session.user.id,
      publishedById: parsed.status === "published" && existing.status !== "published" ? session.user.id : existing.publishedById,
      publishedAt: parsed.status === "published" && existing.status !== "published" ? new Date() : existing.publishedAt,
    },
  });
  await auditContent(session, "cms_page.updated", "cms_page", page.id, page.countryCode, { slug: page.slug, status: page.status });
  return page;
}

export async function createHelpArticle(session: AdminSession, input: unknown) {
  assertContentManager(session);
  const parsed = helpArticleSchema.parse(input);
  if (parsed.countryCode) assertCountryAccess(session as never, parsed.countryCode);
  const article = await prisma.helpArticle.create({
    data: {
      ...helpArticleData(parsed),
      createdById: session.user.id,
      publishedById: parsed.status === "published" ? session.user.id : null,
      publishedAt: parsed.status === "published" ? new Date() : null,
    },
  });
  await auditContent(session, "help_article.created", "help_article", article.id, article.countryCode, { slug: article.slug, category: article.category });
  return article;
}

export async function updateHelpArticle(session: AdminSession, id: string, input: unknown) {
  assertContentManager(session);
  const existing = await getHelpArticleForAdmin(session, id);
  if (!existing) throw new Error("Help article not found.");
  const parsed = helpArticleSchema.parse(input);
  const article = await prisma.helpArticle.update({
    where: { id },
    data: {
      ...helpArticleData(parsed),
      updatedById: session.user.id,
      publishedById: parsed.status === "published" && existing.status !== "published" ? session.user.id : existing.publishedById,
      publishedAt: parsed.status === "published" && existing.status !== "published" ? new Date() : existing.publishedAt,
    },
  });
  await auditContent(session, "help_article.updated", "help_article", article.id, article.countryCode, { slug: article.slug, category: article.category });
  return article;
}

export async function createFaqItem(session: AdminSession, input: unknown) {
  assertContentManager(session);
  const parsed = faqItemSchema.parse(input);
  if (parsed.countryCode) assertCountryAccess(session as never, parsed.countryCode);
  const faq = await prisma.faqItem.create({
    data: {
      ...faqItemData(parsed),
      createdById: session.user.id,
      publishedById: parsed.status === "published" ? session.user.id : null,
      publishedAt: parsed.status === "published" ? new Date() : null,
    },
  });
  await auditContent(session, "faq_item.created", "faq_item", faq.id, faq.countryCode, { category: faq.category, status: faq.status });
  return faq;
}

export async function updateFaqItem(session: AdminSession, id: string, input: unknown) {
  assertContentManager(session);
  const existing = await getFaqItemForAdmin(session, id);
  if (!existing) throw new Error("FAQ item not found.");
  const parsed = faqItemSchema.parse(input);
  const faq = await prisma.faqItem.update({
    where: { id },
    data: {
      ...faqItemData(parsed),
      updatedById: session.user.id,
      publishedById: parsed.status === "published" && existing.status !== "published" ? session.user.id : existing.publishedById,
      publishedAt: parsed.status === "published" && existing.status !== "published" ? new Date() : existing.publishedAt,
    },
  });
  await auditContent(session, "faq_item.updated", "faq_item", faq.id, faq.countryCode, { category: faq.category, status: faq.status });
  return faq;
}

export async function listPublishedHelpCategories(countryCode?: string | null) {
  const articles = await prisma.helpArticle.findMany({
    where: publishedCountryWhere(countryCode),
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: { category: true, title: true, slug: true, excerpt: true, articleType: true, audience: true },
  });
  return groupByCategory(articles);
}

export async function listPublishedHelpArticlesByCategory(category: string, countryCode?: string | null) {
  return prisma.helpArticle.findMany({
    where: { ...publishedCountryWhere(countryCode), category: categoryFromSlug(category) },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
}

export async function getPublishedHelpArticle(slug: string, countryCode?: string | null) {
  return prisma.helpArticle.findFirst({
    where: { slug: slugify(slug), ...publishedCountryWhere(countryCode) },
    orderBy: [{ countryCode: "desc" }],
  });
}

export async function listPublishedFaqs(countryCode?: string | null) {
  return prisma.faqItem.findMany({
    where: publishedCountryWhere(countryCode),
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { question: "asc" }],
  });
}

export async function getPublishedCmsPage(slug: string, countryCode?: string | null) {
  return prisma.cmsPage.findFirst({
    where: { slug: slugify(slug), ...publishedCountryWhere(countryCode) },
    orderBy: [{ countryCode: "desc" }],
  });
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cmsPageData(parsed: z.infer<typeof cmsPageSchema>) {
  return {
    title: parsed.title,
    slug: slugify(parsed.slug),
    excerpt: parsed.excerpt || null,
    contentMarkdown: parsed.contentMarkdown,
    status: parsed.status as ContentStatus,
    audience: parsed.audience as ContentAudience,
    countryCode: parsed.countryCode || null,
    metaTitle: parsed.metaTitle || null,
    metaDescription: parsed.metaDescription || null,
    sortOrder: parsed.sortOrder,
  };
}

function helpArticleData(parsed: z.infer<typeof helpArticleSchema>) {
  return {
    title: parsed.title,
    slug: slugify(parsed.slug),
    category: categoryFromSlug(parsed.category),
    articleType: parsed.articleType as HelpArticleType,
    excerpt: parsed.excerpt || null,
    contentMarkdown: parsed.contentMarkdown,
    status: parsed.status as ContentStatus,
    audience: parsed.audience as ContentAudience,
    countryCode: parsed.countryCode || null,
    sortOrder: parsed.sortOrder,
  };
}

function faqItemData(parsed: z.infer<typeof faqItemSchema>) {
  return {
    question: parsed.question,
    answerMarkdown: parsed.answerMarkdown,
    category: parsed.category ? categoryFromSlug(parsed.category) : null,
    status: parsed.status as ContentStatus,
    audience: parsed.audience as ContentAudience,
    countryCode: parsed.countryCode || null,
    sortOrder: parsed.sortOrder,
  };
}

function countryScopedCmsWhere(session: AdminSession): Prisma.CmsPageWhereInput {
  return countryScopedWhere(session);
}

function countryScopedHelpWhere(session: AdminSession): Prisma.HelpArticleWhereInput {
  return countryScopedWhere(session);
}

function countryScopedFaqWhere(session: AdminSession): Prisma.FaqItemWhereInput {
  return countryScopedWhere(session);
}

function countryScopedWhere(session: AdminSession) {
  if (session.user.platformRole === "country_manager") {
    const countries = session.countryAssignments?.map((assignment) => assignment.countryCode) ?? [];
    return { OR: [{ countryCode: null }, { countryCode: { in: countries } }] };
  }
  return {};
}

function publishedCountryWhere(countryCode?: string | null) {
  return {
    status: "published" as const,
    OR: countryCode ? [{ countryCode: null }, { countryCode: countryCode.toUpperCase() }] : [{ countryCode: null }],
  };
}

function groupByCategory<T extends { category: string }>(articles: T[]) {
  return articles.reduce<Record<string, T[]>>((groups, article) => {
    groups[article.category] = groups[article.category] ?? [];
    groups[article.category].push(article);
    return groups;
  }, {});
}

function categoryFromSlug(value: string) {
  return slugify(value).replace(/-/g, " ");
}

function assertContentManager(session: AdminSession) {
  if (session.user.platformRole !== "platform_owner" && session.user.platformRole !== "platform_admin" && session.user.platformRole !== "support_admin") {
    throw new Error("Content management requires platform content access.");
  }
}

async function auditContent(session: AdminSession, action: string, targetType: string, targetId: string, countryCode: string | null, details: Prisma.JsonObject) {
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: null,
    countryCode,
    action,
    targetType,
    targetId,
    details,
  });
}
