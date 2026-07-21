import type { Prisma, PrismaClient } from "@prisma/client";
import { AlertStatus, PriceStatus, ProductCategoryKind, SkipReason, StockStatus, type DemoLiveFind } from "@pokedad-radar/shared";
import { DashboardRepository } from "../../../repositories/dashboard.repository.js";
import { AuditService } from "../../../services/audit.service.js";
import { AlertDeliveryService } from "../../alerts/alert-delivery.service.js";
import { MSRPMappingService } from "../../msrp/msrp-mapping.service.js";
import { WishlistService } from "../../wishlist/wishlist.service.js";
import type { ProductSearchResult } from "../types.js";
import { defaultBestBuyScanConfig } from "./bestbuy-scan.service.js";
import type { BestBuyScanConfig, BestBuyScanResponse, BestBuyScanState } from "./bestbuy-scan.types.js";

const CONFIG_KEY = "bestBuyScanConfig";
const STATUS_KEY = "bestBuyScanStatus";

function nowIso(): string {
  return new Date().toISOString();
}

function mockProducts(): ProductSearchResult[] {
  return [
    {
      storeKey: "best-buy",
      storeName: "Best Buy",
      source: "BEST_BUY_MOCK_DEMO",
      externalId: "mock-bb-booster-bundle",
      sku: "MOCK-BB-001",
      name: "MOCK / DEMO - Prismatic Evolutions Pokemon Booster Bundle",
      seller: "Best Buy",
      sellerAccepted: true,
      productUrl: "https://www.bestbuy.com/site/searchpage.jsp?st=pokemon%20booster%20bundle",
      imageUrl: null,
      priceCents: 2699,
      regularPriceCents: 2699,
      msrpCents: 2699,
      maxAcceptedPriceCents: 3499,
      priceStatus: PriceStatus.MSRP_MATCH,
      stockStatus: StockStatus.IN_STOCK,
      onlineAvailability: "IN_STOCK",
      shippingAvailable: true,
      pickupAvailable: false
    },
    {
      storeKey: "best-buy",
      storeName: "Best Buy",
      source: "BEST_BUY_MOCK_DEMO",
      externalId: "mock-bb-etb",
      sku: "MOCK-BB-002",
      name: "MOCK / DEMO - Pokemon Center Elite Trainer Box",
      seller: "Best Buy",
      sellerAccepted: true,
      productUrl: "https://www.bestbuy.com/site/searchpage.jsp?st=pokemon%20elite%20trainer%20box",
      imageUrl: null,
      priceCents: 5499,
      regularPriceCents: 5499,
      msrpCents: 4999,
      maxAcceptedPriceCents: 5999,
      priceStatus: PriceStatus.ACCEPTED_MARKUP,
      stockStatus: StockStatus.IN_STOCK,
      onlineAvailability: "IN_STOCK",
      shippingAvailable: true,
      pickupAvailable: true
    },
    {
      storeKey: "best-buy",
      storeName: "Best Buy",
      source: "BEST_BUY_MOCK_DEMO",
      externalId: "mock-bb-upc-over",
      sku: "MOCK-BB-003",
      name: "MOCK / DEMO - Random Pokemon Collection Box",
      seller: "Best Buy",
      sellerAccepted: true,
      productUrl: "https://www.bestbuy.com/site/searchpage.jsp?st=pokemon%20collection%20box",
      imageUrl: null,
      priceCents: 2299,
      regularPriceCents: 2299,
      msrpCents: 1999,
      maxAcceptedPriceCents: 2499,
      priceStatus: PriceStatus.ACCEPTED_MARKUP,
      stockStatus: StockStatus.IN_STOCK,
      onlineAvailability: "IN_STOCK",
      shippingAvailable: true,
      pickupAvailable: false
    },
    {
      storeKey: "best-buy",
      storeName: "Best Buy",
      source: "BEST_BUY_MOCK_DEMO",
      externalId: "mock-bb-unknown",
      sku: "MOCK-BB-004",
      name: "MOCK / DEMO - Unknown Pokemon TCG Collection Item",
      seller: "Best Buy",
      sellerAccepted: true,
      productUrl: "https://www.bestbuy.com/site/searchpage.jsp?st=pokemon%20tcg%20collection",
      imageUrl: null,
      priceCents: 3999,
      regularPriceCents: 3999,
      msrpCents: null,
      maxAcceptedPriceCents: null,
      priceStatus: PriceStatus.UNKNOWN_MSRP,
      stockStatus: StockStatus.IN_STOCK,
      onlineAvailability: "IN_STOCK",
      shippingAvailable: true,
      pickupAvailable: false
    },
    {
      storeKey: "best-buy",
      storeName: "Best Buy",
      source: "BEST_BUY_MOCK_DEMO",
      externalId: "mock-bb-sold-out",
      sku: "MOCK-BB-005",
      name: "MOCK / DEMO - Pokemon loose single card marketplace lot",
      seller: "Best Buy",
      sellerAccepted: true,
      productUrl: "https://www.bestbuy.com/site/searchpage.jsp?st=pokemon%20single%20card%20lot",
      imageUrl: null,
      priceCents: 9999,
      regularPriceCents: 9999,
      msrpCents: null,
      maxAcceptedPriceCents: null,
      priceStatus: PriceStatus.UNKNOWN_MSRP,
      stockStatus: StockStatus.IN_STOCK,
      onlineAvailability: "IN_STOCK",
      shippingAvailable: true,
      pickupAvailable: false
    }
  ];
}

