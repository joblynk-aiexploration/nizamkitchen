-- CreateEnum
CREATE TYPE "ModulePaymentStatus" AS ENUM ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'not_required');

-- AlterEnum
ALTER TYPE "BillingProvider" ADD VALUE 'stripe';

-- AlterTable
ALTER TABLE "BillingPlan" ADD COLUMN     "stripePriceId" TEXT;

-- AlterTable
ALTER TABLE "BillingSubscription" ADD COLUMN     "paymentOrderId" TEXT;

-- AlterTable
ALTER TABLE "FoodOrder" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentOrderId" TEXT,
ADD COLUMN     "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentStatus" "ModulePaymentStatus" NOT NULL DEFAULT 'not_required';

-- AlterTable
ALTER TABLE "HomeChefRequest" ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "depositAmount" DOUBLE PRECISION,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentOrderId" TEXT,
ADD COLUMN     "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentStatus" "ModulePaymentStatus" NOT NULL DEFAULT 'not_required',
ADD COLUMN     "quotedAmount" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "FoodOrder_paymentStatus_idx" ON "FoodOrder"("paymentStatus");

-- CreateIndex
CREATE INDEX "FoodOrder_paymentOrderId_idx" ON "FoodOrder"("paymentOrderId");

-- CreateIndex
CREATE INDEX "HomeChefRequest_paymentStatus_idx" ON "HomeChefRequest"("paymentStatus");

-- CreateIndex
CREATE INDEX "HomeChefRequest_paymentOrderId_idx" ON "HomeChefRequest"("paymentOrderId");
