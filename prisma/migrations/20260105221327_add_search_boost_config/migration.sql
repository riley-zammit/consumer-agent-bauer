-- CreateTable
CREATE TABLE "SearchBoostConfig" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "rulesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
