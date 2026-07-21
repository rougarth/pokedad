-- CreateEnum
CREATE TYPE "ManualStoreLinkType" AS ENUM ('PRODUCT', 'SEARCH', 'CATEGORY', 'RELEASE_PAGE', 'STORE_HOME', 'CUSTOM');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MANUAL_STORE_LINK_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MANUAL_STORE_LINK_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MANUAL_STORE_LINK_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MANUAL_STORE_LINK_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MANUAL_STORE_LINK_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MANUAL_STORE_LINK_OPENED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MANUAL_STORE_LINK_ATTACHED_TO_WISHLIST';

-- CreateTable
CREATE TABLE "ManualStoreLink" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "storeKey" TEXT NOT NULL,
    "storeDisplayName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "linkType" "ManualStoreLinkType" NOT NULL DEFAULT 'SEARCH',
    "priority" "WishlistPriority" NOT NULL DEFAULT 'NORMAL',
    "wishlistItemId" TEXT,
    "setName" TEXT,
    "categoryId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastOpenedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualStoreLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualStoreLink_ownerId_isActive_idx" ON "ManualStoreLink"("ownerId", "isActive");

-- CreateIndex
CREATE INDEX "ManualStoreLink_ownerId_storeKey_idx" ON "ManualStoreLink"("ownerId", "storeKey");

-- CreateIndex
CREATE INDEX "ManualStoreLink_wishlistItemId_idx" ON "ManualStoreLink"("wishlistItemId");

-- CreateIndex
CREATE INDEX "ManualStoreLink_categoryId_idx" ON "ManualStoreLink"("categoryId");

-- AddForeignKey
ALTER TABLE "ManualStoreLink" ADD CONSTRAINT "ManualStoreLink_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualStoreLink" ADD CONSTRAINT "ManualStoreLink_wishlistItemId_fkey" FOREIGN KEY ("wishlistItemId") REFERENCES "WishlistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualStoreLink" ADD CONSTRAINT "ManualStoreLink_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
