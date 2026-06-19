-- CreateTable
CREATE TABLE "SystemAnnouncement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SystemAnnouncement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SystemAnnouncement_isActive_idx" ON "SystemAnnouncement"("isActive");

-- CreateIndex
CREATE INDEX "SystemAnnouncement_level_idx" ON "SystemAnnouncement"("level");

-- CreateIndex
CREATE INDEX "SystemAnnouncement_startTime_idx" ON "SystemAnnouncement"("startTime");

-- CreateIndex
CREATE INDEX "SystemAnnouncement_endTime_idx" ON "SystemAnnouncement"("endTime");

-- CreateIndex
CREATE INDEX "SystemAnnouncement_createdAt_idx" ON "SystemAnnouncement"("createdAt");
