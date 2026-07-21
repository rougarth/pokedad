-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'STORE_SAFETY_MATRIX_VIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'STORE_SAFETY_DETAIL_VIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'STORE_SAFETY_ITEM_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'BLOCKED_STORE_ADAPTER_ATTEMPTED';
ALTER TYPE "AuditAction" ADD VALUE 'RESEARCH_ONLY_STORE_SELECTED_IN_WISHLIST';
