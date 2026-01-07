-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "legacyResourceId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionHtml" TEXT,
    "collectionType" TEXT NOT NULL,
    "sortOrder" TEXT,
    "imageUrl" TEXT,
    "productsCount" INTEGER NOT NULL DEFAULT 0,
    "ruleSet" TEXT,
    "disjunctive" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProductCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "position" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Collection_sessionId_idx" ON "Collection"("sessionId");

-- CreateIndex
CREATE INDEX "Collection_collectionType_idx" ON "Collection"("collectionType");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_sessionId_handle_key" ON "Collection"("sessionId", "handle");

-- CreateIndex
CREATE INDEX "ProductCollection_productId_idx" ON "ProductCollection"("productId");

-- CreateIndex
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCollection_productId_collectionId_key" ON "ProductCollection"("productId", "collectionId");
