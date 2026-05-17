-- CreateEnum
CREATE TYPE "YouTubeDiscoveryRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "YouTubeVideoCandidateStatus" AS ENUM ('pending', 'approved', 'rejected', 'imported');

-- CreateTable
CREATE TABLE "YouTubeDiscoveryRun" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT,
    "organizationId" TEXT,
    "countryCode" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "status" "YouTubeDiscoveryRunStatus" NOT NULL DEFAULT 'queued',
    "queryCount" INTEGER NOT NULL DEFAULT 0,
    "candidatesFound" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeDiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubeVideoCandidate" (
    "id" TEXT NOT NULL,
    "discoveryRunId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "providerVideoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "channelId" TEXT,
    "channelTitle" TEXT,
    "thumbnailUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "viewCount" BIGINT,
    "likeCount" BIGINT,
    "commentCount" BIGINT,
    "searchQuery" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreReasonsJson" JSONB NOT NULL DEFAULT '[]',
    "professionalSignalsJson" JSONB NOT NULL DEFAULT '[]',
    "rejectionReasonsJson" JSONB,
    "status" "YouTubeVideoCandidateStatus" NOT NULL DEFAULT 'pending',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeVideoCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YouTubeDiscoveryRun_recipeId_idx" ON "YouTubeDiscoveryRun"("recipeId");

-- CreateIndex
CREATE INDEX "YouTubeDiscoveryRun_organizationId_idx" ON "YouTubeDiscoveryRun"("organizationId");

-- CreateIndex
CREATE INDEX "YouTubeDiscoveryRun_status_idx" ON "YouTubeDiscoveryRun"("status");

-- CreateIndex
CREATE INDEX "YouTubeVideoCandidate_discoveryRunId_idx" ON "YouTubeVideoCandidate"("discoveryRunId");

-- CreateIndex
CREATE INDEX "YouTubeVideoCandidate_recipeId_idx" ON "YouTubeVideoCandidate"("recipeId");

-- CreateIndex
CREATE INDEX "YouTubeVideoCandidate_status_idx" ON "YouTubeVideoCandidate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeVideoCandidate_recipeId_providerVideoId_key" ON "YouTubeVideoCandidate"("recipeId", "providerVideoId");

-- AddForeignKey
ALTER TABLE "YouTubeDiscoveryRun" ADD CONSTRAINT "YouTubeDiscoveryRun_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeDiscoveryRun" ADD CONSTRAINT "YouTubeDiscoveryRun_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeVideoCandidate" ADD CONSTRAINT "YouTubeVideoCandidate_discoveryRunId_fkey" FOREIGN KEY ("discoveryRunId") REFERENCES "YouTubeDiscoveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeVideoCandidate" ADD CONSTRAINT "YouTubeVideoCandidate_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeVideoCandidate" ADD CONSTRAINT "YouTubeVideoCandidate_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
