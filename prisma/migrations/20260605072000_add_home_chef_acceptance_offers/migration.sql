CREATE TYPE "HomeChefLeadTimeCategory" AS ENUM ('advance_booking', 'short_term', 'same_day', 'recurring', 'custom');

CREATE TYPE "HomeChefRequestOfferStatus" AS ENUM ('pending', 'accepted', 'declined', 'expired', 'cancelled');

CREATE TYPE "HomeChefRequestOfferType" AS ENUM ('direct', 'cascade', 'admin_override');

CREATE TYPE "HomeChefMatchingStatus" AS ENUM ('awaiting_admin_review', 'awaiting_offer', 'offered', 'chef_accepted', 'chef_declined', 'expired', 'no_chef_available', 'confirmed', 'cancelled');

ALTER TABLE "HomeChefRequest"
  ADD COLUMN "assignedChefProfileId" TEXT,
  ADD COLUMN "leadTimeCategory" "HomeChefLeadTimeCategory" NOT NULL DEFAULT 'custom',
  ADD COLUMN "acceptanceDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "currentOfferId" TEXT,
  ADD COLUMN "autoCascadeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cascadeAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextCascadeAt" TIMESTAMP(3),
  ADD COLUMN "matchingStatus" "HomeChefMatchingStatus" NOT NULL DEFAULT 'awaiting_admin_review',
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "recurrenceRuleJson" JSONB,
  ADD COLUMN "recurringDayOfWeek" INTEGER,
  ADD COLUMN "recurringStartTime" TEXT,
  ADD COLUMN "recurringEndTime" TEXT,
  ADD COLUMN "preliminaryCallRequested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "preliminaryCallScheduledAt" TIMESTAMP(3);

UPDATE "HomeChefRequest"
SET "leadTimeCategory" = CASE
    WHEN "requestType" IN ('weekly_cooking', 'daily_cooking') THEN 'recurring'::"HomeChefLeadTimeCategory"
    WHEN "requestedDate" >= (CURRENT_TIMESTAMP + INTERVAL '7 days') THEN 'advance_booking'::"HomeChefLeadTimeCategory"
    WHEN "requestedDate" BETWEEN (CURRENT_TIMESTAMP + INTERVAL '1 day') AND (CURRENT_TIMESTAMP + INTERVAL '3 days') THEN 'short_term'::"HomeChefLeadTimeCategory"
    WHEN "requestedDate" < (CURRENT_TIMESTAMP + INTERVAL '12 hours') THEN 'same_day'::"HomeChefLeadTimeCategory"
    ELSE 'custom'::"HomeChefLeadTimeCategory"
  END,
  "matchingStatus" = CASE
    WHEN "status" = 'accepted' THEN 'chef_accepted'::"HomeChefMatchingStatus"
    WHEN "status" = 'declined' THEN 'chef_declined'::"HomeChefMatchingStatus"
    WHEN "status" = 'cancelled' THEN 'cancelled'::"HomeChefMatchingStatus"
    WHEN "status" = 'matched' THEN 'confirmed'::"HomeChefMatchingStatus"
    ELSE 'awaiting_admin_review'::"HomeChefMatchingStatus"
  END;

