import type { AuditAction, Prisma, PrismaClient } from "@prisma/client";
import { AlertStatus, PriceStatus, ProductCategoryKind, SkipReason, StockStatus, evaluateAcceptablePrice, type DemoLiveFind, type DemoPriceRule } from "@pokedad-radar/shared";
import { DashboardRepository } from "../../../repositories/dashboard.repository.js";
import { AuditService } from "../../../services/audit.service.js";
import { MSRPMappingService } from "../../msrp/msrp-mapping.service.js";
import { AlertDeliveryService } from "../../alerts/alert-delivery.service.js";
import { assertCapabilityAllowed } from "../adapter-safety.js";
import type { StoreAdapter } from "../store-adapter.interface.js";
import type { ProductSearchResult } from "../types.js";
import type { BestBuyScanConfig, BestBuyScanResponse, BestBuyScanState, BestBuyScanStatus } from "./bestbuy-scan.types.js";

const CONFIG_KEY = "bestBuyScanConfig";
const STATUS_KEY = "bestBuyScanStatus";
const runningOwnerLocks = new Set<string>();

export const defaultBestBuySearchTerms = [
  "pokemon cards",
  "pokemon tcg",
  "pokemon booster",
  "pokemon elite trainer box",
  "pokemon booster bundle",
  "pokemon collection box",
  "pokemon tin",
  "pokemon premium collection",
  "pokemon upc"
];

export const defaultBestBuyScanConfig: BestBuyScanConfig = {
  enabled: true,
  scheduledScanEnabled: false,
  scanIntervalSeconds: 30 * 60,
  searchTerms: defaultBestBuySearchTerms,
  maxResultsPerScan: 20,
  minimumDelayBetweenApiCallsMs: 1500,
  onlyOfficialBestBuySeller: true,
  onlyPokemonTcgSealedProducts: true,
  applyPriceRules: true,
  createLiveFindCandidates: true,
  sendAlertsForAcceptedPrices: true,
  sendAlertsAutomatically: true,
  sendScanFailureAlerts: false,
  ignoreOverLimitProducts: true,
  ignoreUnknownSuspiciousProducts: true,
  alertOnUnknownMsrp: false,
  autoSuggestMsrpCategory: true,
  alertCooldownMinutes: 6 * 60
};

const defaultScanState: BestBuyScanState = {
  status: "IDLE",
  locked: false,
  lastRequestCount: 0,
  lastProductsCheckedCount: 0,
  lastMatchCount: 0,
  lastResultCount: 0,
  lastAcceptedCount: 0,
  lastOverLimitCount: 0,
  lastUnknownMsrpCount: 0,
  lastMappingCandidateCreatedCount: 0,
  lastAlertCount: 0,
  lastSuppressedDuplicateCount: 0
};

