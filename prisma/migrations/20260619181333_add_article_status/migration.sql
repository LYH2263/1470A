-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importance" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "contentPlainText" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'published',
    "updatedAt" DATETIME NOT NULL,
    "categoryId" TEXT,
    CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Article" ("author", "categoryId", "content", "contentPlainText", "createdAt", "id", "importance", "title", "updatedAt", "views") SELECT "author", "categoryId", "content", "contentPlainText", "createdAt", "id", "importance", "title", "updatedAt", "views" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE INDEX "Article_title_idx" ON "Article"("title");
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt");
CREATE INDEX "Article_author_idx" ON "Article"("author");
CREATE INDEX "Article_categoryId_idx" ON "Article"("categoryId");
CREATE INDEX "Article_status_idx" ON "Article"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