CREATE TABLE "HomeChefAcceptancePolicy" (
  "id" TEXT NOT NULL,
  "countryCode" TEXT,
  "region" TEXT,
  "city" TEXT,
  "requestType" "HomeChefRequestType",
  "leadTimeCategory" "HomeChefLeadTimeCategory" NOT NULL,
  "acceptanceWindowMinutes" INTEGER NOT NULL,
  "autoCascadeEnabled" BOOLEAN NOT NULL DEFAULT true,
  "maxCascadeAttempts" INTEGER NOT NULL DEFAULT 3,
  "cascadeDelayMinutes" INTEGER NOT NULL DEFAULT 10,
  "requireAdminReview" BOOLEAN NOT NULL DEFAULT true,
  "requireVerifiedChef" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeChefAcceptancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeChefRequestOffer" (
  "id" TEXT NOT NULL,
  "homeChefRequestId" TEXT NOT NULL,
  "chefProfileId" TEXT NOT NULL,
  "offeredById" TEXT NOT NULL,
  "status" "HomeChefRequestOfferStatus" NOT NULL DEFAULT 'pending',
  "offerType" "HomeChefRequestOfferType" NOT NULL DEFAULT 'direct',
  "responseDeadlineAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "responseMessage" TEXT,
  "quoteAmount" DOUBLE PRECISION,
  "currencyCode" TEXT,
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeChefRequestOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomeChefRequest_currentOfferId_key" ON "HomeChefRequest"("currentOfferId");
CREATE INDEX "HomeChefRequest_assignedChefProfileId_idx" ON "HomeChefRequest"("assignedChefProfileId");
CREATE INDEX "HomeChefRequest_leadTimeCategory_idx" ON "HomeChefRequest"("leadTimeCategory");
CREATE INDEX "HomeChefRequest_matchingStatus_idx" ON "HomeChefRequest"("matchingStatus");
CREATE INDEX "HomeChefRequest_currentOfferId_idx" ON "HomeChefRequest"("currentOfferId");
CREATE INDEX "HomeChefRequest_nextCascadeAt_idx" ON "HomeChefRequest"("nextCascadeAt");

CREATE INDEX "HomeChefAcceptancePolicy_countryCode_idx" ON "HomeChefAcceptancePolicy"("countryCode");
CREATE INDEX "HomeChefAcceptancePolicy_region_idx" ON "HomeChefAcceptancePolicy"("region");
CREATE INDEX "HomeChefAcceptancePolicy_city_idx" ON "HomeChefAcceptancePolicy"("city");
CREATE INDEX "HomeChefAcceptancePolicy_requestType_idx" ON "HomeChefAcceptancePolicy"("requestType");
CREATE INDEX "HomeChefAcceptancePolicy_leadTimeCategory_idx" ON "HomeChefAcceptancePolicy"("leadTimeCategory");
CREATE INDEX "HomeChefAcceptancePolicy_isActive_idx" ON "HomeChefAcceptancePolicy"("isActive");

CREATE INDEX "HomeChefRequestOffer_homeChefRequestId_idx" ON "HomeChefRequestOffer"("homeChefRequestId");
CREATE INDEX "HomeChefRequestOffer_chefProfileId_idx" ON "HomeChefRequestOffer"("chefProfileId");
CREATE INDEX "HomeChefRequestOffer_offeredById_idx" ON "HomeChefRequestOffer"("offeredById");
CREATE INDEX "HomeChefRequestOffer_status_idx" ON "HomeChefRequestOffer"("status");
CREATE INDEX "HomeChefRequestOffer_offerType_idx" ON "HomeChefRequestOffer"("offerType");
CREATE INDEX "HomeChefRequestOffer_responseDeadlineAt_idx" ON "HomeChefRequestOffer"("responseDeadlineAt");

ALTER TABLE "HomeChefRequest" ADD CONSTRAINT "HomeChefRequest_assignedChefProfileId_fkey" FOREIGN KEY ("assignedChefProfileId") REFERENCES "ChefProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HomeChefRequest" ADD CONSTRAINT "HomeChefRequest_currentOfferId_fkey" FOREIGN KEY ("currentOfferId") REFERENCES "HomeChefRequestOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HomeChefAcceptancePolicy" ADD CONSTRAINT "HomeChefAcceptancePolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HomeChefAcceptancePolicy" ADD CONSTRAINT "HomeChefAcceptancePolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HomeChefRequestOffer" ADD CONSTRAINT "HomeChefRequestOffer_homeChefRequestId_fkey" FOREIGN KEY ("homeChefRequestId") REFERENCES "HomeChefRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeChefRequestOffer" ADD CONSTRAINT "HomeChefRequestOffer_chefProfileId_fkey" FOREIGN KEY ("chefProfileId") REFERENCES "ChefProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeChefRequestOffer" ADD CONSTRAINT "HomeChefRequestOffer_offeredById_fkey" FOREIGN KEY ("offeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
