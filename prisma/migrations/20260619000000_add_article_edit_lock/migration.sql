-- CreateTable
CREATE TABLE "ArticleEditLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "lastHeartbeat" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArticleEditLock_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArticleEditLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleEditLock_articleId_key" ON "ArticleEditLock"("articleId");

-- CreateIndex
CREATE INDEX "ArticleEditLock_articleId_idx" ON "ArticleEditLock"("articleId");

-- CreateIndex
CREATE INDEX "ArticleEditLock_userId_idx" ON "ArticleEditLock"("userId");

-- CreateIndex
CREATE INDEX "ArticleEditLock_expiresAt_idx" ON "ArticleEditLock"("expiresAt");
