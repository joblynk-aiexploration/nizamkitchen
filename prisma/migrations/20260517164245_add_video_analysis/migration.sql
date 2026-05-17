/*
  Warnings:

  - The `provider` column on the `RecipeMediaReference` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updatedAt` to the `RecipeMediaReference` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MediaProvider" AS ENUM ('youtube', 'manual', 'other');

-- CreateEnum
CREATE TYPE "VideoAnalysisSource" AS ENUM ('manual', 'transcript_ai', 'frames_ai', 'transcript_and_frames_ai', 'imported');

-- CreateEnum
CREATE TYPE "VideoAnalysisVerificationStatus" AS ENUM ('ai_draft', 'needs_review', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "VideoAnalysisConfidence" AS ENUM ('exact', 'high', 'medium', 'low', 'unknown');

-- CreateEnum
CREATE TYPE "VideoAnalysisJobStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "VideoAnalysisSourceType" AS ENUM ('youtube_reference', 'pasted_transcript', 'uploaded_video', 'uploaded_audio', 'manual');

-- CreateEnum
CREATE TYPE "VideoRecipeDifferenceType" AS ENUM ('ingredient_difference', 'quantity_difference', 'step_difference', 'timing_difference', 'technique_difference', 'spice_level_difference', 'other');

-- CreateEnum
CREATE TYPE "DifferenceSeverity" AS ENUM ('info', 'warning', 'important');

-- AlterTable
ALTER TABLE "RecipeMediaReference" ADD COLUMN     "creatorName" TEXT,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "embedUrl" TEXT,
ADD COLUMN     "normalizedUrl" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "provider",
ADD COLUMN     "provider" "MediaProvider" NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "RecipeVideoAnalysis" (
    "id" TEXT NOT NULL,
    "recipeMediaReferenceId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "organizationId" TEXT,
    "countryCode" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "analysisSource" "VideoAnalysisSource" NOT NULL,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "verificationStatus" "VideoAnalysisVerificationStatus" NOT NULL DEFAULT 'ai_draft',
    "confidence" "VideoAnalysisConfidence" NOT NULL DEFAULT 'unknown',
    "analyzedByUserId" TEXT,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rawTranscriptProvided" BOOLEAN NOT NULL DEFAULT false,
    "framesAnalyzedCount" INTEGER,
    "analysisCostCents" INTEGER,
    "errorMessage" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeVideoAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoAnalysisIngredient" (
    "id" TEXT NOT NULL,
    "videoAnalysisId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "ingredientName" TEXT NOT NULL,
    "normalizedIngredientName" TEXT,
    "quantity" DOUBLE PRECISION,
    "unitId" TEXT,
    "unitName" TEXT,
    "preparationNote" TEXT,
    "timestampStartSeconds" INTEGER,
    "timestampEndSeconds" INTEGER,
    "confidence" "VideoAnalysisConfidence" NOT NULL DEFAULT 'unknown',
    "evidenceText" TEXT,
    "evidenceFrameTimestamp" INTEGER,
    "notes" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAnalysisIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoAnalysisStep" (
    "id" TEXT NOT NULL,
    "videoAnalysisId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "timestampStartSeconds" INTEGER,
    "timestampEndSeconds" INTEGER,
    "durationSeconds" INTEGER,
    "temperature" TEXT,
    "technique" TEXT,
    "confidence" "VideoAnalysisConfidence" NOT NULL DEFAULT 'unknown',
    "evidenceText" TEXT,
    "evidenceFrameTimestamp" INTEGER,
    "notes" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAnalysisStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoRecipeDifference" (
    "id" TEXT NOT NULL,
    "videoAnalysisId" TEXT NOT NULL,
    "differenceType" "VideoRecipeDifferenceType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "DifferenceSeverity" NOT NULL DEFAULT 'info',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoRecipeDifference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoAnalysisJob" (
    "id" TEXT NOT NULL,
    "recipeMediaReferenceId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "organizationId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "status" "VideoAnalysisJobStatus" NOT NULL DEFAULT 'queued',
    "sourceType" "VideoAnalysisSourceType" NOT NULL,
    "transcriptText" TEXT,
    "uploadedFileId" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeVideoAnalysis_recipeMediaReferenceId_idx" ON "RecipeVideoAnalysis"("recipeMediaReferenceId");

-- CreateIndex
CREATE INDEX "RecipeVideoAnalysis_recipeId_idx" ON "RecipeVideoAnalysis"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeVideoAnalysis_organizationId_idx" ON "RecipeVideoAnalysis"("organizationId");

-- CreateIndex
CREATE INDEX "RecipeVideoAnalysis_verificationStatus_idx" ON "RecipeVideoAnalysis"("verificationStatus");

-- CreateIndex
CREATE INDEX "VideoAnalysisIngredient_videoAnalysisId_idx" ON "VideoAnalysisIngredient"("videoAnalysisId");

-- CreateIndex
CREATE INDEX "VideoAnalysisIngredient_ingredientId_idx" ON "VideoAnalysisIngredient"("ingredientId");

-- CreateIndex
CREATE INDEX "VideoAnalysisStep_videoAnalysisId_idx" ON "VideoAnalysisStep"("videoAnalysisId");

-- CreateIndex
CREATE INDEX "VideoRecipeDifference_videoAnalysisId_idx" ON "VideoRecipeDifference"("videoAnalysisId");

-- CreateIndex
CREATE INDEX "VideoAnalysisJob_recipeMediaReferenceId_idx" ON "VideoAnalysisJob"("recipeMediaReferenceId");

-- CreateIndex
CREATE INDEX "VideoAnalysisJob_recipeId_idx" ON "VideoAnalysisJob"("recipeId");

-- CreateIndex
CREATE INDEX "VideoAnalysisJob_organizationId_idx" ON "VideoAnalysisJob"("organizationId");

-- CreateIndex
CREATE INDEX "VideoAnalysisJob_status_idx" ON "VideoAnalysisJob"("status");

-- CreateIndex
CREATE INDEX "RecipeMediaReference_isPrimary_idx" ON "RecipeMediaReference"("isPrimary");

-- AddForeignKey
ALTER TABLE "RecipeVideoAnalysis" ADD CONSTRAINT "RecipeVideoAnalysis_recipeMediaReferenceId_fkey" FOREIGN KEY ("recipeMediaReferenceId") REFERENCES "RecipeMediaReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVideoAnalysis" ADD CONSTRAINT "RecipeVideoAnalysis_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVideoAnalysis" ADD CONSTRAINT "RecipeVideoAnalysis_analyzedByUserId_fkey" FOREIGN KEY ("analyzedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVideoAnalysis" ADD CONSTRAINT "RecipeVideoAnalysis_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAnalysisIngredient" ADD CONSTRAINT "VideoAnalysisIngredient_videoAnalysisId_fkey" FOREIGN KEY ("videoAnalysisId") REFERENCES "RecipeVideoAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAnalysisIngredient" ADD CONSTRAINT "VideoAnalysisIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAnalysisIngredient" ADD CONSTRAINT "VideoAnalysisIngredient_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAnalysisStep" ADD CONSTRAINT "VideoAnalysisStep_videoAnalysisId_fkey" FOREIGN KEY ("videoAnalysisId") REFERENCES "RecipeVideoAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoRecipeDifference" ADD CONSTRAINT "VideoRecipeDifference_videoAnalysisId_fkey" FOREIGN KEY ("videoAnalysisId") REFERENCES "RecipeVideoAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAnalysisJob" ADD CONSTRAINT "VideoAnalysisJob_recipeMediaReferenceId_fkey" FOREIGN KEY ("recipeMediaReferenceId") REFERENCES "RecipeMediaReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAnalysisJob" ADD CONSTRAINT "VideoAnalysisJob_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAnalysisJob" ADD CONSTRAINT "VideoAnalysisJob_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