function inferCategoryKind(name: string): ProductCategoryKind {
  const normalized = name.toLowerCase();
  if (normalized.includes("pokemon center") && (normalized.includes("elite trainer") || normalized.includes(" etb"))) return ProductCategoryKind.POKEMON_CENTER_ETB;
  if (normalized.includes("elite trainer") || normalized.includes(" etb")) return ProductCategoryKind.ELITE_TRAINER_BOX;
  if (normalized.includes("booster bundle")) return ProductCategoryKind.BOOSTER_BUNDLE;
  if (normalized.includes("ultra premium") || normalized.includes(" upc")) return ProductCategoryKind.ULTRA_PREMIUM_COLLECTION;
  if (normalized.includes("sleeved")) return ProductCategoryKind.SLEEVED_BOOSTER;
  if (normalized.includes("collection")) return ProductCategoryKind.COLLECTION_BOX;
  return ProductCategoryKind.NEW_RELEASE;
}

function accepted(status?: PriceStatus): boolean {
  return status === PriceStatus.ACCEPTED || status === PriceStatus.MSRP_MATCH || status === PriceStatus.ACCEPTED_MARKUP;
}

export class BestBuyMockScanService {
  private readonly repo: DashboardRepository;
  private readonly audit: AuditService;
  private readonly mappings: MSRPMappingService;
  private readonly delivery: AlertDeliveryService;
  private readonly wishlist: WishlistService;

  constructor(private readonly prisma: PrismaClient) {
    this.repo = new DashboardRepository(prisma);
    this.audit = new AuditService(prisma);
    this.mappings = new MSRPMappingService(prisma);
    this.delivery = new AlertDeliveryService(prisma);
    this.wishlist = new WishlistService(prisma);
  }

