-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'DISCORD_OAUTH_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'DISCORD_OAUTH_CALLBACK_SUCCEEDED';
ALTER TYPE "AuditAction" ADD VALUE 'DISCORD_OAUTH_CALLBACK_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'DISCORD_OAUTH_INVALID_STATE';
ALTER TYPE "AuditAction" ADD VALUE 'DISCORD_OAUTH_CONFIG_MISSING';
ALTER TYPE "AuditAction" ADD VALUE 'DISCORD_OAUTH_WEBHOOK_STORED_ENCRYPTED';
ALTER TYPE "AuditAction" ADD VALUE 'DISCORD_OAUTH_TEST_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'DISCORD_OAUTH_TEST_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'DISCORD_OAUTH_DISCONNECTED';
