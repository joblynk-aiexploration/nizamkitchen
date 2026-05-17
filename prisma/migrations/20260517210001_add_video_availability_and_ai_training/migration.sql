-- CreateEnum: VideoAvailabilityStatus
CREATE TYPE "VideoAvailabilityStatus" AS ENUM ('unchecked', 'available', 'unavailable', 'restricted', 'unknown');

-- CreateEnum: AI Training enums
CREATE TYPE "AiTrainingExampleStatus" AS ENUM ('draft', 'verified', 'rejected', 'exported');
CREATE TYPE "AiTrainingSourceType" AS ENUM ('manual', 'ai_draft_corrected', 'transcript', 'video_analysis', 'imported');
CREATE TYPE "AiTrainingTaskType" AS ENUM ('cooking_video_transcript_to_structured_analysis', 'ingredient_extraction', 'cooking_step_extraction', 'recipe_difference_detection');
CREATE TYPE "AiTrainingDatasetStatus" AS ENUM ('draft', 'ready', 'exported', 'archived');
CREATE TYPE "AiTrainingRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE "AiModelType" AS ENUM ('local_rules', 'local_finetune_placeholder', 'local_http', 'external_placeholder');

-- AlterTable: RecipeMediaReference — add availability fields
ALTER TABLE "RecipeMediaReference"
  ADD COLUMN "availabilityStatus"        "VideoAvailabilityStatus" NOT NULL DEFAULT 'unchecked',
  ADD COLUMN "lastAvailabilityCheckedAt" TIMESTAMP(3),
  ADD COLUMN "unavailableReason"         TEXT,
  ADD COLUMN "isEmbeddable"              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isPublic"                  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "uploadStatus"              TEXT,
  ADD COLUMN "liveBroadcastContent"      TEXT,
  ADD COLUMN "qualityDefinition"         TEXT;

-- AlterTable: YouTubeVideoCandidate — add availability fields
ALTER TABLE "YouTubeVideoCandidate"
  ADD COLUMN "availabilityStatus"        "VideoAvailabilityStatus" NOT NULL DEFAULT 'unchecked',
  ADD COLUMN "lastAvailabilityCheckedAt" TIMESTAMP(3),
  ADD COLUMN "unavailableReason"         TEXT,
  ADD COLUMN "isEmbeddable"              BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isPublic"                  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "uploadStatus"              TEXT,
  ADD COLUMN "liveBroadcastContent"      TEXT,
  ADD COLUMN "qualityDefinition"         TEXT;

-- CreateIndex on availability
CREATE INDEX "RecipeMediaReference_availabilityStatus_idx" ON "RecipeMediaReference"("availabilityStatus");
CREATE INDEX "YouTubeVideoCandidate_availabilityStatus_idx" ON "YouTubeVideoCandidate"("availabilityStatus");

