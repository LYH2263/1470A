-- CreateTable
CREATE TABLE "BatchOperationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operationType" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "articleIds" TEXT NOT NULL,
    "articleCount" INTEGER NOT NULL,
    "params" TEXT NOT NULL,
    "snapshots" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "errorDetails" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "reverted" BOOLEAN NOT NULL DEFAULT false,
    "revertedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "BatchOperationLog_operationType_idx" ON "BatchOperationLog"("operationType");

-- CreateIndex
CREATE INDEX "BatchOperationLog_operatorId_idx" ON "BatchOperationLog"("operatorId");

-- CreateIndex
CREATE INDEX "BatchOperationLog_createdAt_idx" ON "BatchOperationLog"("createdAt");

-- CreateIndex
CREATE INDEX "BatchOperationLog_status_idx" ON "BatchOperationLog"("status");
