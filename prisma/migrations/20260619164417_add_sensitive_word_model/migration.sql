-- CreateTable
CREATE TABLE "SensitiveWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "SensitiveWord_word_idx" ON "SensitiveWord"("word");

-- CreateIndex
CREATE INDEX "SensitiveWord_category_idx" ON "SensitiveWord"("category");

-- CreateIndex
CREATE INDEX "SensitiveWord_level_idx" ON "SensitiveWord"("level");

-- CreateIndex
CREATE INDEX "SensitiveWord_enabled_idx" ON "SensitiveWord"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "SensitiveWord_word_key" ON "SensitiveWord"("word");