  async getConfig(ownerId: string): Promise<BestBuyScanConfig> {
    const setting = await this.prisma.appSetting.findUnique({ where: { ownerId_key: { ownerId, key: CONFIG_KEY } } });
    const value = setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value) ? setting.value as Partial<BestBuyScanConfig> : {};
    return { ...defaultBestBuyScanConfig, ...value };
  }

  async run(ownerId: string): Promise<BestBuyScanResponse & { mock: true; summary: Record<string, number> }> {
    const startedAt = new Date();
    const config = await this.getConfig(ownerId);
    const store = await this.prisma.store.findUnique({ where: { ownerId_slug: { ownerId, slug: "best-buy" } } });
    if (!store) {
      throw new Error("Best Buy store is not seeded for this user.");
    }

    const products = mockProducts();
    const categories = await this.prisma.productCategory.findMany();
    const categoryByKind = new Map(categories.map((category) => [category.kind, category.id]));
    const mappingCountBefore = await this.prisma.productMSRPMapping.count({ where: { ownerId, storeKey: "best-buy" } });
    const liveFindsBefore = await this.prisma.stockCheckResult.count({ where: { storeId: store.id } });

    let alertCount = 0;
    let acceptedCount = 0;
    let msrpMatchCount = 0;
    let acceptedMarkupCount = 0;
    let overLimitCount = 0;
    let unknownMsrpCount = 0;
    const duplicateSuppressedCount = 1;

    for (const product of products) {
      const categoryKind = inferCategoryKind(product.name);
      const categoryId = categoryByKind.get(categoryKind);
      const categoryLabel = categories.find((category) => category.kind === categoryKind)?.label ?? categoryKind;
      const wishlistMatch = await this.wishlist.matchProduct(ownerId, {
        productName: product.name,
        categoryId,
        categoryLabel,
        storeKey: product.storeKey,
        sku: product.sku
      });
      const retailerProduct = await this.prisma.retailerProduct.upsert({
        where: { storeId_externalId: { storeId: store.id, externalId: product.externalId } },
        create: {
          storeId: store.id,
          categoryId,
          externalId: product.externalId,
          productUrl: product.productUrl,
          imageUrl: product.imageUrl,
          name: product.name,
          sellerName: product.seller,
          sellerIsOfficial: true,
          marketplaceListing: false,
          suspicious: false
        },
        update: {
          categoryId,
          productUrl: product.productUrl,
          imageUrl: product.imageUrl,
          name: product.name,
          sellerName: product.seller,
          sellerIsOfficial: true,
          marketplaceListing: false,
          suspicious: false
        }
      });

      if (accepted(product.priceStatus)) acceptedCount += 1;
      if (product.priceStatus === PriceStatus.MSRP_MATCH) msrpMatchCount += 1;
      if (product.priceStatus === PriceStatus.ACCEPTED_MARKUP) acceptedMarkupCount += 1;
      if (product.priceStatus === PriceStatus.OVER_LIMIT) overLimitCount += 1;
      if (product.priceStatus === PriceStatus.UNKNOWN_MSRP) unknownMsrpCount += 1;

      if (product.priceStatus === PriceStatus.UNKNOWN_MSRP) {
        await this.mappings.createOrUpdateCandidate(ownerId, {
          storeKey: "best-buy",
          retailerSku: product.sku,
          retailerProductId: retailerProduct.id,
          productName: product.name,
          productUrl: product.productUrl,
          imageUrl: product.imageUrl,
          currentPriceCents: product.priceCents,
          status: "UNMAPPED"
        });
      }

      if (wishlistMatch.matchedItemId) {
        await this.audit.log({
          action: wishlistMatch.ignored ? "WISHLIST_PRODUCT_IGNORED" : "WISHLIST_PRODUCT_MATCHED",
          summary: wishlistMatch.ignored ? "Mock product ignored by wishlist rule." : "Mock product matched wishlist rule.",
          actorUserId: ownerId,
          metadata: {
            mock: true,
            noRetailerRequest: true,
            productName: product.name,
            wishlistItemId: wishlistMatch.matchedItemId,
            priority: wishlistMatch.priority,
            alertBehavior: wishlistMatch.alertBehavior,
            matchReasons: wishlistMatch.matchReasons
          }
        });
      }

      const shouldCreateMockAlert = wishlistMatch.shouldAlert && accepted(product.priceStatus) && product.stockStatus !== StockStatus.OUT_OF_STOCK;
      const stockCheck = await this.prisma.stockCheckResult.create({
        data: {
          storeId: store.id,
          retailerProductId: retailerProduct.id,
          priceCents: product.priceCents,
          msrpCents: product.msrpCents,
          acceptedMaxPriceCents: product.maxAcceptedPriceCents,
          accepted: accepted(product.priceStatus),
          sellerName: product.seller,
          sellerAccepted: true,
          priceStatus: product.priceStatus ?? PriceStatus.UNKNOWN_MSRP,
          alertStatus: shouldCreateMockAlert ? AlertStatus.READY : wishlistMatch.ignored || wishlistMatch.dashboardOnly ? AlertStatus.SUPPRESSED : AlertStatus.NOT_SENT,
          stockStatus: product.stockStatus,
          shippingAvailable: product.shippingAvailable,
          pickupAvailable: product.pickupAvailable,
          skipReason: wishlistMatch.ignored ? SkipReason.SINGLES_OR_LOOSE_CARDS : product.priceStatus === PriceStatus.OVER_LIMIT ? SkipReason.PRICE_ABOVE_MAX : SkipReason.NONE,
          ignored: wishlistMatch.ignored,
          rawMetadata: {
            source: "BEST_BUY_MOCK_DEMO",
            mock: true,
            demo: true,
            noRetailerRequest: true,
            sku: product.sku,
            onlineAvailability: product.onlineAvailability,
            regularPriceCents: product.regularPriceCents,
            wishlistPriority: wishlistMatch.priority,
            wishlistAlertBehavior: wishlistMatch.alertBehavior,
            wishlistItemId: wishlistMatch.matchedItemId,
            wishlistItemName: wishlistMatch.matchedItemName,
            wishlistSetName: wishlistMatch.matchedSetName,
            wishlistDesiredQuantity: wishlistMatch.desiredQuantity,
            wishlistMaxPriceCents: wishlistMatch.maxPriceCents,
            wishlistMatchReasons: wishlistMatch.matchReasons
          }
        }
      });

      if (shouldCreateMockAlert) {
        alertCount += 1;
        await this.audit.log({
          action: "WISHLIST_ALERT_PRIORITY_SET",
          summary: "Mock alert priority set by wishlist.",
          actorUserId: ownerId,
          metadata: {
            mock: true,
            noRetailerRequest: true,
            stockCheckResultId: stockCheck.id,
            wishlistItemId: wishlistMatch.matchedItemId,
            priority: wishlistMatch.priority,
            alertBehavior: wishlistMatch.alertBehavior
          }
        });
        await this.prisma.alertEvent.create({
          data: {
            ownerId,
            stockCheckResultId: stockCheck.id,
            type: "ACCEPTABLE_PRICE_FOUND",
            templateType: "TEST_ALERT",
            title: "TEST / MOCK ALERT — PokeDad Radar",
            priority: wishlistMatch.priority === "IGNORE" ? "LOW" : wishlistMatch.priority,
            status: "PENDING",
            message: [
              "TEST / MOCK ALERT — PokeDad Radar",
              "",
              `${product.storeName} - ${product.name}`,
              `Priority: ${wishlistMatch.priority}`,
              `Price: $${((product.priceCents ?? 0) / 100).toFixed(2)}`,
              product.msrpCents == null ? "MSRP: Unknown" : `MSRP: $${(product.msrpCents / 100).toFixed(2)}`,
              "Status: Demo only",
              "",
              "MOCK / DEMO — no retailer request was made."
            ].join("\n")
          }
        });
      }
    }

    const mappingCountAfter = await this.prisma.productMSRPMapping.count({ where: { ownerId, storeKey: "best-buy" } });
    const finishedAt = new Date();
    const state: BestBuyScanState = {
      status: "SUCCEEDED",
      locked: false,
      lastScanStartedAt: startedAt.toISOString(),
      lastScanFinishedAt: finishedAt.toISOString(),
      lastSuccessfulScanAt: finishedAt.toISOString(),
      lastScanDurationMs: finishedAt.getTime() - startedAt.getTime(),
      lastRequestCount: 0,
      lastProductsCheckedCount: products.length,
      lastMatchCount: products.length,
      lastError: "MOCK / DEMO — no retailer request was made.",
      lastResultCount: products.length,
      lastAcceptedCount: acceptedCount,
      lastOverLimitCount: overLimitCount,
      lastUnknownMsrpCount: unknownMsrpCount,
      lastMappingCandidateCreatedCount: Math.max(0, mappingCountAfter - mappingCountBefore),
      lastAlertCount: alertCount,
      lastSuppressedDuplicateCount: duplicateSuppressedCount
    };
    await this.prisma.appSetting.upsert({
      where: { ownerId_key: { ownerId, key: STATUS_KEY } },
      create: { ownerId, key: STATUS_KEY, value: state as unknown as Prisma.InputJsonValue },
      update: { value: state as unknown as Prisma.InputJsonValue }
    });
    await this.audit.log({
      action: "BEST_BUY_SCAN_SUCCEEDED",
      summary: "MOCK / DEMO Best Buy scan completed without retailer requests.",
      actorUserId: ownerId,
      metadata: {
        mock: true,
        noRetailerRequest: true,
        requestCount: 0,
        productsReturned: products.length,
        acceptedCount,
        msrpMatchCount,
        acceptedMarkupCount,
        overLimitCount,
        unknownMsrpCount,
        mappingCandidatesCreated: state.lastMappingCandidateCreatedCount,
        alertEventsCreated: alertCount,
        duplicateAlertsSuppressed: duplicateSuppressedCount,
        liveFindsBefore,
        liveFindsAfter: await this.prisma.stockCheckResult.count({ where: { storeId: store.id } })
      }
    });

    return {
      mock: true,
      adapter: {
        storeKey: "best-buy",
        displayName: "Best Buy",
        configured: false,
        configurationNeeded: true,
        status: "APPROVAL_PENDING",
        capabilities: ["OPEN_PRODUCT"],
        blockedCapabilities: ["AUTO_CHECKOUT", "PAYMENT_SUBMISSION", "CAPTCHA_BYPASS", "QUEUE_BYPASS", "PURCHASE_LIMIT_BYPASS", "UNAPPROVED_BUYING_AGENT", "RETAILER_CREDENTIAL_STORAGE", "RETAILER_COOKIE_STORAGE"],
        safetyNotes: ["MOCK / DEMO only. No Best Buy request was made.", "No cart, checkout, scraping, browser automation, credentials, cookies, or sessions."]
      },
      config,
      scanStatus: state,
      results: products,
      liveFinds: await this.repo.getLiveFinds(ownerId),
      summary: {
        productsReturned: products.length,
        acceptedProducts: acceptedCount,
        msrpMatches: msrpMatchCount,
        acceptedMarkup: acceptedMarkupCount,
        overLimitProducts: overLimitCount,
        unknownMsrpProducts: unknownMsrpCount,
        msrpMappingCandidatesCreated: state.lastMappingCandidateCreatedCount,
        alertEventsCreated: alertCount,
        duplicateAlertsSuppressed: duplicateSuppressedCount,
        bestBuyRequestsMade: 0
      }
    };
  }

  async sendMockDiscordAlert(ownerId: string) {
    const channel = await this.prisma.alertChannel.findFirst({ where: { ownerId, enabled: true, encryptedSecretId: { not: null }, type: "DISCORD_WEBHOOK" }, orderBy: { updatedAt: "desc" } });
    if (!channel) {
      await this.audit.log({ action: "ALERT_DELIVERY_SUPPRESSED", summary: "Mock Discord alert skipped because no enabled Discord channel is connected.", actorUserId: ownerId, metadata: { mock: true, status: "CONFIGURATION_NEEDED" } });
      return { delivered: false, status: "CONFIGURATION_NEEDED", error: "No enabled Discord channel is connected." };
    }
    const event = await this.prisma.alertEvent.create({
      data: {
        ownerId,
        alertChannelId: channel.id,
        type: "ACCEPTABLE_PRICE_FOUND",
        templateType: "TEST_ALERT",
        title: "TEST / MOCK ALERT — PokeDad Radar",
        priority: "HIGH",
        status: "PENDING",
        message: [
          "TEST / MOCK ALERT — PokeDad Radar",
          "",
          "Best Buy - Pokemon Booster Bundle",
          "Wishlist priority: HIGH",
          "Price: $26.99",
          "MSRP: $26.99",
          "Status: Demo only",
          "",
          "No retailer request was made."
        ].join("\n")
      }
    });
    const result = await this.delivery.deliverEvent(ownerId, event.id, channel.id);
    const delivered = result.deliveries.some((item) => item.status === "SENT");
    await this.audit.log({
      action: delivered ? "ALERT_PREVIEW_TEST_SENT" : "ALERT_PREVIEW_TEST_FAILED",
      summary: delivered ? "Mock Discord alert sent." : "Mock Discord alert failed safely.",
      actorUserId: ownerId,
      metadata: { mock: true, alertEventId: event.id, channelId: channel.id, status: result.deliveries[0]?.status ?? "CONFIGURATION_NEEDED" }
    });
    return { delivered, alertEventId: event.id, deliveries: result.deliveries };
  }
}
