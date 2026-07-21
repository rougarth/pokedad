-- CreateEnum
CREATE TYPE "TodayActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'SNOOZED', 'DISMISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'TODAY_ACTION_LIST_VIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'TODAY_ACTION_ITEM_DISMISSED';
ALTER TYPE "AuditAction" ADD VALUE 'TODAY_ACTION_ITEM_SNOOZED';
ALTER TYPE "AuditAction" ADD VALUE 'TODAY_ACTION_ITEM_MARKED_DONE';
ALTER TYPE "AuditAction" ADD VALUE 'TODAY_MANUAL_LINK_OPENED';
ALTER TYPE "AuditAction" ADD VALUE 'TODAY_PURCHASE_DECISION_MADE';
ALTER TYPE "AuditAction" ADD VALUE 'TODAY_RELEASE_ACTION_TAKEN';
ALTER TYPE "AuditAction" ADD VALUE 'TODAY_MSRP_MAPPING_OPENED';

-- CreateTable
CREATE TABLE "ActionItemState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "status" "TodayActionStatus" NOT NULL DEFAULT 'OPEN',
    "snoozedUntil" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItemState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionItemState_userId_status_idx" ON "ActionItemState"("userId", "status");

-- CreateIndex
CREATE INDEX "ActionItemState_snoozedUntil_idx" ON "ActionItemState"("snoozedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ActionItemState_userId_itemKey_key" ON "ActionItemState"("userId", "itemKey");

-- AddForeignKey
ALTER TABLE "ActionItemState" ADD CONSTRAINT "ActionItemState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
