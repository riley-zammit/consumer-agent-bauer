-- CreateTable
CREATE TABLE "CustomerSensitiveData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CustomerSupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "CustomerSensitiveData_conversationId_idx" ON "CustomerSensitiveData"("conversationId");

-- CreateIndex
CREATE INDEX "CustomerSupportTicket_conversationId_idx" ON "CustomerSupportTicket"("conversationId");

-- CreateIndex
CREATE INDEX "CustomerSupportTicket_conversationId_updatedAt_idx" ON "CustomerSupportTicket"("conversationId", "updatedAt");
