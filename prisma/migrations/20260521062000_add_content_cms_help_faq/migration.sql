-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ContentAudience" AS ENUM ('all_users', 'households', 'chefs', 'home_catering', 'restaurants', 'sellers', 'admins');

-- CreateEnum
CREATE TYPE "HelpArticleType" AS ENUM ('help_article', 'onboarding_guide', 'seller_guide', 'food_safety_guide', 'support_documentation');

-- CreateTable
CREATE TABLE "CmsPage" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "excerpt" TEXT,
  "contentMarkdown" TEXT NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'draft',
  "audience" "ContentAudience" NOT NULL DEFAULT 'all_users',
  "countryCode" TEXT,
  "metaTitle" TEXT,
  "metaDescription" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "publishedById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpArticle" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "articleType" "HelpArticleType" NOT NULL DEFAULT 'help_article',
  "excerpt" TEXT,
  "contentMarkdown" TEXT NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'draft',
  "audience" "ContentAudience" NOT NULL DEFAULT 'all_users',
  "countryCode" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "publishedById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HelpArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqItem" (
  "id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answerMarkdown" TEXT NOT NULL,
  "category" TEXT,
  "status" "ContentStatus" NOT NULL DEFAULT 'draft',
  "audience" "ContentAudience" NOT NULL DEFAULT 'all_users',
  "countryCode" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "publishedById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CmsPage_slug_countryCode_key" ON "CmsPage"("slug", "countryCode");
CREATE INDEX "CmsPage_slug_idx" ON "CmsPage"("slug");
CREATE INDEX "CmsPage_status_idx" ON "CmsPage"("status");
CREATE INDEX "CmsPage_audience_idx" ON "CmsPage"("audience");
CREATE INDEX "CmsPage_countryCode_idx" ON "CmsPage"("countryCode");
CREATE INDEX "CmsPage_sortOrder_idx" ON "CmsPage"("sortOrder");
CREATE UNIQUE INDEX "HelpArticle_slug_key" ON "HelpArticle"("slug");
CREATE INDEX "HelpArticle_slug_idx" ON "HelpArticle"("slug");
CREATE INDEX "HelpArticle_category_idx" ON "HelpArticle"("category");
CREATE INDEX "HelpArticle_articleType_idx" ON "HelpArticle"("articleType");
CREATE INDEX "HelpArticle_status_idx" ON "HelpArticle"("status");
CREATE INDEX "HelpArticle_audience_idx" ON "HelpArticle"("audience");
CREATE INDEX "HelpArticle_countryCode_idx" ON "HelpArticle"("countryCode");
CREATE INDEX "HelpArticle_sortOrder_idx" ON "HelpArticle"("sortOrder");
CREATE INDEX "FaqItem_category_idx" ON "FaqItem"("category");
CREATE INDEX "FaqItem_status_idx" ON "FaqItem"("status");
CREATE INDEX "FaqItem_audience_idx" ON "FaqItem"("audience");
CREATE INDEX "FaqItem_countryCode_idx" ON "FaqItem"("countryCode");
CREATE INDEX "FaqItem_sortOrder_idx" ON "FaqItem"("sortOrder");

-- AddForeignKey
ALTER TABLE "CmsPage" ADD CONSTRAINT "CmsPage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CmsPage" ADD CONSTRAINT "CmsPage_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CmsPage" ADD CONSTRAINT "CmsPage_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HelpArticle" ADD CONSTRAINT "HelpArticle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HelpArticle" ADD CONSTRAINT "HelpArticle_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HelpArticle" ADD CONSTRAINT "HelpArticle_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FaqItem" ADD CONSTRAINT "FaqItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FaqItem" ADD CONSTRAINT "FaqItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FaqItem" ADD CONSTRAINT "FaqItem_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
