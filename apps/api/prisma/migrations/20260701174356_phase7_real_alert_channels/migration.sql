-- CreateEnum
CREATE TYPE "AlertDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SUPPRESSED', 'CHANNEL_DISABLED', 'CONFIGURATION_NEEDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ALERT_CHANNEL_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ALERT_CHANNEL_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'ALERT_CHANNEL_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE 'ALERT_CHANNEL_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'ALERT_CHANNEL_TEST_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'ALERT_EVENT_DELIVERED';
ALTER TYPE "AuditAction" ADD VALUE 'ALERT_DELIVERY_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'ALERT_DELIVERY_SUPPRESSED';
ALTER TYPE "AuditAction" ADD VALUE 'ALERT_SECRET_STORED_ENCRYPTED';

-- AlterTable
ALTER TABLE "AlertChannel" ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastTestStatus" "AlertDeliveryStatus";

-- AlterTable
ALTER TABLE "AlertEvent" ADD COLUMN     "ownerId" TEXT;

-- CreateTable
CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL,
    "alertEventId" TEXT NOT NULL,
    "alertChannelId" TEXT NOT NULL,
    "provider" "AlertChannelType" NOT NULL,
    "status" "AlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "errorSummary" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertDelivery_alertEventId_status_idx" ON "AlertDelivery"("alertEventId", "status");

-- CreateIndex
CREATE INDEX "AlertDelivery_alertChannelId_createdAt_idx" ON "AlertDelivery"("alertChannelId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_ownerId_createdAt_idx" ON "AlertEvent"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_alertEventId_fkey" FOREIGN KEY ("alertEventId") REFERENCES "AlertEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_alertChannelId_fkey" FOREIGN KEY ("alertChannelId") REFERENCES "AlertChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
