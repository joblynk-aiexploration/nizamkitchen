-- CreateEnum
CREATE TYPE "IngredientRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "sourceRecipeId" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN "isUserCustomized" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "IngredientRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedName" TEXT NOT NULL,
    "suggestedCategory" "IngredientCategory",
    "notes" TEXT,
    "status" "IngredientRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdIngredientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recipe_sourceRecipeId_idx" ON "Recipe"("sourceRecipeId");
CREATE INDEX "Recipe_isTemplate_idx" ON "Recipe"("isTemplate");
CREATE INDEX "Recipe_isUserCustomized_idx" ON "Recipe"("isUserCustomized");
CREATE INDEX "IngredientRequest_organizationId_idx" ON "IngredientRequest"("organizationId");
CREATE INDEX "IngredientRequest_requestedById_idx" ON "IngredientRequest"("requestedById");
CREATE INDEX "IngredientRequest_status_idx" ON "IngredientRequest"("status");
CREATE INDEX "IngredientRequest_createdIngredientId_idx" ON "IngredientRequest"("createdIngredientId");
CREATE INDEX "IngredientRequest_createdAt_idx" ON "IngredientRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_sourceRecipeId_fkey" FOREIGN KEY ("sourceRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