function nowIso(): string {
  return new Date().toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeConfig(value: unknown): BestBuyScanConfig {
  const incoming = (value && typeof value === "object" ? value : {}) as Partial<BestBuyScanConfig>;
  return {
    ...defaultBestBuyScanConfig,
    ...incoming,
    searchTerms: Array.isArray(incoming.searchTerms) && incoming.searchTerms.length > 0
      ? incoming.searchTerms.map((term) => String(term).trim()).filter(Boolean).slice(0, 20)
      : defaultBestBuySearchTerms
  };
}

function mergeState(value: unknown): BestBuyScanState {
  const incoming = (value && typeof value === "object" ? value : {}) as Partial<BestBuyScanState>;
  return {
    ...defaultScanState,
    ...incoming,
    locked: incoming.status === "RUNNING" || Boolean(incoming.locked)
  };
}

function sanitizeError(error: unknown): string {
  return String(error).replace(/apiKey=[^&\s]+/gi, "apiKey=[REDACTED]").slice(0, 500);
}

function isSealedPokemonProduct(name: string): boolean {
  const normalized = name.toLowerCase();
  if (!normalized.includes("pokemon") && !normalized.includes("pokémon")) {
    return false;
  }
  return [
    "tcg",
    "card",
    "booster",
    "elite trainer",
    "etb",
    "bundle",
    "collection",
    "tin",
    "premium",
    "upc"
  ].some((term) => normalized.includes(term));
}

function statusAllowsAlert(status?: PriceStatus, alertOnUnknownMsrp = false): boolean {
  return status === PriceStatus.ACCEPTED
    || status === PriceStatus.MSRP_MATCH
    || status === PriceStatus.ACCEPTED_MARKUP
    || (alertOnUnknownMsrp && status === PriceStatus.UNKNOWN_MSRP);
}

function statusIsAccepted(status?: PriceStatus): boolean {
  return status === PriceStatus.ACCEPTED || status === PriceStatus.MSRP_MATCH || status === PriceStatus.ACCEPTED_MARKUP;
}

export class BestBuyScanService {
  private readonly repo: DashboardRepository;
  private readonly audit: AuditService;
  private readonly mappings: MSRPMappingService;
  private readonly alertDelivery: AlertDeliveryService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly adapter: StoreAdapter
  ) {
    this.repo = new DashboardRepository(prisma);
    this.audit = new AuditService(prisma);
    this.mappings = new MSRPMappingService(prisma);
    this.alertDelivery = new AlertDeliveryService(prisma);
  }

  async getConfig(ownerId: string): Promise<BestBuyScanConfig> {
    const setting = await this.prisma.appSetting.findUnique({ where: { ownerId_key: { ownerId, key: CONFIG_KEY } } });
    return mergeConfig(setting?.value);
  }

  async saveConfig(ownerId: string, input: Partial<BestBuyScanConfig>): Promise<BestBuyScanConfig> {
    const current = await this.getConfig(ownerId);
    const scheduledScanEnabled = input.scheduledScanEnabled ?? current.scheduledScanEnabled;
    const minimumInterval = scheduledScanEnabled ? 30 * 60 : 5 * 60;
    const config = mergeConfig({
      ...current,
      ...input,
      scheduledScanEnabled,
      scanIntervalSeconds: Math.max(minimumInterval, input.scanIntervalSeconds ?? current.scanIntervalSeconds),
      maxResultsPerScan: input.maxResultsPerScan == null ? current.maxResultsPerScan : Math.min(Math.max(1, input.maxResultsPerScan), 100),
      minimumDelayBetweenApiCallsMs: input.minimumDelayBetweenApiCallsMs == null ? current.minimumDelayBetweenApiCallsMs : Math.max(1000, input.minimumDelayBetweenApiCallsMs),
      alertCooldownMinutes: input.alertCooldownMinutes == null ? current.alertCooldownMinutes : Math.max(15, input.alertCooldownMinutes)
    });
    await this.prisma.appSetting.upsert({
      where: { ownerId_key: { ownerId, key: CONFIG_KEY } },
      create: { ownerId, key: CONFIG_KEY, value: config as unknown as Prisma.InputJsonValue },
      update: { value: config as unknown as Prisma.InputJsonValue }
    });
    const state = await this.getState(ownerId);
    if (config.enabled && state.status === "DISABLED") {
      await this.saveState(ownerId, {
        ...state,
        status: "IDLE",
        locked: false,
        lastError: undefined
      });
    }
    if (!config.enabled) {
      await this.saveState(ownerId, {
        ...state,
        status: "DISABLED",
        locked: false,
        lastError: "Best Buy scan is disabled."
      });
    }
    await this.log(ownerId, config.enabled ? "BEST_BUY_SCAN_ENABLED" : "BEST_BUY_SCAN_DISABLED", `Best Buy scan ${config.enabled ? "enabled" : "disabled"}.`, {
      enabled: config.enabled,
      scanIntervalSeconds: config.scanIntervalSeconds,
      maxResultsPerScan: config.maxResultsPerScan
    });
    return config;
  }

  async getState(ownerId: string): Promise<BestBuyScanState> {
    const setting = await this.prisma.appSetting.findUnique({ where: { ownerId_key: { ownerId, key: STATUS_KEY } } });
    const state = mergeState(setting?.value);
    return {
      ...state,
      locked: state.status === "RUNNING" || runningOwnerLocks.has(ownerId)
    };
  }

  async runManualScan(ownerId: string, trigger: "MANUAL" | "SCHEDULED" = "MANUAL"): Promise<BestBuyScanResponse> {
    const adapterStatus = this.adapter.getStatus();
    const config = await this.getConfig(ownerId);
    const currentState = await this.getState(ownerId);

    if (!config.enabled) {
      const scanStatus = await this.saveState(ownerId, {
        ...currentState,
        status: "DISABLED",
        locked: false,
        lastError: "Best Buy scan is disabled."
      });
      await this.log(ownerId, "BEST_BUY_SCAN_DISABLED", "Best Buy scan skipped because it is disabled.", { storeKey: "best-buy", trigger });
      return { adapter: adapterStatus, config, scanStatus, results: [], liveFinds: [], error: scanStatus.lastError };
    }

    if (!adapterStatus.configured) {
      const scanStatus = await this.saveState(ownerId, {
        ...currentState,
        status: "CONFIGURATION_NEEDED",
        locked: false,
        lastError: adapterStatus.message ?? "BEST_BUY_API_KEY is required."
      });
      await this.log(ownerId, "BEST_BUY_SCAN_API_KEY_MISSING", "Best Buy scan skipped because API key is missing.", { storeKey: "best-buy", trigger });
      await this.deliverScanFailure(ownerId, config, "Best Buy scan needs BEST_BUY_API_KEY before it can run.");
      return { adapter: adapterStatus, config, scanStatus, results: [], liveFinds: [], error: scanStatus.lastError };
    }

    if (currentState.locked || runningOwnerLocks.has(ownerId)) {
      const scanStatus = await this.saveState(ownerId, {
        ...currentState,
        status: "RUNNING",
        locked: true,
        lastError: "Best Buy scan is already running."
      });
      return { adapter: adapterStatus, config, scanStatus, results: [], liveFinds: [], error: scanStatus.lastError };
    }

    const nextAllowed = this.nextAllowedScanAt(currentState, config);
    if (nextAllowed && nextAllowed.getTime() > Date.now()) {
      const scanStatus = await this.saveState(ownerId, {
        ...currentState,
        status: "RATE_LIMITED",
        locked: false,
        nextAllowedScanAt: nextAllowed.toISOString(),
        lastError: "Best Buy scan was rate-limited to avoid rapid repeated API calls."
      });
      await this.log(ownerId, "BEST_BUY_SCAN_RATE_LIMITED", "Best Buy scan rate-limited.", { nextAllowedScanAt: scanStatus.nextAllowedScanAt, trigger });
      return { adapter: adapterStatus, config, scanStatus, results: [], liveFinds: [], error: scanStatus.lastError };
    }

    runningOwnerLocks.add(ownerId);
    const startedAt = new Date();
    let requestCount = 0;
    await this.saveState(ownerId, {
      status: "RUNNING",
      locked: true,
      lastScanStartedAt: startedAt.toISOString(),
      lastRequestCount: 0,
      lastProductsCheckedCount: 0,
      lastMatchCount: 0,
      lastResultCount: currentState.lastResultCount,
        lastAcceptedCount: currentState.lastAcceptedCount,
        lastOverLimitCount: currentState.lastOverLimitCount,
        lastUnknownMsrpCount: currentState.lastUnknownMsrpCount,
        lastMappingCandidateCreatedCount: currentState.lastMappingCandidateCreatedCount,
      lastAlertCount: currentState.lastAlertCount,
      lastSuppressedDuplicateCount: currentState.lastSuppressedDuplicateCount
    });
    await this.log(ownerId, "BEST_BUY_SCAN_STARTED", "Best Buy read-only scan started.", {
      trigger,
      searchTermCount: config.searchTerms.length,
      maxResultsPerScan: config.maxResultsPerScan
    });

    try {
      assertCapabilityAllowed(this.adapter, "PRODUCT_SEARCH");
      const rawResults = await this.searchAllTerms(config, () => { requestCount += 1; });
      const results = config.applyPriceRules ? this.applyPriceRules(rawResults, await this.repo.getPriceRules(ownerId)) : rawResults;
      const filtered = this.filterResults(results, config);
      const persistResult = await this.persistResults(ownerId, filtered, config);
      const finishedAt = new Date();
      const scanStatus = await this.saveState(ownerId, {
        status: "SUCCEEDED",
        locked: false,
        lastScanStartedAt: startedAt.toISOString(),
        lastScanFinishedAt: finishedAt.toISOString(),
        lastSuccessfulScanAt: finishedAt.toISOString(),
        lastScanDurationMs: finishedAt.getTime() - startedAt.getTime(),
        lastRequestCount: requestCount,
        lastProductsCheckedCount: rawResults.length,
        lastMatchCount: filtered.length,
        lastError: undefined,
        lastResultCount: filtered.length,
        lastAcceptedCount: persistResult.acceptedCount,
        lastOverLimitCount: persistResult.overLimitCount,
        lastUnknownMsrpCount: persistResult.unknownMsrpCount,
        lastMappingCandidateCreatedCount: persistResult.mappingCandidateCreatedCount,
        lastAlertCount: persistResult.alertCount,
        lastSuppressedDuplicateCount: persistResult.suppressedDuplicateCount,
        nextAllowedScanAt: new Date(finishedAt.getTime() + config.scanIntervalSeconds * 1000).toISOString()
      });
      await this.log(ownerId, "BEST_BUY_SCAN_SUCCEEDED", "Best Buy read-only scan succeeded.", {
        trigger,
        requestCount,
        productsCheckedCount: rawResults.length,
        matchCount: filtered.length,
        alertCount: persistResult.alertCount,
        suppressedDuplicateCount: persistResult.suppressedDuplicateCount,
        durationMs: scanStatus.lastScanDurationMs
      });
      return { adapter: adapterStatus, config, scanStatus, results: filtered, liveFinds: persistResult.liveFinds };
    } catch (error) {
      const finishedAt = new Date();
      const errorSummary = sanitizeError(error);
      const providerRateLimited = /429|rate.?limit|too many requests/i.test(errorSummary);
      const scanStatus = await this.saveState(ownerId, {
        status: providerRateLimited ? "RATE_LIMITED" : "FAILED",
        locked: false,
        lastScanStartedAt: startedAt.toISOString(),
        lastScanFinishedAt: finishedAt.toISOString(),
        lastScanDurationMs: finishedAt.getTime() - startedAt.getTime(),
        lastRequestCount: requestCount,
        lastProductsCheckedCount: 0,
        lastMatchCount: 0,
        lastError: errorSummary,
        lastResultCount: 0,
        lastAcceptedCount: 0,
        lastOverLimitCount: 0,
        lastUnknownMsrpCount: 0,
        lastMappingCandidateCreatedCount: 0,
        lastAlertCount: 0,
        lastSuppressedDuplicateCount: 0,
        nextAllowedScanAt: new Date(finishedAt.getTime() + Math.max(300, Math.floor(config.scanIntervalSeconds / 2)) * 1000).toISOString()
      });
      await this.log(ownerId, providerRateLimited ? "BEST_BUY_SCAN_RATE_LIMITED" : "BEST_BUY_SCAN_FAILED", providerRateLimited ? "Best Buy API rate limit response handled safely." : "Best Buy read-only scan failed.", { error: scanStatus.lastError, trigger, requestCount, rateLimited: providerRateLimited });
      await this.deliverScanFailure(ownerId, config, "Best Buy read-only scan failed. Check Scan Settings and the sanitized audit log.");
      return { adapter: adapterStatus, config, scanStatus, results: [], liveFinds: [], error: scanStatus.lastError };
    } finally {
      runningOwnerLocks.delete(ownerId);
    }
  }

  private async searchAllTerms(config: BestBuyScanConfig, onRequest: () => void): Promise<ProductSearchResult[]> {
    const unique = new Map<string, ProductSearchResult>();
    const limitPerTerm = Math.min(20, Math.max(1, Math.ceil(config.maxResultsPerScan / Math.max(config.searchTerms.length, 1))));

    for (const [index, term] of config.searchTerms.entries()) {
      if (unique.size >= config.maxResultsPerScan) {
        break;
      }
      if (index > 0) {
        await delay(config.minimumDelayBetweenApiCallsMs);
      }
      onRequest();
      const results = await this.adapter.searchProducts!({ query: term, limit: limitPerTerm });
      for (const result of results) {
        const key = result.sku ?? result.externalId;
        if (!unique.has(key)) {
          unique.set(key, result);
        }
        if (unique.size >= config.maxResultsPerScan) {
          break;
        }
      }
    }

    return [...unique.values()];
  }

  private applyPriceRules(results: ProductSearchResult[], priceRules: DemoPriceRule[]): ProductSearchResult[] {
    return results.map((result) => {
      if (result.priceCents == null) {
        return { ...result, priceStatus: PriceStatus.UNKNOWN_MSRP };
      }
      const rule = this.findBestRule(result, priceRules);
      const evaluated = evaluateAcceptablePrice({
        priceCents: result.priceCents,
        msrpCents: rule?.msrpCents ?? result.msrpCents ?? result.regularPriceCents,
        customMaxPriceCents: rule?.maxAcceptedPriceCents ?? result.maxAcceptedPriceCents,
        toleranceCents: rule?.allowedMarkupCents,
        sellerAccepted: result.sellerAccepted
      });
      return {
        ...result,
        msrpCents: rule?.msrpCents ?? result.msrpCents ?? result.regularPriceCents,
        maxAcceptedPriceCents: evaluated.acceptedMaxPriceCents,
        priceStatus: evaluated.priceStatus
      };
    });
  }

  private findBestRule(result: ProductSearchResult, priceRules: DemoPriceRule[]): DemoPriceRule | undefined {
    const name = result.name.toLowerCase();
    const enabled = priceRules.filter((rule) => rule.enabled);
    return enabled.find((rule) => rule.scope === "PRODUCT" && name.includes(rule.target.toLowerCase()))
      ?? enabled.find((rule) => rule.scope === "CATEGORY" && this.categoryMatches(name, rule.target))
      ?? enabled.find((rule) => rule.scope === "STORE" && rule.target.toLowerCase().includes("best buy"))
      ?? enabled.find((rule) => rule.scope === "GLOBAL");
  }

  private categoryMatches(name: string, target: string): boolean {
    const normalized = target.toLowerCase();
    if (normalized.includes("elite trainer")) return name.includes("elite trainer") || name.includes(" etb");
    if (normalized.includes("booster bundle")) return name.includes("booster bundle");
    if (normalized.includes("booster box")) return name.includes("booster box");
    if (normalized.includes("ultra premium")) return name.includes("ultra premium") || name.includes(" upc");
    if (normalized.includes("premium collection")) return name.includes("premium collection");
    if (normalized.includes("collection box")) return name.includes("collection box");
    if (normalized.includes("tin")) return name.includes("tin");
    return name.includes(normalized);
  }

  private filterResults(results: ProductSearchResult[], config: BestBuyScanConfig): ProductSearchResult[] {
    return results.filter((result) => {
      if (config.onlyOfficialBestBuySeller && !result.sellerAccepted) {
        return false;
      }
      if (config.onlyPokemonTcgSealedProducts && !isSealedPokemonProduct(result.name)) {
        return false;
      }
      if (config.ignoreOverLimitProducts && result.priceStatus === PriceStatus.OVER_LIMIT) {
        return false;
      }
      if (config.ignoreUnknownSuspiciousProducts && result.priceStatus === PriceStatus.UNKNOWN_MSRP && !isSealedPokemonProduct(result.name)) {
        return false;
      }
      return true;
    });
  }

  private async persistResults(ownerId: string, results: ProductSearchResult[], config: BestBuyScanConfig): Promise<{ liveFinds: DemoLiveFind[]; alertCount: number; suppressedDuplicateCount: number; acceptedCount: number; overLimitCount: number; unknownMsrpCount: number; mappingCandidateCreatedCount: number }> {
    const store = await this.prisma.store.findUnique({ where: { ownerId_slug: { ownerId, slug: "best-buy" } } });
    if (!store) {
      throw new Error("Best Buy store is not seeded for this user.");
    }

    const categories = await this.prisma.productCategory.findMany();
    const categoryByKind = new Map(categories.map((category) => [category.kind, category.id]));
    let alertCount = 0;
    let suppressedDuplicateCount = 0;
    let acceptedCount = 0;
    let overLimitCount = 0;
    let unknownMsrpCount = 0;
    const mappingCountBefore = await this.prisma.productMSRPMapping.count({ where: { ownerId, storeKey: "best-buy" } });

    for (const rawResult of results) {
      const externalId = rawResult.sku ?? rawResult.externalId;
      const categoryKind = this.inferCategoryKind(rawResult.name);
      const retailerProduct = await this.prisma.retailerProduct.upsert({
        where: { storeId_externalId: { storeId: store.id, externalId } },
        create: {
          storeId: store.id,
          categoryId: categoryByKind.get(categoryKind),
          externalId,
          productUrl: rawResult.productUrl,
          imageUrl: rawResult.imageUrl,
          name: rawResult.name,
          sellerName: rawResult.seller,
          sellerIsOfficial: rawResult.sellerAccepted,
          marketplaceListing: !rawResult.sellerAccepted,
          suspicious: false
        },
        update: {
          categoryId: categoryByKind.get(categoryKind),
          productUrl: rawResult.productUrl,
          imageUrl: rawResult.imageUrl,
          name: rawResult.name,
          sellerName: rawResult.seller,
          sellerIsOfficial: rawResult.sellerAccepted,
          marketplaceListing: !rawResult.sellerAccepted,
          suspicious: false
        }
      });

      const result = await this.mappings.applyMappedPrice(ownerId, rawResult, retailerProduct.id);
      if (statusIsAccepted(result.priceStatus)) acceptedCount += 1;
      if (result.priceStatus === PriceStatus.OVER_LIMIT) overLimitCount += 1;
      if (result.priceStatus === PriceStatus.UNKNOWN_MSRP) unknownMsrpCount += 1;
      if (config.autoSuggestMsrpCategory && result.priceStatus === PriceStatus.UNKNOWN_MSRP) {
        await this.mappings.createOrUpdateCandidate(ownerId, {
          storeKey: result.storeKey,
          retailerSku: externalId,
          retailerProductId: retailerProduct.id,
          productName: result.name,
          productUrl: result.productUrl,
          imageUrl: result.imageUrl,
          currentPriceCents: result.priceCents,
          status: "UNMAPPED"
        });
      }

      const shouldAlert = config.sendAlertsForAcceptedPrices && statusAllowsAlert(result.priceStatus, config.alertOnUnknownMsrp);
      const duplicateSuppressed = shouldAlert ? await this.hasRecentDuplicateAlert(retailerProduct.id, result, config) : false;
      if (duplicateSuppressed) {
        suppressedDuplicateCount += 1;
        await this.log(ownerId, "BEST_BUY_DUPLICATE_ALERT_SUPPRESSED", `Duplicate Best Buy alert suppressed for ${result.name}.`, {
          sku: externalId,
          priceCents: result.priceCents,
          stockStatus: result.stockStatus,
          cooldownMinutes: config.alertCooldownMinutes
        });
      }

      const alertStatus = shouldAlert && !duplicateSuppressed ? AlertStatus.READY : AlertStatus.NOT_SENT;
      const stockCheck = await this.prisma.stockCheckResult.create({
        data: {
          storeId: store.id,
          retailerProductId: retailerProduct.id,
          priceCents: result.priceCents,
          msrpCents: result.msrpCents,
          acceptedMaxPriceCents: result.maxAcceptedPriceCents,
          accepted: statusIsAccepted(result.priceStatus),
          sellerName: result.seller,
          sellerAccepted: result.sellerAccepted,
          priceStatus: result.priceStatus ?? PriceStatus.UNKNOWN_MSRP,
          alertStatus,
          stockStatus: result.stockStatus,
          shippingAvailable: result.shippingAvailable,
          pickupAvailable: result.pickupAvailable,
          skipReason: this.skipReason(result),
          rawMetadata: {
            source: "BEST_BUY_API",
            sku: externalId,
            onlineAvailability: result.onlineAvailability,
            regularPriceCents: result.regularPriceCents
          }
        }
      });

      if (shouldAlert && !duplicateSuppressed) {
        alertCount += 1;
        const templateType = result.priceStatus === PriceStatus.MSRP_MATCH ? "MSRP_MATCH_FOUND" : result.priceStatus === PriceStatus.UNKNOWN_MSRP ? "UNKNOWN_MSRP_MAPPING" : "ACCEPTED_PRICE_FOUND";
        const alertEvent = await this.prisma.alertEvent.create({
          data: {
            ownerId,
            stockCheckResultId: stockCheck.id,
            type: statusIsAccepted(result.priceStatus) ? "ACCEPTABLE_PRICE_FOUND" : "MSRP_FOUND",
            templateType,
            title: templateType === "MSRP_MATCH_FOUND" ? "MSRP Match Found" : templateType === "UNKNOWN_MSRP_MAPPING" ? "MSRP Mapping Needed" : "Accepted Price Found",
            priority: templateType === "MSRP_MATCH_FOUND" ? "URGENT" : templateType === "ACCEPTED_PRICE_FOUND" ? "HIGH" : "NORMAL",
            status: "PENDING",
            message: this.alertMessage(result, store.cartUrl ?? store.baseUrl)
          }
        });
        if (config.sendAlertsAutomatically) {
          await this.alertDelivery.deliverEvent(ownerId, alertEvent.id);
        }
        await this.log(ownerId, "BEST_BUY_ALERT_CREATED", `Best Buy alert created for ${result.name}.`, {
          sku: externalId,
          priceCents: result.priceCents,
          msrpCents: result.msrpCents,
          acceptedMaxPriceCents: result.maxAcceptedPriceCents,
          priceStatus: result.priceStatus,
          stockStatus: result.stockStatus
        });
      }

      if (statusIsAccepted(result.priceStatus)) {
        await this.log(ownerId, "BEST_BUY_RESULT_ACCEPTED", `Best Buy result accepted: ${result.name}.`, {
          sku: externalId,
          priceCents: result.priceCents,
          priceStatus: result.priceStatus
        });
      } else if (result.priceStatus === PriceStatus.OVER_LIMIT) {
        await this.log(ownerId, "BEST_BUY_RESULT_OVER_LIMIT", `Best Buy result over limit: ${result.name}.`, {
          sku: externalId,
          priceCents: result.priceCents,
          acceptedMaxPriceCents: result.maxAcceptedPriceCents
        });
      }
    }

    const mappingCountAfter = await this.prisma.productMSRPMapping.count({ where: { ownerId, storeKey: "best-buy" } });
    return {
      liveFinds: config.createLiveFindCandidates ? await this.repo.getLiveFinds(ownerId) : [],
      alertCount,
      suppressedDuplicateCount,
      acceptedCount,
      overLimitCount,
      unknownMsrpCount,
      mappingCandidateCreatedCount: Math.max(0, mappingCountAfter - mappingCountBefore)
    };
  }

  private async hasRecentDuplicateAlert(retailerProductId: string, result: ProductSearchResult, config: BestBuyScanConfig): Promise<boolean> {
    const since = new Date(Date.now() - config.alertCooldownMinutes * 60 * 1000);
    const duplicate = await this.prisma.alertEvent.findFirst({
      where: {
        createdAt: { gte: since },
        stockCheckResult: {
          retailerProductId,
          priceCents: result.priceCents,
          stockStatus: result.stockStatus,
          rawMetadata: {
            path: ["onlineAvailability"],
            equals: result.onlineAvailability
          }
        }
      }
    });
    return Boolean(duplicate);
  }

  private async deliverScanFailure(ownerId: string, config: BestBuyScanConfig, message: string): Promise<void> {
    if (!config.sendScanFailureAlerts) return;
    const since = new Date(Date.now() - config.alertCooldownMinutes * 60 * 1000);
    const duplicate = await this.prisma.alertEvent.findFirst({ where: { type: "ERROR", createdAt: { gte: since }, message } });
    if (duplicate) {
      await this.log(ownerId, "ALERT_DELIVERY_SUPPRESSED", "Duplicate scan failure alert suppressed by cooldown.", { cooldownMinutes: config.alertCooldownMinutes });
      return;
    }
    const configurationNeeded = /config|api key|not configured/i.test(message);
    const event = await this.prisma.alertEvent.create({ data: { ownerId, type: "ERROR", templateType: configurationNeeded ? "CONFIGURATION_NEEDED" : "SCAN_FAILED", title: configurationNeeded ? "Configuration Needed" : "Scan Failed", priority: "LOW", status: "PENDING", message } });
    await this.alertDelivery.deliverEvent(ownerId, event.id).catch(async () => {
      await this.log(ownerId, "ALERT_DELIVERY_FAILED", "Scan failure alert could not be delivered.", {});
    });
  }

  private nextAllowedScanAt(state: BestBuyScanState, config: BestBuyScanConfig): Date | null {
    const last = state.lastScanStartedAt ?? state.lastScanFinishedAt;
    if (!last) {
      return null;
    }
    return new Date(new Date(last).getTime() + config.scanIntervalSeconds * 1000);
  }

  private async saveState(ownerId: string, state: BestBuyScanState): Promise<BestBuyScanState> {
    const normalized = mergeState(state);
    await this.prisma.appSetting.upsert({
      where: { ownerId_key: { ownerId, key: STATUS_KEY } },
      create: { ownerId, key: STATUS_KEY, value: normalized as unknown as Prisma.InputJsonValue },
      update: { value: normalized as unknown as Prisma.InputJsonValue }
    });
    return normalized;
  }

  private async log(ownerId: string, action: AuditAction, summary: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.audit.log({ action, summary, actorUserId: ownerId, metadata });
  }

  private inferCategoryKind(name: string): ProductCategoryKind {
    const normalized = name.toLowerCase();
    if (normalized.includes("elite trainer") || normalized.includes(" etb")) return ProductCategoryKind.ELITE_TRAINER_BOX;
    if (normalized.includes("booster bundle")) return ProductCategoryKind.BOOSTER_BUNDLE;
    if (normalized.includes("booster box")) return ProductCategoryKind.BOOSTER_BOX;
    if (normalized.includes("ultra premium") || normalized.includes(" upc")) return ProductCategoryKind.ULTRA_PREMIUM_COLLECTION;
    if (normalized.includes("premium collection")) return ProductCategoryKind.PREMIUM_COLLECTION;
    if (normalized.includes("collection box")) return ProductCategoryKind.COLLECTION_BOX;
    if (normalized.includes("mini tin")) return ProductCategoryKind.MINI_TIN;
    if (normalized.includes("tin")) return ProductCategoryKind.TIN;
    if (normalized.includes("sleeved") || normalized.includes("booster pack")) return ProductCategoryKind.SLEEVED_BOOSTER;
    return ProductCategoryKind.NEW_RELEASE;
  }

  private skipReason(result: ProductSearchResult): SkipReason {
    if (!result.sellerAccepted) return SkipReason.THIRD_PARTY_SELLER;
    if (result.priceStatus === PriceStatus.OVER_LIMIT) return SkipReason.PRICE_ABOVE_MAX;
    return SkipReason.NONE;
  }

  private alertMessage(result: ProductSearchResult, cartUrl: string): string {
    const price = result.priceCents == null ? "unknown price" : `$${(result.priceCents / 100).toFixed(2)}`;
    const msrp = result.msrpCents == null ? "unknown MSRP" : `$${(result.msrpCents / 100).toFixed(2)} MSRP`;
    const max = result.maxAcceptedPriceCents == null ? "no accepted max" : `$${(result.maxAcceptedPriceCents / 100).toFixed(2)} max`;
    return [
      `${result.name} at Best Buy: ${price}.`,
      `${msrp}; ${max}.`,
      `Stock: ${result.stockStatus}.`,
      `Open product: ${result.productUrl}`,
      `Open cart: ${cartUrl}`,
      `Reason: ${result.priceStatus ?? PriceStatus.UNKNOWN_MSRP}`
    ].join(" ");
  }
}
