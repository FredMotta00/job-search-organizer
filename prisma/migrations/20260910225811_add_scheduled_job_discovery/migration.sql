-- AlterTable
ALTER TABLE "Job" ADD COLUMN "discoveryReason" TEXT;
ALTER TABLE "Job" ADD COLUMN "discoveryScore" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
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
    "discoveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "discoveryMinScore" INTEGER NOT NULL DEFAULT 65,
    "discoveryDailyLimit" INTEGER NOT NULL DEFAULT 20,
    "discoveryQueriesJson" TEXT NOT NULL DEFAULT '["desenvolvedor pleno","desenvolvedor full-stack","software engineer","backend developer","frontend developer","typescript developer","python developer","java developer","react developer","next.js developer","engenheiro de software"]',
    "discoverySourcesJson" TEXT NOT NULL DEFAULT '["LinkedIn","Indeed","Glassdoor"]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("aiEnabled", "aiMonthlyLimit", "aiRequestsThisMonth", "aiUsageMonth", "createdAt", "id", "languageWeight", "locationWeight", "responsibilitiesWeight", "salaryWeight", "seniorityWeight", "technologiesWeight", "updatedAt") SELECT "aiEnabled", "aiMonthlyLimit", "aiRequestsThisMonth", "aiUsageMonth", "createdAt", "id", "languageWeight", "locationWeight", "responsibilitiesWeight", "salaryWeight", "seniorityWeight", "technologiesWeight", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
