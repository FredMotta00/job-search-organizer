-- CreateTable
CREATE TABLE "ApplicationAutomation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "preparationId" TEXT,
    "resumeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "filledFieldsJson" TEXT NOT NULL DEFAULT '[]',
    "pendingFieldsJson" TEXT NOT NULL DEFAULT '[]',
    "lastError" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApplicationAutomation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationAutomation_preparationId_fkey" FOREIGN KEY ("preparationId") REFERENCES "ApplicationPreparation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApplicationAutomation_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ApplicationAutomation_jobId_createdAt_idx" ON "ApplicationAutomation"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAutomation_status_idx" ON "ApplicationAutomation"("status");
