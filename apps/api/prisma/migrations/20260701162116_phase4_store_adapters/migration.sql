-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ADAPTER_STATUS_CHECKED';
ALTER TYPE "AuditAction" ADD VALUE 'ADAPTER_TEST_SEARCH_RUN';
ALTER TYPE "AuditAction" ADD VALUE 'ADAPTER_LOOKUP_RUN';
ALTER TYPE "AuditAction" ADD VALUE 'BEST_BUY_SCAN_RUN';
ALTER TYPE "AuditAction" ADD VALUE 'ADAPTER_MISSING_API_KEY';
ALTER TYPE "AuditAction" ADD VALUE 'ADAPTER_ERROR';
