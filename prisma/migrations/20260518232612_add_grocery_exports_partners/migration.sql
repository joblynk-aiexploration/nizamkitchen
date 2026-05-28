-- CreateEnum
CREATE TYPE "GroceryPartnerStatus" AS ENUM ('draft', 'active', 'paused', 'disabled');

-- CreateEnum
CREATE TYPE "GroceryIntegrationType" AS ENUM ('manual_link', 'affiliate_link', 'api_placeholder', 'export_only');

-- CreateEnum
CREATE TYPE "GroceryListExportType" AS ENUM ('pdf', 'csv', 'print', 'copy', 'share_link');

-- CreateTable
CREATE TABLE "GroceryPartner" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "GroceryPartnerStatus" NOT NULL DEFAULT 'draft',
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "supportedRegions" JSONB,
    "integrationType" "GroceryIntegrationType" NOT NULL DEFAULT 'export_only',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryListShare" (
    "id" TEXT NOT NULL,
    "groceryListId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryListShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryListExport" (
    "id" TEXT NOT NULL,
    "groceryListId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "exportType" "GroceryListExportType" NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryListExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroceryPartner_slug_key" ON "GroceryPartner"("slug");

-- CreateIndex
CREATE INDEX "GroceryPartner_countryCode_idx" ON "GroceryPartner"("countryCode");

-- CreateIndex
CREATE INDEX "GroceryPartner_status_idx" ON "GroceryPartner"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GroceryListShare_tokenHash_key" ON "GroceryListShare"("tokenHash");

-- CreateIndex
CREATE INDEX "GroceryListShare_groceryListId_idx" ON "GroceryListShare"("groceryListId");

-- CreateIndex
CREATE INDEX "GroceryListShare_organizationId_idx" ON "GroceryListShare"("organizationId");

-- CreateIndex
CREATE INDEX "GroceryListShare_revokedAt_idx" ON "GroceryListShare"("revokedAt");

-- CreateIndex
CREATE INDEX "GroceryListShare_expiresAt_idx" ON "GroceryListShare"("expiresAt");

-- CreateIndex
CREATE INDEX "GroceryListExport_groceryListId_idx" ON "GroceryListExport"("groceryListId");

-- CreateIndex
CREATE INDEX "GroceryListExport_organizationId_idx" ON "GroceryListExport"("organizationId");

-- CreateIndex
CREATE INDEX "GroceryListExport_exportType_idx" ON "GroceryListExport"("exportType");

-- AddForeignKey
ALTER TABLE "GroceryPartner" ADD CONSTRAINT "GroceryPartner_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("countryCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListShare" ADD CONSTRAINT "GroceryListShare_groceryListId_fkey" FOREIGN KEY ("groceryListId") REFERENCES "GroceryList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListShare" ADD CONSTRAINT "GroceryListShare_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListShare" ADD CONSTRAINT "GroceryListShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListExport" ADD CONSTRAINT "GroceryListExport_groceryListId_fkey" FOREIGN KEY ("groceryListId") REFERENCES "GroceryList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListExport" ADD CONSTRAINT "GroceryListExport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListExport" ADD CONSTRAINT "GroceryListExport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
