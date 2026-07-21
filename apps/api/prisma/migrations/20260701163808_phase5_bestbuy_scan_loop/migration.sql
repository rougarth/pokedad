-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'BEST_BUY_SCAN_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'BEST_BUY_SCAN_SUCCEEDED';
ALTER TYPE "AuditAction" ADD VALUE 'BEST_BUY_SCAN_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'BEST_BUY_SCAN_API_KEY_MISSING';
ALTER TYPE "AuditAction" ADD VALUE 'BEST_BUY_SCAN_RATE_LIMITED';
ALTER TYPE "AuditAction" ADD VALUE 'BEST_BUY_SCAN_ENABLED';
ALTER TYPE "AuditAction" ADD VALUE 'BEST_BUY_SCAN_DISABLED';
ALTER TYPE "AuditAction" ADD VALUE 'BEST_BUY_RESULT_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE 'BEST_BUY_RESULT_OVER_LIMIT';
ALTER TYPE "AuditAction" ADD VALUE 'BEST_BUY_ALERT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'BEST_BUY_DUPLICATE_ALERT_SUPPRESSED';
