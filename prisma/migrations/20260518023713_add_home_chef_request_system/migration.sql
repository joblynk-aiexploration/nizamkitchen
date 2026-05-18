-- CreateEnum
CREATE TYPE "HomeChefRequestStatus" AS ENUM ('draft', 'submitted', 'reviewing', 'matched', 'quoted', 'accepted', 'declined', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "HomeChefRequestType" AS ENUM ('recipe', 'meal_plan', 'occasion', 'weekly_cooking', 'daily_cooking', 'custom');

-- CreateEnum
CREATE TYPE "GenderPreference" AS ENUM ('no_preference', 'female_preferred', 'male_preferred');

-- CreateEnum
CREATE TYPE "HomeChefMessageSenderRole" AS ENUM ('household', 'admin', 'chef', 'support');

-- CreateTable
CREATE TABLE "HomeChefRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "HomeChefRequestStatus" NOT NULL DEFAULT 'draft',
    "requestType" "HomeChefRequestType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mealPlanId" TEXT,
    "recipeId" TEXT,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "requestedTimeWindow" TEXT,
    "guestCount" INTEGER NOT NULL,
    "householdSize" INTEGER,
    "serviceAddressLine1" TEXT,
    "serviceAddressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "preferredLanguage" TEXT,
    "genderPreference" "GenderPreference" NOT NULL DEFAULT 'no_preference',
    "budgetAmount" DOUBLE PRECISION,
    "budgetCurrency" TEXT,
    "notes" TEXT,
    "adminNotes" TEXT,
    "assignedChefOrganizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeChefRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeChefRequestMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "senderRole" "HomeChefMessageSenderRole" NOT NULL,
    "message" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeChefRequestMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeChefRequestStatusHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "oldStatus" "HomeChefRequestStatus",
    "newStatus" "HomeChefRequestStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeChefRequestStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeChefRequest_organizationId_idx" ON "HomeChefRequest"("organizationId");

-- CreateIndex
CREATE INDEX "HomeChefRequest_countryCode_idx" ON "HomeChefRequest"("countryCode");

-- CreateIndex
CREATE INDEX "HomeChefRequest_createdById_idx" ON "HomeChefRequest"("createdById");

-- CreateIndex
CREATE INDEX "HomeChefRequest_status_idx" ON "HomeChefRequest"("status");

-- CreateIndex
CREATE INDEX "HomeChefRequest_requestType_idx" ON "HomeChefRequest"("requestType");

-- CreateIndex
CREATE INDEX "HomeChefRequest_requestedDate_idx" ON "HomeChefRequest"("requestedDate");

-- CreateIndex
CREATE INDEX "HomeChefRequest_mealPlanId_idx" ON "HomeChefRequest"("mealPlanId");

-- CreateIndex
CREATE INDEX "HomeChefRequest_recipeId_idx" ON "HomeChefRequest"("recipeId");

-- CreateIndex
CREATE INDEX "HomeChefRequest_assignedChefOrganizationId_idx" ON "HomeChefRequest"("assignedChefOrganizationId");

-- CreateIndex
CREATE INDEX "HomeChefRequestMessage_requestId_idx" ON "HomeChefRequestMessage"("requestId");

-- CreateIndex
CREATE INDEX "HomeChefRequestMessage_senderUserId_idx" ON "HomeChefRequestMessage"("senderUserId");

-- CreateIndex
CREATE INDEX "HomeChefRequestMessage_isInternal_idx" ON "HomeChefRequestMessage"("isInternal");

-- CreateIndex
CREATE INDEX "HomeChefRequestStatusHistory_requestId_idx" ON "HomeChefRequestStatusHistory"("requestId");

-- CreateIndex
CREATE INDEX "HomeChefRequestStatusHistory_changedById_idx" ON "HomeChefRequestStatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "HomeChefRequestStatusHistory_newStatus_idx" ON "HomeChefRequestStatusHistory"("newStatus");

-- AddForeignKey
ALTER TABLE "HomeChefRequest" ADD CONSTRAINT "HomeChefRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeChefRequest" ADD CONSTRAINT "HomeChefRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeChefRequest" ADD CONSTRAINT "HomeChefRequest_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeChefRequest" ADD CONSTRAINT "HomeChefRequest_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeChefRequest" ADD CONSTRAINT "HomeChefRequest_assignedChefOrganizationId_fkey" FOREIGN KEY ("assignedChefOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeChefRequestMessage" ADD CONSTRAINT "HomeChefRequestMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HomeChefRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeChefRequestMessage" ADD CONSTRAINT "HomeChefRequestMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeChefRequestStatusHistory" ADD CONSTRAINT "HomeChefRequestStatusHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HomeChefRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeChefRequestStatusHistory" ADD CONSTRAINT "HomeChefRequestStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