-- CreateTable: AiTrainingExample
CREATE TABLE "AiTrainingExample" (
    "id"                     TEXT NOT NULL,
    "organizationId"         TEXT,
    "countryCode"             TEXT,
    "recipeId"               TEXT,
    "recipeMediaReferenceId" TEXT,
    "recipeVideoAnalysisId"  TEXT,
    "createdByUserId"        TEXT NOT NULL,
    "verifiedByUserId"       TEXT,
    "status"                 "AiTrainingExampleStatus" NOT NULL DEFAULT 'draft',
    "sourceType"             "AiTrainingSourceType" NOT NULL,
    "taskType"               "AiTrainingTaskType" NOT NULL,
    "inputJson"              JSONB NOT NULL,
    "expectedOutputJson"     JSONB NOT NULL,
    "notes"                  TEXT,
    "qualityScore"           INTEGER,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,
    "verifiedAt"             TIMESTAMP(3),

    CONSTRAINT "AiTrainingExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AiTrainingDataset
CREATE TABLE "AiTrainingDataset" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "status"          "AiTrainingDatasetStatus" NOT NULL DEFAULT 'draft',
    "taskType"        "AiTrainingTaskType" NOT NULL,
    "exampleCount"    INTEGER NOT NULL DEFAULT 0,
    "version"         INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTrainingDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AiTrainingDatasetExample
CREATE TABLE "AiTrainingDatasetExample" (
    "id"        TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "exampleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTrainingDatasetExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AiTrainingRun
CREATE TABLE "AiTrainingRun" (
    "id"                 TEXT NOT NULL,
    "datasetId"          TEXT NOT NULL,
    "status"             "AiTrainingRunStatus" NOT NULL DEFAULT 'queued',
    "modelType"          "AiModelType" NOT NULL,
    "baseModel"          TEXT,
    "outputModelPath"    TEXT,
    "trainingConfigJson" JSONB NOT NULL,
    "metricsJson"        JSONB,
    "errorMessage"       TEXT,
    "startedAt"          TIMESTAMP(3),
    "completedAt"        TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTrainingRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: AiTrainingExample
CREATE UNIQUE INDEX "AiTrainingExample_recipeVideoAnalysisId_key" ON "AiTrainingExample"("recipeVideoAnalysisId");
CREATE INDEX "AiTrainingExample_organizationId_idx" ON "AiTrainingExample"("organizationId");
CREATE INDEX "AiTrainingExample_countryCode_idx" ON "AiTrainingExample"("countryCode");
CREATE INDEX "AiTrainingExample_recipeId_idx" ON "AiTrainingExample"("recipeId");
CREATE INDEX "AiTrainingExample_status_idx" ON "AiTrainingExample"("status");
CREATE INDEX "AiTrainingExample_taskType_idx" ON "AiTrainingExample"("taskType");

-- CreateIndex: AiTrainingDataset
CREATE INDEX "AiTrainingDataset_status_idx" ON "AiTrainingDataset"("status");
CREATE INDEX "AiTrainingDataset_taskType_idx" ON "AiTrainingDataset"("taskType");

-- CreateIndex: AiTrainingDatasetExample
CREATE UNIQUE INDEX "AiTrainingDatasetExample_datasetId_exampleId_key" ON "AiTrainingDatasetExample"("datasetId", "exampleId");
CREATE INDEX "AiTrainingDatasetExample_exampleId_idx" ON "AiTrainingDatasetExample"("exampleId");

-- CreateIndex: AiTrainingRun
CREATE INDEX "AiTrainingRun_datasetId_idx" ON "AiTrainingRun"("datasetId");
CREATE INDEX "AiTrainingRun_status_idx" ON "AiTrainingRun"("status");

-- AddForeignKey: AiTrainingExample
ALTER TABLE "AiTrainingExample" ADD CONSTRAINT "AiTrainingExample_organizationId_fkey"         FOREIGN KEY ("organizationId")         REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiTrainingExample" ADD CONSTRAINT "AiTrainingExample_recipeId_fkey"               FOREIGN KEY ("recipeId")               REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiTrainingExample" ADD CONSTRAINT "AiTrainingExample_recipeMediaReferenceId_fkey" FOREIGN KEY ("recipeMediaReferenceId") REFERENCES "RecipeMediaReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiTrainingExample" ADD CONSTRAINT "AiTrainingExample_recipeVideoAnalysisId_fkey"  FOREIGN KEY ("recipeVideoAnalysisId")  REFERENCES "RecipeVideoAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiTrainingExample" ADD CONSTRAINT "AiTrainingExample_createdByUserId_fkey"        FOREIGN KEY ("createdByUserId")        REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiTrainingExample" ADD CONSTRAINT "AiTrainingExample_verifiedByUserId_fkey"       FOREIGN KEY ("verifiedByUserId")       REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: AiTrainingDataset
ALTER TABLE "AiTrainingDataset" ADD CONSTRAINT "AiTrainingDataset_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: AiTrainingDatasetExample
ALTER TABLE "AiTrainingDatasetExample" ADD CONSTRAINT "AiTrainingDatasetExample_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AiTrainingDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiTrainingDatasetExample" ADD CONSTRAINT "AiTrainingDatasetExample_exampleId_fkey" FOREIGN KEY ("exampleId") REFERENCES "AiTrainingExample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AiTrainingRun
ALTER TABLE "AiTrainingRun" ADD CONSTRAINT "AiTrainingRun_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "AiTrainingDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
