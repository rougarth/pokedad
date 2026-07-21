-- CreateEnum
CREATE TYPE "StoreSessionState" AS ENUM ('LOGGED_IN', 'NOT_LOGGED_IN', 'LOGIN_EXPIRED', 'HUMAN_CHECK_NEEDED', 'QUEUE_OR_WAITING_ROOM', 'QUEUE_DETECTED', 'CAPTCHA_DETECTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProductCategoryKind" AS ENUM ('ELITE_TRAINER_BOX', 'POKEMON_CENTER_ETB', 'BOOSTER_BUNDLE', 'BOOSTER_BOX', 'COLLECTION_BOX', 'PREMIUM_COLLECTION', 'ULTRA_PREMIUM_COLLECTION', 'MINI_TIN', 'TIN', 'SLEEVED_BOOSTER', 'NEW_RELEASE');

-- CreateEnum
CREATE TYPE "SellerPolicy" AS ENUM ('OFFICIAL_ONLY', 'APPROVED_SELLERS_ONLY', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "FulfillmentPreference" AS ENUM ('SHIPPING', 'PICKUP', 'EITHER');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'PREORDER', 'BACKORDER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CartAssistStatus" AS ENUM ('NOT_ATTEMPTED', 'PRODUCT_FOUND', 'PRICE_ACCEPTED', 'ADD_TO_CART_ATTEMPTED', 'CART_READY', 'LOGIN_REQUIRED', 'HUMAN_CHECK_REQUIRED', 'QUEUE_DETECTED', 'CAPTCHA_DETECTED', 'SOLD_OUT', 'PRICE_CHANGED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "CartAssistMode" AS ENUM ('OPEN_ONLY', 'LOCAL_HELPER_READY', 'DISABLED');

-- CreateEnum
CREATE TYPE "PriceStatus" AS ENUM ('ACCEPTED', 'MSRP_MATCH', 'ACCEPTED_MARKUP', 'OVER_LIMIT', 'THIRD_PARTY_SKIPPED', 'UNKNOWN_MSRP');

-- CreateEnum
CREATE TYPE "AlertChannelType" AS ENUM ('TELEGRAM', 'DISCORD_WEBHOOK', 'SMS', 'EMAIL', 'BROWSER');

-- CreateEnum
CREATE TYPE "AlertEventType" AS ENUM ('MSRP_FOUND', 'ACCEPTABLE_PRICE_FOUND', 'CART_READY', 'HUMAN_ACTION_NEEDED', 'LOGIN_EXPIRED', 'PRICE_CHANGED', 'SOLD_OUT', 'ERROR');

-- CreateEnum
CREATE TYPE "AlertEventStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "LiveAlertStatus" AS ENUM ('NOT_SENT', 'READY', 'SENT', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'PASSWORD_CHANGED', 'STORE_UPDATED', 'WATCH_RULE_UPDATED', 'PRICE_RULE_UPDATED', 'ALERT_CHANNEL_UPDATED', 'ALERT_SENT', 'CART_ASSIST_REQUESTED', 'CART_ASSIST_STOPPED', 'LIVE_FIND_IGNORED', 'LIVE_FIND_MARKED_BOUGHT', 'LIVE_FIND_SNOOZED', 'CART_QUEUE_RETRY_REQUESTED', 'ALERT_TEST_SENT', 'HELPER_CONNECTED', 'DATA_EXPORTED', 'DATA_DELETED');

-- CreateEnum
CREATE TYPE "SkipReason" AS ENUM ('NONE', 'THIRD_PARTY_SELLER', 'MARKETPLACE_SCALPER', 'USED_OR_OPEN_BOX', 'SINGLES_OR_LOOSE_CARDS', 'PRICE_ABOVE_MAX', 'SUSPICIOUS_LISTING', 'HUMAN_CHECK_REQUIRED', 'QUEUE_DETECTED', 'PURCHASE_LIMIT_MANUAL_DECISION', 'STORE_DISABLED');

-- CreateEnum
CREATE TYPE "PriceRuleScope" AS ENUM ('GLOBAL', 'STORE', 'CATEGORY', 'PRODUCT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "loginUrl" TEXT,
    "cartUrl" TEXT,
    "monitoringEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cartAssistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cartAssistMode" "CartAssistMode" NOT NULL DEFAULT 'OPEN_ONLY',
    "sellerPolicy" "SellerPolicy" NOT NULL DEFAULT 'OFFICIAL_ONLY',
    "defaultToleranceCents" INTEGER,
    "adapterSafetyLevel" TEXT NOT NULL DEFAULT 'OPEN_ONLY',
    "lastSuccessfulCheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSessionStatus" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "state" "StoreSessionState" NOT NULL DEFAULT 'UNKNOWN',
    "checkedAt" TIMESTAMP(3),
    "message" TEXT,
    "helperId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSessionStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "kind" "ProductCategoryKind" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMSRP" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "categoryId" TEXT,
    "productNamePattern" TEXT,
    "msrpCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMSRP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductWatchRule" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monitorAllSealed" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "monitorNewReleases" BOOLEAN NOT NULL DEFAULT true,
    "ignoreSingles" BOOLEAN NOT NULL DEFAULT true,
    "ignoreThirdParty" BOOLEAN NOT NULL DEFAULT true,
    "fulfillmentPreference" "FulfillmentPreference" NOT NULL DEFAULT 'EITHER',
    "pickupZip" TEXT,
    "pickupRadiusMiles" INTEGER,
    "quantityWanted" INTEGER NOT NULL DEFAULT 1,
    "maxQuantityPerStoreProduct" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductWatchRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "scope" "PriceRuleScope" NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Price rule',
    "target" TEXT NOT NULL DEFAULT 'All sealed products',
    "storeId" TEXT,
    "categoryId" TEXT,
    "retailerProductId" TEXT,
    "msrpCents" INTEGER,
    "allowedMarkupCents" INTEGER NOT NULL DEFAULT 0,
    "toleranceCents" INTEGER,
    "customMaxPriceCents" INTEGER,
    "alertThresholdCents" INTEGER,
    "storeSpecificToleranceCents" INTEGER,
    "categorySpecificToleranceCents" INTEGER,
    "productSpecificOverrideCents" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerProduct" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "categoryId" TEXT,
    "externalId" TEXT,
    "productUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "name" TEXT NOT NULL,
    "sellerName" TEXT,
    "sellerIsOfficial" BOOLEAN NOT NULL DEFAULT false,
    "marketplaceListing" BOOLEAN NOT NULL DEFAULT false,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailerProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCheckResult" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "retailerProductId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priceCents" INTEGER,
    "msrpCents" INTEGER,
    "acceptedMaxPriceCents" INTEGER,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "sellerName" TEXT,
    "sellerAccepted" BOOLEAN NOT NULL DEFAULT false,
    "priceStatus" "PriceStatus" NOT NULL DEFAULT 'UNKNOWN_MSRP',
    "alertStatus" "LiveAlertStatus" NOT NULL DEFAULT 'NOT_SENT',
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'UNKNOWN',
    "shippingAvailable" BOOLEAN,
    "pickupAvailable" BOOLEAN,
    "skipReason" "SkipReason" NOT NULL DEFAULT 'NONE',
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "bought" BOOLEAN NOT NULL DEFAULT false,
    "snoozedUntil" TIMESTAMP(3),
    "rawMetadata" JSONB,

    CONSTRAINT "StockCheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartAssistAttempt" (
    "id" TEXT NOT NULL,
    "stockCheckResultId" TEXT NOT NULL,
    "status" "CartAssistStatus" NOT NULL DEFAULT 'NOT_ATTEMPTED',
    "requestedQuantity" INTEGER NOT NULL DEFAULT 1,
    "productUrl" TEXT NOT NULL,
    "cartUrl" TEXT,
    "helperId" TEXT,
    "stopReason" TEXT,
    "lastMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartAssistAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertChannel" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "AlertChannelType" NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "encryptedSecretId" TEXT,
    "destinationHint" TEXT,
    "lastTestAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "alertChannelId" TEXT,
    "stockCheckResultId" TEXT,
    "type" "AlertEventType" NOT NULL,
    "status" "AlertEventStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncryptedSecret" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL,
    "ivBase64" TEXT NOT NULL,
    "authTagBase64" TEXT NOT NULL,
    "cipherTextBase64" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncryptedSecret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Store_ownerId_monitoringEnabled_idx" ON "Store"("ownerId", "monitoringEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "Store_ownerId_slug_key" ON "Store"("ownerId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSessionStatus_storeId_key" ON "StoreSessionStatus"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_kind_key" ON "ProductCategory"("kind");

-- CreateIndex
CREATE INDEX "ProductMSRP_ownerId_idx" ON "ProductMSRP"("ownerId");

-- CreateIndex
CREATE INDEX "ProductMSRP_categoryId_idx" ON "ProductMSRP"("categoryId");

-- CreateIndex
CREATE INDEX "ProductWatchRule_ownerId_enabled_idx" ON "ProductWatchRule"("ownerId", "enabled");

-- CreateIndex
CREATE INDEX "PriceRule_ownerId_scope_enabled_idx" ON "PriceRule"("ownerId", "scope", "enabled");

-- CreateIndex
CREATE INDEX "RetailerProduct_storeId_idx" ON "RetailerProduct"("storeId");

-- CreateIndex
CREATE INDEX "RetailerProduct_productUrl_idx" ON "RetailerProduct"("productUrl");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerProduct_storeId_externalId_key" ON "RetailerProduct"("storeId", "externalId");

-- CreateIndex
CREATE INDEX "StockCheckResult_checkedAt_idx" ON "StockCheckResult"("checkedAt");

-- CreateIndex
CREATE INDEX "StockCheckResult_storeId_stockStatus_accepted_idx" ON "StockCheckResult"("storeId", "stockStatus", "accepted");

-- CreateIndex
CREATE INDEX "CartAssistAttempt_createdAt_idx" ON "CartAssistAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "CartAssistAttempt_status_idx" ON "CartAssistAttempt"("status");

-- CreateIndex
CREATE INDEX "AlertChannel_ownerId_type_enabled_idx" ON "AlertChannel"("ownerId", "type", "enabled");

-- CreateIndex
CREATE INDEX "AlertEvent_createdAt_idx" ON "AlertEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_status_type_idx" ON "AlertEvent"("status", "type");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_action_idx" ON "AuditLog"("actorUserId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_ownerId_key_key" ON "AppSetting"("ownerId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "EncryptedSecret_ownerId_name_key" ON "EncryptedSecret"("ownerId", "name");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSessionStatus" ADD CONSTRAINT "StoreSessionStatus_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMSRP" ADD CONSTRAINT "ProductMSRP_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMSRP" ADD CONSTRAINT "ProductMSRP_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductWatchRule" ADD CONSTRAINT "ProductWatchRule_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductWatchRule" ADD CONSTRAINT "ProductWatchRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_retailerProductId_fkey" FOREIGN KEY ("retailerProductId") REFERENCES "RetailerProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProduct" ADD CONSTRAINT "RetailerProduct_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProduct" ADD CONSTRAINT "RetailerProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCheckResult" ADD CONSTRAINT "StockCheckResult_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCheckResult" ADD CONSTRAINT "StockCheckResult_retailerProductId_fkey" FOREIGN KEY ("retailerProductId") REFERENCES "RetailerProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartAssistAttempt" ADD CONSTRAINT "CartAssistAttempt_stockCheckResultId_fkey" FOREIGN KEY ("stockCheckResultId") REFERENCES "StockCheckResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertChannel" ADD CONSTRAINT "AlertChannel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertChannel" ADD CONSTRAINT "AlertChannel_encryptedSecretId_fkey" FOREIGN KEY ("encryptedSecretId") REFERENCES "EncryptedSecret"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_alertChannelId_fkey" FOREIGN KEY ("alertChannelId") REFERENCES "AlertChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_stockCheckResultId_fkey" FOREIGN KEY ("stockCheckResultId") REFERENCES "StockCheckResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncryptedSecret" ADD CONSTRAINT "EncryptedSecret_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

