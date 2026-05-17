-- CreateTable
CREATE TABLE "VideoAnalysisSourceFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalFileName" TEXT,
    "durationSeconds" INTEGER,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAnalysisSourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoAnalysisSourceFile_storageKey_key" ON "VideoAnalysisSourceFile"("storageKey");

-- CreateIndex
CREATE INDEX "VideoAnalysisSourceFile_organizationId_idx" ON "VideoAnalysisSourceFile"("organizationId");

-- CreateIndex
CREATE INDEX "VideoAnalysisSourceFile_uploadedByUserId_idx" ON "VideoAnalysisSourceFile"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "VideoAnalysisSourceFile_processingStatus_idx" ON "VideoAnalysisSourceFile"("processingStatus");

-- CreateIndex
CREATE INDEX "VideoAnalysisJob_uploadedFileId_idx" ON "VideoAnalysisJob"("uploadedFileId");

-- AddForeignKey
ALTER TABLE "VideoAnalysisJob" ADD CONSTRAINT "VideoAnalysisJob_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "VideoAnalysisSourceFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
