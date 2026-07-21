-- CreateEnum
CREATE TYPE "WishlistPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT', 'IGNORE');

-- CreateEnum
CREATE TYPE "WishlistAlertBehavior" AS ENUM ('ALERT_IMMEDIATELY', 'DASHBOARD_ONLY', 'DO_NOT_ALERT', 'REVIEW_FIRST');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'WISHLIST_ITEM_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'WISHLIST_ITEM_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'WISHLIST_ITEM_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'WISHLIST_ITEM_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE 'WISHLIST_ITEM_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'WISHLIST_MATCH_PREVIEW_RUN';
ALTER TYPE "AuditAction" ADD VALUE 'WISHLIST_PRODUCT_MATCHED';
ALTER TYPE "AuditAction" ADD VALUE 'WISHLIST_PRODUCT_IGNORED';
ALTER TYPE "AuditAction" ADD VALUE 'WISHLIST_ALERT_PRIORITY_SET';

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "setName" TEXT,
    "categoryId" TEXT,
    "storeKey" TEXT,
    "priority" "WishlistPriority" NOT NULL DEFAULT 'NORMAL',
    "alertBehavior" "WishlistAlertBehavior" NOT NULL DEFAULT 'ALERT_IMMEDIATELY',
    "desiredQuantity" INTEGER,
    "maxPriceCents" INTEGER,
    "allowedMarkupCents" INTEGER,
    "keywords" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistItem_ownerId_isActive_idx" ON "WishlistItem"("ownerId", "isActive");

-- CreateIndex
CREATE INDEX "WishlistItem_ownerId_priority_idx" ON "WishlistItem"("ownerId", "priority");

-- CreateIndex
CREATE INDEX "WishlistItem_categoryId_idx" ON "WishlistItem"("categoryId");

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
