/*
  Warnings:

  - You are about to drop the `AiTrainingDataset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AiTrainingDatasetExample` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AiTrainingExample` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AiTrainingRun` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecipeVideoAnalysis` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VideoAnalysisIngredient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VideoAnalysisJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VideoAnalysisSourceFile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VideoAnalysisStep` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VideoRecipeDifference` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AiTrainingDataset" DROP CONSTRAINT "AiTrainingDataset_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "AiTrainingDatasetExample" DROP CONSTRAINT "AiTrainingDatasetExample_datasetId_fkey";

-- DropForeignKey
ALTER TABLE "AiTrainingDatasetExample" DROP CONSTRAINT "AiTrainingDatasetExample_exampleId_fkey";

-- DropForeignKey
ALTER TABLE "AiTrainingExample" DROP CONSTRAINT "AiTrainingExample_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "AiTrainingExample" DROP CONSTRAINT "AiTrainingExample_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "AiTrainingExample" DROP CONSTRAINT "AiTrainingExample_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "AiTrainingExample" DROP CONSTRAINT "AiTrainingExample_recipeMediaReferenceId_fkey";

-- DropForeignKey
ALTER TABLE "AiTrainingExample" DROP CONSTRAINT "AiTrainingExample_recipeVideoAnalysisId_fkey";

-- DropForeignKey
ALTER TABLE "AiTrainingExample" DROP CONSTRAINT "AiTrainingExample_verifiedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "AiTrainingRun" DROP CONSTRAINT "AiTrainingRun_datasetId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeVideoAnalysis" DROP CONSTRAINT "RecipeVideoAnalysis_analyzedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeVideoAnalysis" DROP CONSTRAINT "RecipeVideoAnalysis_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeVideoAnalysis" DROP CONSTRAINT "RecipeVideoAnalysis_recipeMediaReferenceId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeVideoAnalysis" DROP CONSTRAINT "RecipeVideoAnalysis_verifiedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "VideoAnalysisIngredient" DROP CONSTRAINT "VideoAnalysisIngredient_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "VideoAnalysisIngredient" DROP CONSTRAINT "VideoAnalysisIngredient_unitId_fkey";

-- DropForeignKey
ALTER TABLE "VideoAnalysisIngredient" DROP CONSTRAINT "VideoAnalysisIngredient_videoAnalysisId_fkey";

-- DropForeignKey
ALTER TABLE "VideoAnalysisJob" DROP CONSTRAINT "VideoAnalysisJob_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "VideoAnalysisJob" DROP CONSTRAINT "VideoAnalysisJob_recipeMediaReferenceId_fkey";

-- DropForeignKey
ALTER TABLE "VideoAnalysisJob" DROP CONSTRAINT "VideoAnalysisJob_requestedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "VideoAnalysisJob" DROP CONSTRAINT "VideoAnalysisJob_uploadedFileId_fkey";

-- DropForeignKey
ALTER TABLE "VideoAnalysisStep" DROP CONSTRAINT "VideoAnalysisStep_videoAnalysisId_fkey";

-- DropForeignKey
ALTER TABLE "VideoRecipeDifference" DROP CONSTRAINT "VideoRecipeDifference_videoAnalysisId_fkey";

-- DropTable
DROP TABLE "AiTrainingDataset";

-- DropTable
DROP TABLE "AiTrainingDatasetExample";

-- DropTable
DROP TABLE "AiTrainingExample";

-- DropTable
DROP TABLE "AiTrainingRun";

-- DropTable
DROP TABLE "RecipeVideoAnalysis";

-- DropTable
DROP TABLE "VideoAnalysisIngredient";

-- DropTable
DROP TABLE "VideoAnalysisJob";

-- DropTable
DROP TABLE "VideoAnalysisSourceFile";

-- DropTable
DROP TABLE "VideoAnalysisStep";

-- DropTable
DROP TABLE "VideoRecipeDifference";

-- DropEnum
DROP TYPE "AiModelType";

-- DropEnum
DROP TYPE "AiTrainingDatasetStatus";

-- DropEnum
DROP TYPE "AiTrainingExampleStatus";

-- DropEnum
DROP TYPE "AiTrainingRunStatus";

-- DropEnum
DROP TYPE "AiTrainingSourceType";

-- DropEnum
DROP TYPE "AiTrainingTaskType";

-- DropEnum
DROP TYPE "DifferenceSeverity";

-- DropEnum
DROP TYPE "VideoAnalysisConfidence";

-- DropEnum
DROP TYPE "VideoAnalysisJobStatus";

-- DropEnum
DROP TYPE "VideoAnalysisSource";

-- DropEnum
DROP TYPE "VideoAnalysisSourceType";

-- DropEnum
DROP TYPE "VideoAnalysisVerificationStatus";

-- DropEnum
DROP TYPE "VideoRecipeDifferenceType";
