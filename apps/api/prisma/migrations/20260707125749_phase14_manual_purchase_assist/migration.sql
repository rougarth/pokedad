-- CreateEnum
CREATE TYPE "PurchaseDecisionStatus" AS ENUM ('NEW', 'OPENED', 'BOUGHT', 'SKIPPED', 'SNOOZED', 'SOLD_OUT', 'TOO_EXPENSIVE', 'NOT_INTERESTED', 'NEEDS_MAPPING');

-- CreateEnum
CREATE TYPE "PurchaseSkipReason" AS ENUM ('PRICE_TOO_HIGH', 'SOLD_OUT', 'NOT_INTERESTED', 'WRONG_PRODUCT', 'ALREADY_BOUGHT', 'NEEDS_REVIEW', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_PRODUCT_OPENED';
ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_MARKED_BOUGHT';
ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_MARKED_SKIPPED';
ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_SNOOZED';
ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_UNSNOOZED';
ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_NOTE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_CHECKLIST_VIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_DECISION_CHANGED';

-- CreateTable
CREATE TABLE "PurchaseDecision" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "stockCheckResultId" TEXT NOT NULL,
    "status" "PurchaseDecisionStatus" NOT NULL DEFAULT 'NEW',
    "skipReason" "PurchaseSkipReason",
    "note" TEXT,
    "quantity" INTEGER,
    "finalPriceCents" INTEGER,
    "openedAt" TIMESTAMP(3),
    "boughtAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseDecision_stockCheckResultId_key" ON "PurchaseDecision"("stockCheckResultId");

-- CreateIndex
CREATE INDEX "PurchaseDecision_ownerId_status_idx" ON "PurchaseDecision"("ownerId", "status");

-- CreateIndex
CREATE INDEX "PurchaseDecision_snoozedUntil_idx" ON "PurchaseDecision"("snoozedUntil");

-- AddForeignKey
ALTER TABLE "PurchaseDecision" ADD CONSTRAINT "PurchaseDecision_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDecision" ADD CONSTRAINT "PurchaseDecision_stockCheckResultId_fkey" FOREIGN KEY ("stockCheckResultId") REFERENCES "StockCheckResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
