-- CreateEnum
CREATE TYPE "MarketplaceReviewSubjectType" AS ENUM ('food_order', 'home_chef_request');

-- CreateEnum
CREATE TYPE "MarketplaceReviewSellerType" AS ENUM ('chef_business', 'home_catering', 'restaurant');

-- CreateEnum
CREATE TYPE "MarketplaceReviewStatus" AS ENUM ('pending', 'published', 'hidden', 'removed');

-- CreateEnum
CREATE TYPE "ReviewReportReason" AS ENUM ('abuse', 'spam', 'fake_review', 'privacy', 'safety', 'other');

-- CreateEnum
CREATE TYPE "ReviewReportStatus" AS ENUM ('open', 'under_review', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('open', 'under_review', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "MarketplaceReview" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "customerOrganizationId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "sellerOrganizationId" TEXT NOT NULL,
  "sellerType" "MarketplaceReviewSellerType" NOT NULL,
  "subjectType" "MarketplaceReviewSubjectType" NOT NULL,
  "foodOrderId" TEXT,
  "homeChefRequestId" TEXT,
  "rating" INTEGER NOT NULL,
  "title" TEXT,
  "comment" TEXT,
  "status" "MarketplaceReviewStatus" NOT NULL DEFAULT 'pending',
  "verifiedPurchase" BOOLEAN NOT NULL DEFAULT true,
  "sellerReply" TEXT,
  "sellerReplyById" TEXT,
  "sellerRepliedAt" TIMESTAMP(3),
  "moderatedById" TEXT,
  "moderatedAt" TIMESTAMP(3),
  "moderationNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketplaceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceReviewReport" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "reporterUserId" TEXT NOT NULL,
  "reporterOrganizationId" TEXT NOT NULL,
  "reason" "ReviewReportReason" NOT NULL,
  "details" TEXT,
  "status" "ReviewReportStatus" NOT NULL DEFAULT 'open',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketplaceReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustComplaint" (
  "id" TEXT NOT NULL,
  "reporterOrganizationId" TEXT NOT NULL,
  "reporterUserId" TEXT NOT NULL,
  "sellerOrganizationId" TEXT,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "ComplaintStatus" NOT NULL DEFAULT 'open',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrustComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceReview_foodOrderId_reviewerUserId_key" ON "MarketplaceReview"("foodOrderId", "reviewerUserId");
CREATE UNIQUE INDEX "MarketplaceReview_homeChefRequestId_reviewerUserId_key" ON "MarketplaceReview"("homeChefRequestId", "reviewerUserId");
CREATE INDEX "MarketplaceReview_organizationId_idx" ON "MarketplaceReview"("organizationId");
CREATE INDEX "MarketplaceReview_countryCode_idx" ON "MarketplaceReview"("countryCode");
CREATE INDEX "MarketplaceReview_customerOrganizationId_idx" ON "MarketplaceReview"("customerOrganizationId");
CREATE INDEX "MarketplaceReview_sellerOrganizationId_idx" ON "MarketplaceReview"("sellerOrganizationId");
CREATE INDEX "MarketplaceReview_reviewerUserId_idx" ON "MarketplaceReview"("reviewerUserId");
CREATE INDEX "MarketplaceReview_sellerType_idx" ON "MarketplaceReview"("sellerType");
CREATE INDEX "MarketplaceReview_subjectType_idx" ON "MarketplaceReview"("subjectType");
CREATE INDEX "MarketplaceReview_status_idx" ON "MarketplaceReview"("status");
CREATE INDEX "MarketplaceReview_verifiedPurchase_idx" ON "MarketplaceReview"("verifiedPurchase");
CREATE INDEX "MarketplaceReview_createdAt_idx" ON "MarketplaceReview"("createdAt");
CREATE INDEX "MarketplaceReviewReport_reviewId_idx" ON "MarketplaceReviewReport"("reviewId");
CREATE INDEX "MarketplaceReviewReport_reporterUserId_idx" ON "MarketplaceReviewReport"("reporterUserId");
CREATE INDEX "MarketplaceReviewReport_reporterOrganizationId_idx" ON "MarketplaceReviewReport"("reporterOrganizationId");
CREATE INDEX "MarketplaceReviewReport_reason_idx" ON "MarketplaceReviewReport"("reason");
CREATE INDEX "MarketplaceReviewReport_status_idx" ON "MarketplaceReviewReport"("status");
CREATE INDEX "MarketplaceReviewReport_createdAt_idx" ON "MarketplaceReviewReport"("createdAt");
CREATE INDEX "TrustComplaint_reporterOrganizationId_idx" ON "TrustComplaint"("reporterOrganizationId");
CREATE INDEX "TrustComplaint_reporterUserId_idx" ON "TrustComplaint"("reporterUserId");
CREATE INDEX "TrustComplaint_sellerOrganizationId_idx" ON "TrustComplaint"("sellerOrganizationId");
CREATE INDEX "TrustComplaint_subjectType_subjectId_idx" ON "TrustComplaint"("subjectType", "subjectId");
CREATE INDEX "TrustComplaint_status_idx" ON "TrustComplaint"("status");
CREATE INDEX "TrustComplaint_createdAt_idx" ON "TrustComplaint"("createdAt");

-- AddForeignKey
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_customerOrganizationId_fkey" FOREIGN KEY ("customerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_sellerOrganizationId_fkey" FOREIGN KEY ("sellerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_sellerReplyById_fkey" FOREIGN KEY ("sellerReplyById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_foodOrderId_fkey" FOREIGN KEY ("foodOrderId") REFERENCES "FoodOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_homeChefRequestId_fkey" FOREIGN KEY ("homeChefRequestId") REFERENCES "HomeChefRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReviewReport" ADD CONSTRAINT "MarketplaceReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "MarketplaceReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReviewReport" ADD CONSTRAINT "MarketplaceReviewReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReviewReport" ADD CONSTRAINT "MarketplaceReviewReport_reporterOrganizationId_fkey" FOREIGN KEY ("reporterOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReviewReport" ADD CONSTRAINT "MarketplaceReviewReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustComplaint" ADD CONSTRAINT "TrustComplaint_reporterOrganizationId_fkey" FOREIGN KEY ("reporterOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrustComplaint" ADD CONSTRAINT "TrustComplaint_sellerOrganizationId_fkey" FOREIGN KEY ("sellerOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustComplaint" ADD CONSTRAINT "TrustComplaint_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrustComplaint" ADD CONSTRAINT "TrustComplaint_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
