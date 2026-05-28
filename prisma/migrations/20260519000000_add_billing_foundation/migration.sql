-- Drop old BillingSubscription table (incompatible columns — replaced below)
DROP TABLE IF EXISTS "BillingSubscription";

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('monthly', 'yearly', 'custom');

-- CreateEnum
CREATE TYPE "BillingPlanStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'unpaid', 'free');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('manual', 'stripe_placeholder');

-- CreateTable: BillingPlan
CREATE TABLE "BillingPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'monthly',
    "status" "BillingPlanStatus" NOT NULL DEFAULT 'draft',
    "limitsJson" JSONB NOT NULL DEFAULT '{}',
    "featuresJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BillingSubscription (new schema)
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'free',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "provider" "BillingProvider" NOT NULL DEFAULT 'manual',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BillingUsageRecord
CREATE TABLE "BillingUsageRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "usageType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: BillingPlan
CREATE UNIQUE INDEX "BillingPlan_slug_key" ON "BillingPlan"("slug");
CREATE INDEX "BillingPlan_status_idx" ON "BillingPlan"("status");
CREATE INDEX "BillingPlan_slug_idx" ON "BillingPlan"("slug");

-- CreateIndex: BillingSubscription
CREATE INDEX "BillingSubscription_organizationId_idx" ON "BillingSubscription"("organizationId");
CREATE INDEX "BillingSubscription_planId_idx" ON "BillingSubscription"("planId");
CREATE INDEX "BillingSubscription_status_idx" ON "BillingSubscription"("status");

-- CreateIndex: BillingUsageRecord
CREATE INDEX "BillingUsageRecord_organizationId_idx" ON "BillingUsageRecord"("organizationId");
CREATE INDEX "BillingUsageRecord_usageType_idx" ON "BillingUsageRecord"("usageType");
CREATE INDEX "BillingUsageRecord_periodStart_periodEnd_idx" ON "BillingUsageRecord"("periodStart", "periodEnd");

-- AddForeignKey: BillingSubscription -> Organization
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BillingSubscription -> BillingPlan
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
