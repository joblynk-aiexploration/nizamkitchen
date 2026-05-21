-- CreateEnum
CREATE TYPE "TaxConfigurationStatus" AS ENUM ('draft', 'active', 'disabled', 'archived');

-- CreateEnum
CREATE TYPE "TaxCalculationMode" AS ENUM ('disabled', 'flat_percent', 'manual');

-- CreateEnum
CREATE TYPE "AccountingDocumentType" AS ENUM ('invoice', 'receipt');

-- CreateEnum
CREATE TYPE "AccountingDocumentStatus" AS ENUM ('draft', 'issued', 'void');

-- CreateEnum
CREATE TYPE "CommissionRecordStatus" AS ENUM ('pending', 'earned', 'reversed');

-- CreateEnum
CREATE TYPE "SellerSettlementStatus" AS ENUM ('draft', 'pending', 'approved', 'paid', 'cancelled');

-- CreateTable
CREATE TABLE "TaxConfiguration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT,
    "region" TEXT,
    "currencyCode" TEXT,
    "module" "PaymentModule",
    "mode" "TaxCalculationMode" NOT NULL DEFAULT 'disabled',
    "taxPercent" DECIMAL(5,2),
    "fixedTaxAmount" DECIMAL(10,2),
    "status" "TaxConfigurationStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingDocument" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentType" "AccountingDocumentType" NOT NULL,
    "status" "AccountingDocumentStatus" NOT NULL DEFAULT 'issued',
    "paymentOrderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerOrganizationId" TEXT,
    "sellerOrganizationId" TEXT,
    "countryCode" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "subtotalAmount" DECIMAL(10,2) NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "platformFeeAmount" DECIMAL(10,2),
    "sellerAmount" DECIMAL(10,2),
    "pdfFileId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRecord" (
    "id" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "sellerOrganizationId" TEXT,
    "countryCode" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "grossAmount" DECIMAL(10,2) NOT NULL,
    "platformFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sellerAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "commissionPercent" DECIMAL(5,2),
    "status" "CommissionRecordStatus" NOT NULL DEFAULT 'earned',
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerSettlementReport" (
    "id" TEXT NOT NULL,
    "sellerOrganizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "SellerSettlementStatus" NOT NULL DEFAULT 'draft',
    "grossAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "platformFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "refundAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sellerNetAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentOrderId" TEXT,
    "reportFileId" TEXT,
    "generatedById" TEXT,
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerSettlementReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxConfiguration_countryCode_idx" ON "TaxConfiguration"("countryCode");

-- CreateIndex
CREATE INDEX "TaxConfiguration_currencyCode_idx" ON "TaxConfiguration"("currencyCode");

-- CreateIndex
CREATE INDEX "TaxConfiguration_module_idx" ON "TaxConfiguration"("module");

-- CreateIndex
CREATE INDEX "TaxConfiguration_status_idx" ON "TaxConfiguration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingDocument_documentNumber_key" ON "AccountingDocument"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingDocument_paymentOrderId_documentType_key" ON "AccountingDocument"("paymentOrderId", "documentType");

-- CreateIndex
CREATE INDEX "AccountingDocument_organizationId_idx" ON "AccountingDocument"("organizationId");

-- CreateIndex
CREATE INDEX "AccountingDocument_customerOrganizationId_idx" ON "AccountingDocument"("customerOrganizationId");

-- CreateIndex
CREATE INDEX "AccountingDocument_sellerOrganizationId_idx" ON "AccountingDocument"("sellerOrganizationId");

-- CreateIndex
CREATE INDEX "AccountingDocument_countryCode_idx" ON "AccountingDocument"("countryCode");

-- CreateIndex
CREATE INDEX "AccountingDocument_documentType_idx" ON "AccountingDocument"("documentType");

-- CreateIndex
CREATE INDEX "AccountingDocument_status_idx" ON "AccountingDocument"("status");

-- CreateIndex
CREATE INDEX "AccountingDocument_issuedAt_idx" ON "AccountingDocument"("issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRecord_paymentOrderId_key" ON "CommissionRecord"("paymentOrderId");

-- CreateIndex
CREATE INDEX "CommissionRecord_sellerOrganizationId_idx" ON "CommissionRecord"("sellerOrganizationId");

-- CreateIndex
CREATE INDEX "CommissionRecord_countryCode_idx" ON "CommissionRecord"("countryCode");

-- CreateIndex
CREATE INDEX "CommissionRecord_status_idx" ON "CommissionRecord"("status");

-- CreateIndex
CREATE INDEX "CommissionRecord_earnedAt_idx" ON "CommissionRecord"("earnedAt");

-- CreateIndex
CREATE INDEX "SellerSettlementReport_sellerOrganizationId_idx" ON "SellerSettlementReport"("sellerOrganizationId");

-- CreateIndex
CREATE INDEX "SellerSettlementReport_countryCode_idx" ON "SellerSettlementReport"("countryCode");

-- CreateIndex
CREATE INDEX "SellerSettlementReport_status_idx" ON "SellerSettlementReport"("status");

-- CreateIndex
CREATE INDEX "SellerSettlementReport_periodStart_periodEnd_idx" ON "SellerSettlementReport"("periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerSettlementReport" ADD CONSTRAINT "SellerSettlementReport_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerSettlementReport" ADD CONSTRAINT "SellerSettlementReport_sellerOrganizationId_fkey" FOREIGN KEY ("sellerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
