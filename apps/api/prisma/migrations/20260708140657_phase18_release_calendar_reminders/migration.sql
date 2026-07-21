-- CreateEnum
CREATE TYPE "ReleaseCalendarStatus" AS ENUM ('PLANNED', 'UPCOMING', 'RELEASED', 'WATCHING', 'BOUGHT', 'SKIPPED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ReleaseReminderOffset" AS ENUM ('SEVEN_DAYS', 'THREE_DAYS', 'ONE_DAY', 'TWELVE_HOURS', 'ONE_HOUR', 'AT_RELEASE');

-- AlterEnum
ALTER TYPE "AlertEventType" ADD VALUE 'RELEASE_REMINDER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertTemplateType" ADD VALUE 'RELEASE_REMINDER';
ALTER TYPE "AlertTemplateType" ADD VALUE 'TEST_RELEASE_REMINDER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'RELEASE_CALENDAR_ITEM_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'RELEASE_CALENDAR_ITEM_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'RELEASE_CALENDAR_ITEM_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'RELEASE_CALENDAR_ITEM_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE 'RELEASE_CALENDAR_ITEM_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'RELEASE_CALENDAR_MARKED_RELEASED';
ALTER TYPE "AuditAction" ADD VALUE 'RELEASE_CALENDAR_MARKED_BOUGHT';
ALTER TYPE "AuditAction" ADD VALUE 'RELEASE_CALENDAR_MARKED_SKIPPED';
ALTER TYPE "AuditAction" ADD VALUE 'RELEASE_REMINDER_TEST_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'RELEASE_REMINDER_DELIVERY_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'RELEASE_REMINDER_DELIVERED';
ALTER TYPE "AuditAction" ADD VALUE 'RELEASE_RELATED_MANUAL_LINK_OPENED';

-- CreateTable
CREATE TABLE "ReleaseCalendarItem" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "setName" TEXT,
    "productName" TEXT,
    "categoryId" TEXT,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT,
    "priority" "AlertPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ReleaseCalendarStatus" NOT NULL DEFAULT 'UPCOMING',
    "wishlistItemId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "discordReminder" BOOLEAN NOT NULL DEFAULT true,
    "reminderOffsets" "ReleaseReminderOffset"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseCalendarItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseCalendarManualStoreLink" (
    "id" TEXT NOT NULL,
    "releaseCalendarItemId" TEXT NOT NULL,
    "manualStoreLinkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseCalendarManualStoreLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReleaseCalendarItem_ownerId_isActive_idx" ON "ReleaseCalendarItem"("ownerId", "isActive");

-- CreateIndex
CREATE INDEX "ReleaseCalendarItem_ownerId_status_idx" ON "ReleaseCalendarItem"("ownerId", "status");

-- CreateIndex
CREATE INDEX "ReleaseCalendarItem_releaseDate_idx" ON "ReleaseCalendarItem"("releaseDate");

-- CreateIndex
CREATE INDEX "ReleaseCalendarItem_wishlistItemId_idx" ON "ReleaseCalendarItem"("wishlistItemId");

-- CreateIndex
CREATE INDEX "ReleaseCalendarItem_categoryId_idx" ON "ReleaseCalendarItem"("categoryId");

-- CreateIndex
CREATE INDEX "ReleaseCalendarManualStoreLink_manualStoreLinkId_idx" ON "ReleaseCalendarManualStoreLink"("manualStoreLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseCalendarManualStoreLink_releaseCalendarItemId_manual_key" ON "ReleaseCalendarManualStoreLink"("releaseCalendarItemId", "manualStoreLinkId");

-- AddForeignKey
ALTER TABLE "ReleaseCalendarItem" ADD CONSTRAINT "ReleaseCalendarItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseCalendarItem" ADD CONSTRAINT "ReleaseCalendarItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseCalendarItem" ADD CONSTRAINT "ReleaseCalendarItem_wishlistItemId_fkey" FOREIGN KEY ("wishlistItemId") REFERENCES "WishlistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseCalendarManualStoreLink" ADD CONSTRAINT "ReleaseCalendarManualStoreLink_releaseCalendarItemId_fkey" FOREIGN KEY ("releaseCalendarItemId") REFERENCES "ReleaseCalendarItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseCalendarManualStoreLink" ADD CONSTRAINT "ReleaseCalendarManualStoreLink_manualStoreLinkId_fkey" FOREIGN KEY ("manualStoreLinkId") REFERENCES "ManualStoreLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
