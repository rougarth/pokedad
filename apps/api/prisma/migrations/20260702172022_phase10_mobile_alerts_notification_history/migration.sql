-- CreateEnum
CREATE TYPE "AlertPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AlertTemplateType" AS ENUM ('ACCEPTED_PRICE_FOUND', 'MSRP_MATCH_FOUND', 'PRICE_DROPPED_ACCEPTED', 'UNKNOWN_MSRP_MAPPING', 'HUMAN_REVIEW_NEEDED', 'SCAN_FAILED', 'CONFIGURATION_NEEDED', 'TEST_ALERT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ALERT_TEMPLATE_PREVIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'ALERT_PREVIEW_TEST_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'ALERT_PREVIEW_TEST_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'NOTIFICATION_HISTORY_VIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'ALERT_DELIVERY_DETAIL_VIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'ALERT_SETTINGS_UPDATED';

-- AlterTable
ALTER TABLE "AlertEvent" ADD COLUMN     "priority" "AlertPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "templateType" "AlertTemplateType",
ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'PokeDad Radar Alert';
