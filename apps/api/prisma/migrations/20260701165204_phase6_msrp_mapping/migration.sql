-- CreateEnum
CREATE TYPE "MSRPMappingStatus" AS ENUM ('UNMAPPED', 'SUGGESTED', 'MAPPED', 'IGNORED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "MSRPMappingConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'MANUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'MSRP_MAPPING_CANDIDATE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'MSRP_SUGGESTION_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'MSRP_MAPPING_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE 'MSRP_MAPPING_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'MSRP_MAPPING_IGNORED';
ALTER TYPE "AuditAction" ADD VALUE 'MSRP_MAPPING_MARKED_NEEDS_REVIEW';
ALTER TYPE "AuditAction" ADD VALUE 'MSRP_PRICE_RECALCULATED';
ALTER TYPE "AuditAction" ADD VALUE 'MSRP_MAPPING_ALERT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'MSRP_MAPPING_DUPLICATE_ALERT_SUPPRESSED';

-- CreateTable
CREATE TABLE "ProductMSRPMapping" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "storeKey" TEXT NOT NULL,
    "retailerSku" TEXT,
    "retailerProductId" TEXT,
    "productName" TEXT NOT NULL,
    "normalizedProductKey" TEXT NOT NULL,
    "productUrl" TEXT,
    "imageUrl" TEXT,
    "currentPriceCents" INTEGER,
    "detectedKeywords" TEXT[],
    "suggestedCategoryId" TEXT,
    "mappedCategoryId" TEXT,
    "msrpCents" INTEGER,
    "acceptedMaxPriceCents" INTEGER,
    "confidence" "MSRPMappingConfidence" NOT NULL DEFAULT 'LOW',
    "status" "MSRPMappingStatus" NOT NULL DEFAULT 'UNMAPPED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMSRPMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductMSRPMapping_ownerId_status_idx" ON "ProductMSRPMapping"("ownerId", "status");

-- CreateIndex
CREATE INDEX "ProductMSRPMapping_storeKey_retailerSku_idx" ON "ProductMSRPMapping"("storeKey", "retailerSku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMSRPMapping_ownerId_storeKey_retailerSku_key" ON "ProductMSRPMapping"("ownerId", "storeKey", "retailerSku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMSRPMapping_ownerId_storeKey_normalizedProductKey_key" ON "ProductMSRPMapping"("ownerId", "storeKey", "normalizedProductKey");

-- AddForeignKey
ALTER TABLE "ProductMSRPMapping" ADD CONSTRAINT "ProductMSRPMapping_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMSRPMapping" ADD CONSTRAINT "ProductMSRPMapping_retailerProductId_fkey" FOREIGN KEY ("retailerProductId") REFERENCES "RetailerProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMSRPMapping" ADD CONSTRAINT "ProductMSRPMapping_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMSRPMapping" ADD CONSTRAINT "ProductMSRPMapping_mappedCategoryId_fkey" FOREIGN KEY ("mappedCategoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
