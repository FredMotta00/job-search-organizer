-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Resume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "storedPath" TEXT,
    "extractedText" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "orientation" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "parentId" TEXT,
    "changesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Resume_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Resume" ("changesJson", "confirmed", "createdAt", "extractedText", "id", "mimeType", "name", "orientation", "originalFileName", "parentId", "size", "storedPath") SELECT "changesJson", "confirmed", "createdAt", "extractedText", "id", "mimeType", "name", "orientation", "originalFileName", "parentId", "size", "storedPath" FROM "Resume";
DROP TABLE "Resume";
ALTER TABLE "new_Resume" RENAME TO "Resume";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
