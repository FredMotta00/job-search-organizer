-- CreateTable
CREATE TABLE "Profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "linksJson" TEXT NOT NULL DEFAULT '[]',
    "location" TEXT NOT NULL DEFAULT '',
    "desiredRolesJson" TEXT NOT NULL DEFAULT '[]',
    "senioritiesJson" TEXT NOT NULL DEFAULT '[]',
    "experiencesJson" TEXT NOT NULL DEFAULT '[]',
    "technologiesJson" TEXT NOT NULL DEFAULT '[]',
    "languagesJson" TEXT NOT NULL DEFAULT '[]',
    "educationJson" TEXT NOT NULL DEFAULT '[]',
    "workModesJson" TEXT NOT NULL DEFAULT '[]',
    "regionsJson" TEXT NOT NULL DEFAULT '[]',
    "contractTypesJson" TEXT NOT NULL DEFAULT '[]',
    "salaryExpectations" TEXT NOT NULL DEFAULT '[]',
    "availability" TEXT NOT NULL DEFAULT '',
    "excludedCompanies" TEXT NOT NULL DEFAULT '[]',
    "confirmedFactsJson" TEXT NOT NULL DEFAULT '[]',
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "url" TEXT,
    "normalizedUrl" TEXT,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requiredJson" TEXT NOT NULL DEFAULT '[]',
    "desiredJson" TEXT NOT NULL DEFAULT '[]',
    "responsibilitiesJson" TEXT NOT NULL DEFAULT '[]',
    "languagesJson" TEXT NOT NULL DEFAULT '[]',
    "location" TEXT,
    "workMode" TEXT,
    "seniority" TEXT,
    "contractType" TEXT,
    "salaryMin" REAL,
    "salaryMax" REAL,
    "currency" TEXT,
    "salaryPeriod" TEXT,
    "publishedAt" DATETIME,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fieldOriginsJson" TEXT NOT NULL DEFAULT '{}',
    "incomplete" BOOLEAN NOT NULL DEFAULT false,
    "possibleDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NOVA',
    "manualScore" INTEGER,
    "manualScoreReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MatchAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "coverage" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "matchedJson" TEXT NOT NULL DEFAULT '[]',
    "gapsJson" TEXT NOT NULL DEFAULT '[]',
    "unknownJson" TEXT NOT NULL DEFAULT '[]',
    "hardBlocksJson" TEXT NOT NULL DEFAULT '[]',
    "criteriaJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatchAssessment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "storedPath" TEXT,
    "extractedText" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "orientation" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "parentId" TEXT,
    "changesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Resume_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnswerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApplicationPreparation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "resumeId" TEXT,
    "opportunitySummary" TEXT NOT NULL,
    "shortIntroduction" TEXT NOT NULL,
    "coverLetter" TEXT,
    "suggestedAnswersJson" TEXT NOT NULL DEFAULT '[]',
    "pendingItemsJson" TEXT NOT NULL DEFAULT '[]',
    "groundedClaimsJson" TEXT NOT NULL DEFAULT '[]',
    "proposedChangesJson" TEXT NOT NULL DEFAULT '[]',
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "aiProvider" TEXT NOT NULL DEFAULT 'deterministic',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationPreparation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationPreparation_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "evidence" TEXT,
    "confirmedSent" BOOLEAN NOT NULL DEFAULT false,
    "sourceMessageId" TEXT,
    "resumeVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusHistory_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StatusHistory_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "technologiesWeight" INTEGER NOT NULL DEFAULT 30,
    "seniorityWeight" INTEGER NOT NULL DEFAULT 20,
    "locationWeight" INTEGER NOT NULL DEFAULT 15,
    "responsibilitiesWeight" INTEGER NOT NULL DEFAULT 15,
    "languageWeight" INTEGER NOT NULL DEFAULT 10,
    "salaryWeight" INTEGER NOT NULL DEFAULT 10,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiMonthlyLimit" INTEGER NOT NULL DEFAULT 30,
    "aiRequestsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "aiUsageMonth" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "selectedFolder" TEXT,
    "encryptedTokens" TEXT,
    "lastSyncAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT
);

-- CreateTable
CREATE TABLE "SchedulerLock" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "lockedUntil" DATETIME NOT NULL,
    "owner" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Job_normalizedUrl_idx" ON "Job"("normalizedUrl");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Job_source_externalId_key" ON "Job"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchAssessment_jobId_key" ON "MatchAssessment"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_provider_key" ON "Integration"("provider");
