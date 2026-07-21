import { defineStore } from "pinia";
import {
  AlertStatus,
  CartAssistMode,
  CartAssistStatus,
  PriceStatus,
  ProductCategoryKind,
  SellerPolicy,
  StockStatus,
  StoreSessionState,
  formatCents,
  type DemoAlertChannel,
  type DemoAuditLog,
  type DemoCartAttempt,
  type DemoHistoryEvent,
  type DemoLiveFind,
  type DemoPriceRule,
  type DemoRadarRules,
  type DemoStore
} from "@pokedad-radar/shared";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const hasBody = options?.body != null;
  const response = await fetch(`${apiBase}${path}`, {
    headers: { ...(hasBody ? { "content-type": "application/json" } : {}), ...(options?.headers ?? {}) },
    credentials: "include",
    ...options
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function apiWithBody<T>(path: string, options?: RequestInit): Promise<{ ok: boolean; status: number; body: T }> {
  const hasBody = options?.body != null;
  const response = await fetch(`${apiBase}${path}`, {
    headers: { ...(hasBody ? { "content-type": "application/json" } : {}), ...(options?.headers ?? {}) },
    credentials: "include",
    ...options
  });
  return {
    ok: response.ok,
    status: response.status,
    body: await response.json() as T
  };
}

export interface AdapterStatus {
  storeKey: string;
  displayName: string;
  configured: boolean;
  configurationNeeded: boolean;
  status: "READY" | "CONFIGURATION_NEEDED" | "APPROVAL_PENDING" | "DISABLED" | "ERROR";
  capabilities: string[];
  blockedCapabilities: string[];
  safetyNotes: string[];
  message?: string;
}

export interface AdapterProduct {
  storeKey: string;
  storeName: string;
  source: string;
  externalId: string;
  sku?: string;
  name: string;
  seller: string;
  sellerAccepted: boolean;
  productUrl: string;
  imageUrl?: string | null;
  priceCents?: number | null;
  regularPriceCents?: number | null;
  msrpCents?: number | null;
  maxAcceptedPriceCents?: number | null;
  priceStatus?: PriceStatus;
  stockStatus: StockStatus;
  onlineAvailability: string;
  shippingAvailable?: boolean | null;
  pickupAvailable?: boolean | null;
}

export interface SafeBotStatus {
  connected: boolean;
  status: string;
  message?: string;
}

export type BestBuyScanStatus = "IDLE" | "CONFIGURATION_NEEDED" | "APPROVAL_PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "RATE_LIMITED" | "DISABLED";

export interface BestBuyScanConfig {
  enabled: boolean;
  scheduledScanEnabled: boolean;
  scanIntervalSeconds: number;
  searchTerms: string[];
  maxResultsPerScan: number;
  minimumDelayBetweenApiCallsMs: number;
  onlyOfficialBestBuySeller: boolean;
  onlyPokemonTcgSealedProducts: boolean;
  applyPriceRules: boolean;
  createLiveFindCandidates: boolean;
  sendAlertsForAcceptedPrices: boolean;
  sendAlertsAutomatically: boolean;
  sendScanFailureAlerts: boolean;
  ignoreOverLimitProducts: boolean;
  ignoreUnknownSuspiciousProducts: boolean;
  alertOnUnknownMsrp: boolean;
  autoSuggestMsrpCategory: boolean;
  alertCooldownMinutes: number;
}

export interface BestBuySchedulerState {
  status: "STOPPED" | "WAITING" | "RUNNING" | "CONFIGURATION_NEEDED" | "REDIS_UNAVAILABLE" | "ERROR";
  active: boolean;
  lastTickAt?: string;
  lastScheduledScanAt?: string;
  nextRunAt?: string;
  lastResultStatus?: BestBuyScanStatus;
  lastError?: string;
}

export interface BestBuyScanState {
  status: BestBuyScanStatus;
  locked: boolean;
  lastScanStartedAt?: string;
  lastScanFinishedAt?: string;
  lastSuccessfulScanAt?: string;
  lastScanDurationMs?: number;
  lastRequestCount: number;
  lastProductsCheckedCount: number;
  lastMatchCount: number;
  lastError?: string;
  lastResultCount: number;
  lastAcceptedCount: number;
  lastOverLimitCount: number;
  lastUnknownMsrpCount: number;
  lastMappingCandidateCreatedCount: number;
  lastAlertCount: number;
  lastSuppressedDuplicateCount: number;
  nextAllowedScanAt?: string;
}

export interface BestBuyManualReadiness {
  status: "CONFIGURATION_NEEDED" | "READY_FOR_MANUAL_SCAN" | "COOLDOWN_ACTIVE" | "SCAN_RUNNING" | "SCHEDULER_MUST_BE_STOPPED" | "DEPENDENCY_UNAVAILABLE";
  ready: boolean;
  configured: boolean;
  schedulerStopped: boolean;
  redisReady: boolean;
  alertChannelReady: boolean;
  checkedAt: string;
  cooldownEndsAt?: string;
  reasons: string[];
  warnings: string[];
  readinessToken?: string;
  readinessExpiresAt?: string;
}

export type MSRPMappingStatus = "UNMAPPED" | "SUGGESTED" | "MAPPED" | "IGNORED" | "NEEDS_REVIEW";

export interface MSRPMapping {
  id: string;
  storeKey: string;
  retailerSku?: string | null;
  retailerProductId?: string | null;
  productName: string;
  productUrl?: string | null;
  imageUrl?: string | null;
  currentPriceCents?: number | null;
  detectedKeywords: string[];
  suggestedCategoryId?: string | null;
  suggestedCategoryLabel?: string | null;
  mappedCategoryId?: string | null;
  mappedCategoryLabel?: string | null;
  msrpCents?: number | null;
  acceptedMaxPriceCents?: number | null;
  confidence: "LOW" | "MEDIUM" | "HIGH" | "MANUAL";
  status: MSRPMappingStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MSRPMappingCategory {
  id: string;
  kind: string;
  label: string;
  msrpCents?: number | null;
  acceptedMaxPriceCents?: number | null;
}

export interface DiscordOAuthStatus {
  configured: boolean;
  connected: boolean;
  guildId: string | null;
  guildName: string | null;
  channelId: string | null;
  channelName: string | null;
  webhookName: string | null;
  maskedConfig: string;
  lastTestStatus: string | null;
  lastTestAt: string | null;
  lastError: string | null;
}

export type AlertTemplateType = "ACCEPTED_PRICE_FOUND" | "MSRP_MATCH_FOUND" | "PRICE_DROPPED_ACCEPTED" | "UNKNOWN_MSRP_MAPPING" | "HUMAN_REVIEW_NEEDED" | "SCAN_FAILED" | "CONFIGURATION_NEEDED" | "TEST_ALERT" | "RELEASE_REMINDER" | "TEST_RELEASE_REMINDER";

export interface AlertTemplateSettings {
  compactMobileAlerts: boolean;
  includeProductImage: boolean;
  includeMsrpDetails: boolean;
  includeOpenProductLink: boolean;
}

export interface NotificationSummary {
  id: string;
  stockCheckResultId?: string | null;
  title: string;
  alertType: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  productName: string | null;
  storeName: string | null;
  priceCents: number | null;
  status: string;
  channelsAttempted: Array<{ id: string; name: string; provider: string }>;
  sentAt: string | null;
  createdAt: string;
  errorSummary: string | null;
  productUrl: string | null;
  isMockDemo?: boolean;
  purchaseDecision?: PurchaseDecisionSummary | null;
  wishlistPriority?: WishlistPriority | null;
  wishlistItemName?: string | null;
  wishlistSetName?: string | null;
  wishlistAlertBehavior?: WishlistAlertBehavior | null;
  wishlistMatchReasons?: string[];
}

export interface NotificationDetail extends NotificationSummary {
  messagePreview: string;
  product: null | { name: string; storeName: string; priceCents: number | null; msrpCents: number | null; acceptedMaxPriceCents: number | null; priceStatus: string; stockStatus: string; productUrl: string; imageUrl: string | null };
  deliveries: Array<{ id: string; channelName: string; provider: string; status: string; sentAt: string | null; errorSummary: string | null; retryCount: number }>;
  audits: Array<{ id: string; action: string; summary: string; createdAt: string }>;
}

export type PurchaseDecisionStatus = "NEW" | "OPENED" | "BOUGHT" | "SKIPPED" | "SNOOZED" | "SOLD_OUT" | "TOO_EXPENSIVE" | "NOT_INTERESTED" | "NEEDS_MAPPING";
export type PurchaseSkipReason = "PRICE_TOO_HIGH" | "SOLD_OUT" | "NOT_INTERESTED" | "WRONG_PRODUCT" | "ALREADY_BOUGHT" | "NEEDS_REVIEW" | "OTHER";
export type WishlistPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT" | "IGNORE";
export type WishlistAlertBehavior = "ALERT_IMMEDIATELY" | "DASHBOARD_ONLY" | "DO_NOT_ALERT" | "REVIEW_FIRST";

export interface WishlistItem {
  id: string;
  name: string;
  setName?: string | null;
  categoryId?: string | null;
  categoryLabel?: string | null;
  categoryKind?: string | null;
  storeKey?: string | null;
  priority: WishlistPriority;
  alertBehavior: WishlistAlertBehavior;
  desiredQuantity?: number | null;
  maxPriceCents?: number | null;
  allowedMarkupCents?: number | null;
  keywords: string[];
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistMatch {
  priority: WishlistPriority;
  alertBehavior: WishlistAlertBehavior;
  matchedItemId: string | null;
  matchedItemName: string | null;
  matchedSetName: string | null;
  desiredQuantity: number | null;
  maxPriceCents: number | null;
  allowedMarkupCents: number | null;
  ignored: boolean;
  dashboardOnly: boolean;
  shouldAlert: boolean;
  matchReasons: string[];
  matches: Array<WishlistItem & { matchReasons: string[]; score: number }>;
}

export type StoreSafetyMode = "OFFICIAL_API_CANDIDATE" | "MANUAL_OPEN_ONLY" | "RESEARCH_PENDING" | "MOCK_ONLY" | "BLOCKED_FOR_AUTOMATION";
export type StoreRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export interface StoreSafetyMatrixItem {
  storeKey: string;
  displayName: string;
  status: string;
  officialApiFound: boolean | null;
  apiAccessNotes: string;
  supportsProductSearch: boolean | null;
  supportsProductLookup: boolean | null;
  supportsPrice: boolean | null;
  supportsAvailability: boolean | null;
  supportsSellerFiltering: boolean | null;
  recommendedMode: StoreSafetyMode;
  riskLevel: StoreRiskLevel;
  safetyNotes: string[];
  termsConcerns: string[];
  blockedCapabilities: string[];
  nextSafeStep: string;
}

export type ManualStoreLinkType = "PRODUCT" | "SEARCH" | "CATEGORY" | "RELEASE_PAGE" | "STORE_HOME" | "CUSTOM";
export type ReleaseCalendarStatus = "PLANNED" | "UPCOMING" | "RELEASED" | "WATCHING" | "BOUGHT" | "SKIPPED" | "CANCELED";
export type ReleaseReminderOffset = "SEVEN_DAYS" | "THREE_DAYS" | "ONE_DAY" | "TWELVE_HOURS" | "ONE_HOUR" | "AT_RELEASE";

export interface ManualStoreLink {
  id: string;
  storeKey: string;
  storeDisplayName: string;
  title: string;
  url: string;
  linkType: ManualStoreLinkType;
  priority: WishlistPriority;
  wishlistItemId?: string | null;
  wishlistItemName?: string | null;
  setName?: string | null;
  categoryId?: string | null;
  categoryLabel?: string | null;
  notes?: string | null;
  isActive: boolean;
  lastOpenedAt?: string | null;
  openCount: number;
  safetyMode: StoreSafetyMode;
  riskLevel: StoreRiskLevel;
  warningMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseCalendarItem {
  id: string;
  title: string;
  setName?: string | null;
  productName?: string | null;
  categoryId?: string | null;
  categoryLabel?: string | null;
  releaseDate: string;
  timezone?: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: ReleaseCalendarStatus;
  wishlistItemId?: string | null;
  wishlistItemName?: string | null;
  notes?: string | null;
  isActive: boolean;
  discordReminder: boolean;
  reminderOffsets: ReleaseReminderOffset[];
  reminderOffsetLabels: string[];
  nextReminderAt?: string | null;
  manualStoreLinks: ManualStoreLink[];
  createdAt: string;
  updatedAt: string;
}

export type TodayActionItemType = "RELEASE_TODAY" | "RELEASE_SOON" | "WISHLIST_PRIORITY" | "MANUAL_LINK_CHECK" | "MSRP_MAPPING_NEEDED" | "PURCHASE_DECISION_NEEDED" | "SNOOZE_EXPIRED" | "ALERT_REVIEW" | "BOUGHT_RECENTLY" | "SKIPPED_RECENTLY";
export type TodayActionStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "SNOOZED" | "DISMISSED";

export interface TodaySummary {
  urgentItems: number;
  releasesToday: number;
  upcomingReleasesThisWeek: number;
  manualLinksToCheck: number;
  needsMapping: number;
  decisionsNeeded: number;
  boughtThisWeek: number;
  skippedThisWeek: number;
}

export interface TodayActionItem {
  id: string;
  key: string;
  title: string;
  type: TodayActionItemType;
  priority: WishlistPriority;
  status: TodayActionStatus;
  source: string;
  productName?: string | null;
  storeName?: string | null;
  storeKey?: string | null;
  setName?: string | null;
  priceCents?: number | null;
  msrpCents?: number | null;
  acceptedMaxPriceCents?: number | null;
  wishlistItemId?: string | null;
  wishlistItemName?: string | null;
  releaseCalendarItemId?: string | null;
  manualStoreLinks: ManualStoreLink[];
  notificationId?: string | null;
  purchaseDecisionId?: string | null;
  stockCheckResultId?: string | null;
  msrpMappingId?: string | null;
  dueAt?: string | null;
  snoozedUntil?: string | null;
  reasons: string[];
  badges: string[];
  rank: number;
}

export interface AnalyticsData {
  summary: Record<string, number>;
  spending: {
    totalSpendCents: number;
    spendThisWeekCents: number;
    spendThisMonthCents: number;
    spendByStore: Array<{ label: string; amountCents: number }>;
    spendBySet: Array<{ label: string; amountCents: number }>;
    spendByCategory: Array<{ label: string; amountCents: number }>;
    averageItemPriceCents: number | null;
    highestPurchase: Record<string, unknown> | null;
    boughtVsSkippedRatio: string;
    missingFinalPrice: Array<Record<string, unknown>>;
  };
  purchaseHistory: Record<string, Array<Record<string, unknown>>>;
  wishlistProgress: Array<Record<string, unknown>>;
  releaseCoverage: Array<Record<string, unknown>>;
  manualLinkActivity: {
    mostOpened: Array<Record<string, unknown>>;
    recentlyOpened: Array<Record<string, unknown>>;
    neverOpened: Array<Record<string, unknown>>;
    byStore: Array<{ label: string; count: number }>;
    bySafetyMode: Array<{ label: string; count: number }>;
    byRiskLevel: Array<{ label: string; count: number }>;
    attachedToWishlist: number;
    attachedToReleaseCalendar: number;
  };
  alerts: Record<string, unknown> & { rows: Array<Record<string, unknown>> };
  msrpMapping: Record<string, unknown> & { rows: Array<Record<string, unknown>> };
}

export interface PurchaseDecisionSummary {
  id: string;
  stockCheckResultId: string;
  status: PurchaseDecisionStatus;
  skipReason?: PurchaseSkipReason | null;
  note?: string | null;
  quantity?: number | null;
  finalPriceCents?: number | null;
  snoozedUntil?: string | null;
  product?: {
    productUrl: string;
    source: string;
    alertDeliveryStatus: string;
  };
}

const defaultBestBuyScanConfig: BestBuyScanConfig = {
  enabled: true,
  scheduledScanEnabled: false,
  scanIntervalSeconds: 1800,
  searchTerms: ["pokemon cards", "pokemon tcg", "pokemon booster", "pokemon elite trainer box", "pokemon booster bundle", "pokemon collection box", "pokemon tin", "pokemon premium collection", "pokemon upc"],
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
  alertCooldownMinutes: 360
};

const defaultBestBuyScanState: BestBuyScanState = {
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

const defaultBestBuySchedulerState: BestBuySchedulerState = { status: "STOPPED", active: false };

const fallbackStores: DemoStore[] = [
  { id: "store-target", name: "Target", slug: "target", baseUrl: "https://www.target.com", loginUrl: "https://www.target.com/login", cartUrl: "https://www.target.com/cart", sessionState: StoreSessionState.LOGGED_IN, monitoringEnabled: true, cartAssistMode: CartAssistMode.OPEN_ONLY, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "Category rules", defaultToleranceCents: 500, lastCheckTime: new Date().toISOString() },
  { id: "store-best-buy", name: "Best Buy", slug: "best-buy", baseUrl: "https://www.bestbuy.com", loginUrl: "https://www.bestbuy.com/identity/signin", cartUrl: "https://www.bestbuy.com/cart", sessionState: StoreSessionState.LOGGED_IN, monitoringEnabled: true, cartAssistMode: CartAssistMode.OPEN_ONLY, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "MSRP + $5", defaultToleranceCents: 500, lastCheckTime: new Date().toISOString() },
  { id: "store-pokemon-center", name: "Pokemon Center", slug: "pokemon-center", baseUrl: "https://www.pokemoncenter.com", loginUrl: "https://www.pokemoncenter.com/login", cartUrl: "https://www.pokemoncenter.com/cart", sessionState: StoreSessionState.QUEUE_OR_WAITING_ROOM, monitoringEnabled: true, cartAssistMode: CartAssistMode.OPEN_ONLY, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "PC ETB custom", defaultToleranceCents: 1000, lastCheckTime: new Date().toISOString(), lastError: "Queue detected. Helper stopped." }
];

export const useRadarStore = defineStore("radar", {
  state: () => ({
    loading: false,
    error: "",
    authChecked: false,
    currentUser: null as null | { id: string; email: string; displayName: string | null },
    stores: fallbackStores as DemoStore[],
    radarRules: {
      monitorAllSealed: true,
      selectedCategories: Object.values(ProductCategoryKind),
      monitorNewReleases: true,
      ignoreSingles: true,
      ignoreThirdPartySellers: true,
      shippingPreferred: true,
      pickupPreferred: true,
      pickupZip: "19019",
      pickupRadiusMiles: 25,
      quantityWantedPerProduct: 1,
      maxQuantityPerStoreProduct: 1
    } as DemoRadarRules,
    priceRules: [] as DemoPriceRule[],
    finds: [] as DemoLiveFind[],
    cartQueue: [] as DemoCartAttempt[],
    alertChannels: [] as DemoAlertChannel[],
    history: [] as DemoHistoryEvent[],
    auditLogs: [] as DemoAuditLog[],
    adapters: [] as AdapterStatus[],
    adapterResults: [] as AdapterProduct[],
    adapterLastMessage: "",
    adapterLookupSku: "",
    adapterQuery: "pokemon tcg",
    safeBotStatus: { connected: false, status: "UNAVAILABLE" } as SafeBotStatus,
    bestBuyScanConfig: { ...defaultBestBuyScanConfig } as BestBuyScanConfig,
    bestBuyScanStatus: { ...defaultBestBuyScanState } as BestBuyScanState,
    bestBuySchedulerState: { ...defaultBestBuySchedulerState } as BestBuySchedulerState,
    bestBuyManualReadiness: { status: "CONFIGURATION_NEEDED", ready: false, configured: false, schedulerStopped: true, redisReady: false, alertChannelReady: false, checkedAt: "", reasons: ["Run readiness check."], warnings: [] } as BestBuyManualReadiness,
    bestBuySearchTermsText: defaultBestBuyScanConfig.searchTerms.join("\n"),
    msrpMappings: [] as MSRPMapping[],
    msrpCategories: [] as MSRPMappingCategory[],
    msrpMappingFilter: "UNMAPPED" as "ALL" | MSRPMappingStatus,
    msrpCategorySelections: {} as Record<string, string>,
    discordOAuthStatus: {
      configured: false,
      connected: false,
      guildId: null,
      guildName: null,
      channelId: null,
      channelName: null,
      webhookName: null,
      maskedConfig: "Not configured",
      lastTestStatus: null,
      lastTestAt: null,
      lastError: null
    } as DiscordOAuthStatus,
    notifications: [] as NotificationSummary[],
    selectedNotification: null as NotificationDetail | null,
    wishlistItems: [] as WishlistItem[],
    wishlistMatchPreview: null as WishlistMatch | null,
    storeSafetyMatrix: [] as StoreSafetyMatrixItem[],
    selectedStoreSafety: null as StoreSafetyMatrixItem | null,
    manualStoreLinks: [] as ManualStoreLink[],
    releaseCalendarItems: [] as ReleaseCalendarItem[],
    todayItems: [] as TodayActionItem[],
    todayCompletedItems: [] as TodayActionItem[],
    todaySummary: {
      urgentItems: 0,
      releasesToday: 0,
      upcomingReleasesThisWeek: 0,
      manualLinksToCheck: 0,
      needsMapping: 0,
      decisionsNeeded: 0,
      boughtThisWeek: 0,
      skippedThisWeek: 0
    } as TodaySummary,
    analytics: null as AnalyticsData | null,
    analyticsPeriod: "ALL_TIME" as "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" | "ALL_TIME",
    analyticsMockMode: "REAL_ONLY" as "REAL_ONLY",
    notificationFilter: "ALL",
    alertTemplateSettings: { compactMobileAlerts: true, includeProductImage: true, includeMsrpDetails: true, includeOpenProductLink: true } as AlertTemplateSettings,
    alertPreview: "",
    alertPreviewType: "MSRP_MATCH_FOUND" as AlertTemplateType,
    alertPreviewStockId: "",
    alertPreviewChannelId: ""
  }),
  getters: {
    activeMonitors: (state) => state.stores.filter((store) => store.monitoringEnabled).length,
    connectedStores: (state) => state.stores.filter((store) => store.sessionState === StoreSessionState.LOGGED_IN).length,
    cartReadyItems: (state) => state.cartQueue.filter((attempt) => attempt.status === CartAssistStatus.CART_READY).length,
    humanActionNeeded: (state) => state.cartQueue.filter((attempt) => [CartAssistStatus.HUMAN_CHECK_REQUIRED, CartAssistStatus.QUEUE_DETECTED, CartAssistStatus.CAPTCHA_DETECTED].includes(attempt.status)).length,
    overpricedSkipped: (state) => state.finds.filter((find) => find.priceStatus === PriceStatus.OVER_LIMIT).length,
    recentAlerts: (state) => state.finds.filter((find) => [AlertStatus.SENT, AlertStatus.READY].includes(find.alertStatus)).slice(0, 5),
    formatPrice: () => (cents?: number | null) => cents == null ? "Unknown" : formatCents(cents),
    formatTime: () => (value?: string | null) => {
      if (!value || value === "-") return "Never";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Never";
      return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(date);
    }
  },
  actions: {
    async checkAuth() {
      try {
        const response = await api<{ user: { id: string; email: string; displayName: string | null } | null }>("/auth/me");
        this.currentUser = response.user;
      } catch {
        this.currentUser = null;
      } finally {
        this.authChecked = true;
      }
      return this.currentUser;
    },
    async login(email: string, password: string) {
      const response = await api<{ user: { id: string; email: string; displayName: string | null } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      this.currentUser = response.user;
      this.authChecked = true;
      await this.loadAll();
      return response.user;
    },
    async logout() {
      await api("/auth/logout", { method: "POST", body: "{}" }).catch(() => undefined);
      this.currentUser = null;
      this.stores = fallbackStores;
      this.finds = [];
      this.cartQueue = [];
      this.priceRules = [];
      this.alertChannels = [];
      this.history = [];
      this.auditLogs = [];
    },
    async changePassword(newPassword: string) {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ newPassword })
      });
      await this.loadAuditLogs();
    },
    statusTone(status: string): "green" | "blue" | "gold" | "red" | "slate" {
      if (["LOGGED_IN", "IN_STOCK", "CART_READY", "ACCEPTED", "MSRP_MATCH", "SENT", "READY", "READY_FOR_MANUAL_SCAN", "SUCCEEDED", "MAPPED", "BOUGHT"].includes(status)) return "green";
      if (["PRICE_ACCEPTED", "PRODUCT_FOUND", "ACCEPTED_MARKUP", "PREORDER", "OPEN_ONLY", "RUNNING", "SUGGESTED", "NORMAL", "DASHBOARD_ONLY", "OFFICIAL_API_CANDIDATE", "LOW"].includes(status)) return "blue";
      if (["LOGIN_REQUIRED", "LOGIN_EXPIRED", "UNKNOWN", "UNKNOWN_MSRP", "NOT_ATTEMPTED", "CONFIGURATION_NEEDED", "APPROVAL_PENDING", "COOLDOWN_ACTIVE", "SCAN_RUNNING", "CHANNEL_DISABLED", "SUPPRESSED", "PENDING", "WAITING", "STOPPED", "RATE_LIMITED", "DISABLED", "IDLE", "NEW", "OPENED", "SNOOZED", "SKIPPED", "UNMAPPED", "NEEDS_REVIEW", "NEEDS_MAPPING", "IGNORED", "RESEARCH_PENDING", "MANUAL_OPEN_ONLY", "MEDIUM", "HIGH", "URGENT", "REVIEW_FIRST", "ALREADY_BOUGHT", "WRONG_PRODUCT", "OTHER", "PLANNED", "UPCOMING", "WATCHING"].includes(status)) return "gold";
      if (["CAPTCHA_DETECTED", "QUEUE_DETECTED", "HUMAN_CHECK_REQUIRED", "SCHEDULER_MUST_BE_STOPPED", "DEPENDENCY_UNAVAILABLE", "MUST_STOP", "OVER_LIMIT", "THIRD_PARTY_SKIPPED", "FAILED", "REDIS_UNAVAILABLE", "ERROR", "SOLD_OUT", "TOO_EXPENSIVE", "NOT_INTERESTED", "PRICE_TOO_HIGH", "PRICE_CHANGED"].includes(status)) return "red";
      if (["IGNORE", "DO_NOT_ALERT", "BLOCKED_FOR_AUTOMATION"].includes(status)) return "red";
      return "slate";
    },
    async loadAll() {
      this.loading = true;
      this.error = "";
      if (!this.currentUser) {
        this.loading = false;
        return;
      }
      try {
        const [storesRes, radarRulesRes, priceRulesRes, findsRes, cartQueueRes, alertsRes, historyRes, auditRes, adaptersRes, scanRes, mappingCategoriesRes, wishlistRes, safetyRes, manualLinksRes, releaseRes] = await Promise.all([
          api<{ stores: DemoStore[] }>("/stores"),
          api<{ radarRules: DemoRadarRules }>("/radar-rules"),
          api<{ priceRules: DemoPriceRule[] }>("/price-rules"),
          api<{ liveFinds: DemoLiveFind[] }>("/live-finds"),
          api<{ cartQueue: DemoCartAttempt[] }>("/cart-queue"),
          api<{ alertChannels: DemoAlertChannel[] }>("/alert-channels"),
          api<{ history: DemoHistoryEvent[] }>("/history"),
          api<{ auditLogs: DemoAuditLog[] }>("/audit-logs"),
          api<{ adapters: AdapterStatus[] }>("/adapters"),
          api<{ config: BestBuyScanConfig; scanStatus: BestBuyScanState; schedulerState: BestBuySchedulerState }>("/adapters/best-buy/scan-status"),
          api<{ categories: MSRPMappingCategory[] }>("/msrp-mappings/categories"),
          api<{ wishlistItems: WishlistItem[] }>("/wishlist"),
          api<{ stores: StoreSafetyMatrixItem[] }>("/store-safety-matrix"),
          api<{ manualStoreLinks: ManualStoreLink[] }>("/manual-store-links"),
          api<{ releaseCalendarItems: ReleaseCalendarItem[] }>("/release-calendar")
        ]);
        this.stores = storesRes.stores;
        this.radarRules = radarRulesRes.radarRules;
        this.priceRules = priceRulesRes.priceRules;
        this.finds = findsRes.liveFinds;
        this.cartQueue = cartQueueRes.cartQueue;
        this.alertChannels = alertsRes.alertChannels;
        this.history = historyRes.history;
        this.auditLogs = auditRes.auditLogs;
        this.adapters = adaptersRes.adapters;
        this.setBestBuyScan(scanRes.config, scanRes.scanStatus);
        this.bestBuySchedulerState = scanRes.schedulerState;
        this.msrpCategories = mappingCategoriesRes.categories;
        this.wishlistItems = wishlistRes.wishlistItems;
        this.storeSafetyMatrix = safetyRes.stores;
        this.manualStoreLinks = manualLinksRes.manualStoreLinks;
        this.releaseCalendarItems = releaseRes.releaseCalendarItems;
      } catch (error) {
        this.error = `Using local fallback because the API did not respond: ${String(error)}`;
      } finally {
        this.loading = false;
      }
    },
    async patchStore(id: string, patch: Partial<DemoStore>) {
      const response = await api<{ store: DemoStore }>(`/stores/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      this.stores = this.stores.map((store) => store.id === id ? response.store : store);
      await this.loadAuditLogs();
    },
    async saveRadarRules() {
      const response = await api<{ radarRules: DemoRadarRules }>("/radar-rules", { method: "PUT", body: JSON.stringify(this.radarRules) });
      this.radarRules = response.radarRules;
      await this.loadAuditLogs();
    },
    async createPriceRule(rule: Omit<DemoPriceRule, "id">) {
      const response = await api<{ priceRule: DemoPriceRule }>("/price-rules", { method: "POST", body: JSON.stringify(rule) });
      this.priceRules.unshift(response.priceRule);
      await this.loadAuditLogs();
    },
    async patchPriceRule(id: string, patch: Partial<DemoPriceRule>) {
      const response = await api<{ priceRule: DemoPriceRule }>(`/price-rules/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      this.priceRules = this.priceRules.map((rule) => rule.id === id ? response.priceRule : rule);
      await this.loadAuditLogs();
    },
    async liveFindAction(id: string, action: "ignore" | "mark-bought" | "snooze") {
      const response = await api<{ liveFind: DemoLiveFind }>(`/live-finds/${id}/${action}`, { method: "POST", body: "{}" });
      this.finds = this.finds.map((find) => find.id === id ? response.liveFind : find);
      await this.loadAuditLogs();
    },
    async markFindOpened(find: { id: string }) {
      await apiWithBody<{ purchaseDecision?: PurchaseDecisionSummary; error?: string }>(`/live-finds/${find.id}/opened`, { method: "POST", body: "{}" });
      await this.loadAuditLogs();
    },
    async markFindBought(id: string, input: { quantity?: number | null; finalPriceCents?: number | null; note?: string | null }) {
      const response = await apiWithBody<{ liveFind?: DemoLiveFind; purchaseDecision?: PurchaseDecisionSummary; error?: string }>(`/live-finds/${id}/mark-bought`, { method: "POST", body: JSON.stringify(input) });
      if (!response.ok) throw new Error(response.body.error ?? "Could not mark product bought.");
      if (response.body.liveFind) this.finds = this.finds.map((find) => find.id === id ? response.body.liveFind! : find);
      await Promise.all([this.loadNotifications(), this.loadAuditLogs()]);
      return response.body.purchaseDecision;
    },
    async markFindSkipped(id: string, input: { skipReason: PurchaseSkipReason; note?: string | null }) {
      const response = await apiWithBody<{ purchaseDecision?: PurchaseDecisionSummary; error?: string }>(`/live-finds/${id}/mark-skipped`, { method: "POST", body: JSON.stringify(input) });
      if (!response.ok) throw new Error(response.body.error ?? "Could not mark product skipped.");
      await Promise.all([this.loadAll(), this.loadNotifications(), this.loadAuditLogs()]);
      return response.body.purchaseDecision;
    },
    async snoozeFind(id: string, input: { preset: "ONE_HOUR" | "SIX_HOURS" | "TWENTY_FOUR_HOURS" | "SEVEN_DAYS" | "CUSTOM"; snoozedUntil?: string; note?: string | null }) {
      const response = await apiWithBody<{ liveFind?: DemoLiveFind; purchaseDecision?: PurchaseDecisionSummary; error?: string }>(`/live-finds/${id}/snooze`, { method: "POST", body: JSON.stringify(input) });
      if (!response.ok) throw new Error(response.body.error ?? "Could not snooze product.");
      if (response.body.liveFind) this.finds = this.finds.map((find) => find.id === id ? response.body.liveFind! : find);
      await Promise.all([this.loadNotifications(), this.loadAuditLogs()]);
      return response.body.purchaseDecision;
    },
    async unsnoozeFind(id: string) {
      const response = await apiWithBody<{ purchaseDecision?: PurchaseDecisionSummary; error?: string }>(`/live-finds/${id}/unsnooze`, { method: "POST", body: "{}" });
      if (!response.ok) throw new Error(response.body.error ?? "Could not unsnooze product.");
      await Promise.all([this.loadAll(), this.loadNotifications(), this.loadAuditLogs()]);
      return response.body.purchaseDecision;
    },
    async updateFindNote(id: string, note: string | null) {
      const response = await apiWithBody<{ purchaseDecision?: PurchaseDecisionSummary; error?: string }>(`/live-finds/${id}/note`, { method: "PATCH", body: JSON.stringify({ note }) });
      if (!response.ok) throw new Error(response.body.error ?? "Could not save note.");
      await Promise.all([this.loadAll(), this.loadNotifications(), this.loadAuditLogs()]);
      return response.body.purchaseDecision;
    },
    async cartAction(id: string, action: "retry" | "stop") {
      try {
        const response = await api<{ cartAttempt: DemoCartAttempt }>(`/cart-queue/${id}/${action}`, { method: "POST", body: "{}" });
        this.cartQueue = this.cartQueue.map((attempt) => attempt.id === id ? response.cartAttempt : attempt);
      } catch (error) {
        this.error = String(error);
      }
      await this.loadAuditLogs();
    },
    async loadAlertChannels() {
      const response = await api<{ alertChannels: DemoAlertChannel[] }>("/alert-channels");
      this.alertChannels = response.alertChannels;
    },
    async loadNotifications(filter?: string) {
      const effectiveFilter = filter ?? this.notificationFilter;
      this.notificationFilter = effectiveFilter;
      const query = effectiveFilter === "ALL" ? "" : effectiveFilter === "DISCORD" || effectiveFilter === "TELEGRAM" ? `?provider=${effectiveFilter}` : effectiveFilter === "HIGH_URGENT" ? "?priority=HIGH_URGENT" : effectiveFilter === "TODAY" || effectiveFilter === "LAST_7_DAYS" ? `?period=${effectiveFilter}` : `?status=${effectiveFilter}`;
      const response = await api<{ notifications: NotificationSummary[] }>(`/notifications${query}`);
      this.notifications = response.notifications;
    },
    async loadNotificationDetail(id: string) {
      const response = await api<{ notification: NotificationDetail }>(`/notifications/${id}`);
      this.selectedNotification = response.notification;
      return response.notification;
    },
    closeNotificationDetail() {
      this.selectedNotification = null;
    },
    async loadAlertSettings() {
      const response = await api<{ settings: AlertTemplateSettings }>("/alert-settings");
      this.alertTemplateSettings = response.settings;
    },
    async saveAlertSettings() {
      const response = await api<{ settings: AlertTemplateSettings }>("/alert-settings", { method: "PUT", body: JSON.stringify(this.alertTemplateSettings) });
      this.alertTemplateSettings = response.settings;
      await this.loadAuditLogs();
    },
    async previewAlert() {
      const response = await api<{ preview: { text: string } }>("/alerts/preview", { method: "POST", body: JSON.stringify({ templateType: this.alertPreviewType, stockCheckResultId: this.alertPreviewStockId || undefined }) });
      this.alertPreview = response.preview.text;
      await this.loadAuditLogs();
    },
    async sendPreviewAlert() {
      const response = await apiWithBody<{ delivered?: boolean; error?: string }>("/alerts/preview/send", { method: "POST", body: JSON.stringify({ templateType: this.alertPreviewType, stockCheckResultId: this.alertPreviewStockId || undefined, channelId: this.alertPreviewChannelId || undefined }) });
      await Promise.all([this.loadNotifications(), this.loadAuditLogs()]);
      if (!response.ok) throw new Error(response.body.error ?? "Test alert failed safely.");
    },
    async loadDiscordStatus() {
      this.discordOAuthStatus = await api<DiscordOAuthStatus>("/discord/status");
      return this.discordOAuthStatus;
    },
    connectDiscord() {
      window.location.assign(`${apiBase}/discord/oauth/start`);
    },
    async testDiscordConnection() {
      const response = await apiWithBody<{ error?: string }>("/discord/test", { method: "POST", body: "{}" });
      await this.loadDiscordStatus();
      await this.loadAlertChannels();
      await this.loadAuditLogs();
      if (!response.ok) throw new Error(response.body.error ?? "Discord test failed safely.");
    },
    async disconnectDiscord() {
      await api("/discord/disconnect", { method: "POST", body: "{}" });
      await this.loadDiscordStatus();
      await this.loadAlertChannels();
      await this.loadAuditLogs();
    },
    async createAlertChannel(input: { provider: "TELEGRAM"; name: string; enabled: boolean; botToken: string; chatId: string } | { provider: "DISCORD"; name: string; enabled: boolean; webhookUrl: string }) {
      await api("/alert-channels", { method: "POST", body: JSON.stringify(input) });
      await this.loadAlertChannels();
      await this.loadAuditLogs();
    },
    async setAlertChannelEnabled(channelId: string, enabled: boolean) {
      await api(`/alert-channels/${channelId}`, { method: "PATCH", body: JSON.stringify({ enabled }) });
      await this.loadAlertChannels();
      await this.loadAuditLogs();
    },
    async deleteAlertChannel(channelId: string) {
      await api(`/alert-channels/${channelId}`, { method: "DELETE" });
      await this.loadAlertChannels();
      await this.loadAuditLogs();
    },
    async testAlert(channelId: string) {
      const response = await apiWithBody<{ alertChannel?: DemoAlertChannel; error?: string }>(`/alert-channels/${channelId}/test`, { method: "POST", body: "{}" });
      await this.loadAlertChannels();
      await this.loadAuditLogs();
      if (!response.ok) throw new Error(response.body.error ?? "Test alert was not delivered. Check the sanitized status below.");
    },
    async loadAuditLogs() {
      const response = await api<{ auditLogs: DemoAuditLog[] }>("/audit-logs");
      this.auditLogs = response.auditLogs;
    },
    async loadWishlist() {
      const response = await api<{ wishlistItems: WishlistItem[] }>("/wishlist");
      this.wishlistItems = response.wishlistItems;
    },
    async loadStoreSafetyMatrix() {
      const response = await api<{ stores: StoreSafetyMatrixItem[] }>("/store-safety-matrix");
      this.storeSafetyMatrix = response.stores;
      return response.stores;
    },
    async loadStoreSafetyDetail(storeKey: string) {
      const response = await api<{ store: StoreSafetyMatrixItem }>(`/store-safety-matrix/${storeKey}`);
      this.selectedStoreSafety = response.store;
      return response.store;
    },
    closeStoreSafetyDetail() {
      this.selectedStoreSafety = null;
    },
    async loadManualStoreLinks() {
      const response = await api<{ manualStoreLinks: ManualStoreLink[] }>("/manual-store-links");
      this.manualStoreLinks = response.manualStoreLinks;
      return response.manualStoreLinks;
    },
    async createManualStoreLink(input: Omit<ManualStoreLink, "id" | "storeDisplayName" | "wishlistItemName" | "categoryLabel" | "safetyMode" | "riskLevel" | "warningMessage" | "lastOpenedAt" | "openCount" | "createdAt" | "updatedAt">) {
      const response = await api<{ manualStoreLink: ManualStoreLink }>("/manual-store-links", { method: "POST", body: JSON.stringify(input) });
      this.manualStoreLinks.unshift(response.manualStoreLink);
      await this.loadAuditLogs();
      return response.manualStoreLink;
    },
    async updateManualStoreLink(id: string, patch: Partial<Omit<ManualStoreLink, "id" | "storeDisplayName" | "wishlistItemName" | "categoryLabel" | "safetyMode" | "riskLevel" | "warningMessage" | "lastOpenedAt" | "openCount" | "createdAt" | "updatedAt">>) {
      const response = await api<{ manualStoreLink: ManualStoreLink }>(`/manual-store-links/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      this.manualStoreLinks = this.manualStoreLinks.map((link) => link.id === id ? response.manualStoreLink : link);
      await this.loadAuditLogs();
      return response.manualStoreLink;
    },
    async deleteManualStoreLink(id: string) {
      await api<{ deleted: boolean }>(`/manual-store-links/${id}`, { method: "DELETE" });
      this.manualStoreLinks = this.manualStoreLinks.filter((link) => link.id !== id);
      await this.loadAuditLogs();
    },
    async setManualStoreLinkEnabled(id: string, enabled: boolean) {
      const response = await api<{ manualStoreLink: ManualStoreLink }>(`/manual-store-links/${id}/${enabled ? "enable" : "disable"}`, { method: "POST", body: "{}" });
      this.manualStoreLinks = this.manualStoreLinks.map((link) => link.id === id ? response.manualStoreLink : link);
      await this.loadAuditLogs();
      return response.manualStoreLink;
    },
    async openManualStoreLink(link: ManualStoreLink) {
      const response = await api<{ manualStoreLink: ManualStoreLink }>(`/manual-store-links/${link.id}/opened`, { method: "POST", body: "{}" });
      this.manualStoreLinks = this.manualStoreLinks.map((item) => item.id === link.id ? response.manualStoreLink : item);
      window.open(response.manualStoreLink.url, "_blank", "noopener,noreferrer");
      await this.loadAuditLogs();
      return response.manualStoreLink;
    },
    async loadReleaseCalendar() {
      const response = await api<{ releaseCalendarItems: ReleaseCalendarItem[] }>("/release-calendar");
      this.releaseCalendarItems = response.releaseCalendarItems;
      return response.releaseCalendarItems;
    },
    async createReleaseCalendarItem(input: Omit<ReleaseCalendarItem, "id" | "categoryLabel" | "wishlistItemName" | "reminderOffsetLabels" | "nextReminderAt" | "manualStoreLinks" | "createdAt" | "updatedAt"> & { manualStoreLinkIds: string[] }) {
      const response = await api<{ releaseCalendarItem: ReleaseCalendarItem }>("/release-calendar", { method: "POST", body: JSON.stringify(input) });
      this.releaseCalendarItems.unshift(response.releaseCalendarItem);
      await this.loadAuditLogs();
      return response.releaseCalendarItem;
    },
    async updateReleaseCalendarItem(id: string, patch: Partial<Omit<ReleaseCalendarItem, "id" | "categoryLabel" | "wishlistItemName" | "reminderOffsetLabels" | "nextReminderAt" | "manualStoreLinks" | "createdAt" | "updatedAt">> & { manualStoreLinkIds?: string[] }) {
      const response = await api<{ releaseCalendarItem: ReleaseCalendarItem }>(`/release-calendar/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      this.releaseCalendarItems = this.releaseCalendarItems.map((item) => item.id === id ? response.releaseCalendarItem : item);
      await this.loadAuditLogs();
      return response.releaseCalendarItem;
    },
    async deleteReleaseCalendarItem(id: string) {
      await api<{ deleted: boolean }>(`/release-calendar/${id}`, { method: "DELETE" });
      this.releaseCalendarItems = this.releaseCalendarItems.filter((item) => item.id !== id);
      await this.loadAuditLogs();
    },
    async setReleaseCalendarItemEnabled(id: string, enabled: boolean) {
      const response = await api<{ releaseCalendarItem: ReleaseCalendarItem }>(`/release-calendar/${id}/${enabled ? "enable" : "disable"}`, { method: "POST", body: "{}" });
      this.releaseCalendarItems = this.releaseCalendarItems.map((item) => item.id === id ? response.releaseCalendarItem : item);
      await this.loadAuditLogs();
      return response.releaseCalendarItem;
    },
    async markReleaseCalendarItem(id: string, action: "released" | "bought" | "skipped") {
      const response = await api<{ releaseCalendarItem: ReleaseCalendarItem }>(`/release-calendar/${id}/mark-${action}`, { method: "POST", body: "{}" });
      this.releaseCalendarItems = this.releaseCalendarItems.map((item) => item.id === id ? response.releaseCalendarItem : item);
      await this.loadAuditLogs();
      return response.releaseCalendarItem;
    },
    async sendReleaseTestReminder(id: string) {
      const response = await apiWithBody<{ delivered?: boolean; error?: string }>(`/release-calendar/${id}/send-test-reminder`, { method: "POST", body: "{}" });
      await Promise.all([this.loadNotifications(), this.loadAuditLogs()]);
      if (!response.ok) throw new Error(response.body.error ?? "Test release reminder failed safely. Check channel status.");
      return response.body;
    },
    async openReleaseManualLink(releaseId: string, link: ManualStoreLink) {
      const response = await api<{ manualStoreLink: ManualStoreLink }>(`/release-calendar/${releaseId}/manual-links/${link.id}/opened`, { method: "POST", body: "{}" });
      this.manualStoreLinks = this.manualStoreLinks.map((item) => item.id === link.id ? response.manualStoreLink : item);
      this.releaseCalendarItems = this.releaseCalendarItems.map((item) => item.id === releaseId ? { ...item, manualStoreLinks: item.manualStoreLinks.map((manual) => manual.id === link.id ? response.manualStoreLink : manual) } : item);
      window.open(response.manualStoreLink.url, "_blank", "noopener,noreferrer");
      await this.loadAuditLogs();
      return response.manualStoreLink;
    },
    async loadToday() {
      const response = await api<{ items: TodayActionItem[]; completed: TodayActionItem[]; summary: TodaySummary }>("/today");
      this.todayItems = response.items;
      this.todayCompletedItems = response.completed;
      this.todaySummary = response.summary;
      return response;
    },
    async loadAnalytics() {
      const params = new URLSearchParams();
      params.set("period", this.analyticsPeriod);
      params.set("mockMode", this.analyticsMockMode);
      this.analytics = await api<AnalyticsData>(`/analytics?${params.toString()}`);
      return this.analytics;
    },
    exportAnalyticsCsv(kind: "bought" | "skipped") {
      window.open(`${apiBase}/analytics/export/${kind}.csv`, "_blank", "noopener,noreferrer");
    },
    async dismissTodayItem(item: TodayActionItem) {
      await api(`/today/items/${encodeURIComponent(item.key)}/dismiss`, { method: "POST", body: "{}" });
      await this.loadToday();
      await this.loadAuditLogs();
    },
    async snoozeTodayItem(item: TodayActionItem, preset: "ONE_HOUR" | "SIX_HOURS" | "TWENTY_FOUR_HOURS" | "SEVEN_DAYS" | "CUSTOM" = "TWENTY_FOUR_HOURS") {
      await api(`/today/items/${encodeURIComponent(item.key)}/snooze`, { method: "POST", body: JSON.stringify({ preset }) });
      await this.loadToday();
      await this.loadAuditLogs();
    },
    async markTodayItemDone(item: TodayActionItem) {
      await api(`/today/items/${encodeURIComponent(item.key)}/mark-done`, { method: "POST", body: "{}" });
      await this.loadToday();
      await this.loadAuditLogs();
    },
    async openTodayManualLink(link: ManualStoreLink) {
      const response = await api<{ manualStoreLink: ManualStoreLink }>(`/today/manual-links/${link.id}/opened`, { method: "POST", body: "{}" });
      this.manualStoreLinks = this.manualStoreLinks.map((item) => item.id === link.id ? response.manualStoreLink : item);
      this.todayItems = this.todayItems.map((item) => ({ ...item, manualStoreLinks: item.manualStoreLinks.map((manual) => manual.id === link.id ? response.manualStoreLink : manual) }));
      window.open(response.manualStoreLink.url, "_blank", "noopener,noreferrer");
      await Promise.all([this.loadToday(), this.loadAuditLogs()]);
      return response.manualStoreLink;
    },
    async createWishlistItem(input: Omit<WishlistItem, "id" | "categoryLabel" | "categoryKind" | "createdAt" | "updatedAt">) {
      const response = await api<{ wishlistItem: WishlistItem }>("/wishlist", { method: "POST", body: JSON.stringify(input) });
      this.wishlistItems.unshift(response.wishlistItem);
      await this.loadAuditLogs();
      return response.wishlistItem;
    },
    async updateWishlistItem(id: string, patch: Partial<Omit<WishlistItem, "id" | "categoryLabel" | "categoryKind" | "createdAt" | "updatedAt">>) {
      const response = await api<{ wishlistItem: WishlistItem }>(`/wishlist/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      this.wishlistItems = this.wishlistItems.map((item) => item.id === id ? response.wishlistItem : item);
      await this.loadAuditLogs();
      return response.wishlistItem;
    },
    async deleteWishlistItem(id: string) {
      await api<{ deleted: boolean }>(`/wishlist/${id}`, { method: "DELETE" });
      this.wishlistItems = this.wishlistItems.filter((item) => item.id !== id);
      await this.loadAuditLogs();
    },
    async setWishlistItemEnabled(id: string, enabled: boolean) {
      const response = await api<{ wishlistItem: WishlistItem }>(`/wishlist/${id}/${enabled ? "enable" : "disable"}`, { method: "POST", body: "{}" });
      this.wishlistItems = this.wishlistItems.map((item) => item.id === id ? response.wishlistItem : item);
      await this.loadAuditLogs();
      return response.wishlistItem;
    },
    async previewWishlistMatch(input: { productName: string; setName?: string | null; categoryId?: string | null; categoryLabel?: string | null; storeKey?: string | null; sku?: string | null }) {
      const response = await api<{ match: WishlistMatch }>("/wishlist/match-preview", { method: "POST", body: JSON.stringify(input) });
      this.wishlistMatchPreview = response.match;
      await this.loadAuditLogs();
      return response.match;
    },
    async loadAdapters() {
      const response = await api<{ adapters: AdapterStatus[] }>("/adapters");
      this.adapters = response.adapters;
    },
    async loadSafeBotStatus() {
      const response = await apiWithBody<{ connected: boolean; result?: { status: string }; error?: string }>("/bot/status");
      this.safeBotStatus = {
        connected: response.ok && response.body.connected,
        status: response.body.result?.status ?? "UNAVAILABLE",
        message: response.body.error
      };
      return this.safeBotStatus;
    },
    async loadBestBuyScan() {
      const response = await api<{ config: BestBuyScanConfig; scanStatus: BestBuyScanState; schedulerState: BestBuySchedulerState }>("/adapters/best-buy/scan-status");
      this.setBestBuyScan(response.config, response.scanStatus);
      this.bestBuySchedulerState = response.schedulerState;
    },
    async checkBestBuyManualReadiness(issueToken = false) {
      const response = await api<{ readiness: BestBuyManualReadiness }>("/adapters/best-buy/manual-readiness", { method: issueToken ? "POST" : "GET", ...(issueToken ? { body: "{}" } : {}) });
      this.bestBuyManualReadiness = response.readiness;
      return response.readiness;
    },
    async saveBestBuyScanConfig() {
      const cleanTerms = this.bestBuySearchTermsText.split("\n").map((term) => term.trim()).filter(Boolean);
      const response = await api<{ config: BestBuyScanConfig; scanStatus: BestBuyScanState }>("/adapters/best-buy/scan-config", {
        method: "PUT",
        body: JSON.stringify({ ...this.bestBuyScanConfig, searchTerms: cleanTerms })
      });
      this.setBestBuyScan(response.config, response.scanStatus);
      await this.loadAuditLogs();
    },
    async setBestBuyScanEnabled(enabled: boolean) {
      const response = await api<{ config: BestBuyScanConfig; scanStatus: BestBuyScanState }>(`/adapters/best-buy/${enabled ? "enable-scan" : "disable-scan"}`, {
        method: "POST",
        body: "{}"
      });
      this.setBestBuyScan(response.config, response.scanStatus);
      await this.loadAuditLogs();
    },
    async setBestBuySchedulerEnabled(enabled: boolean) {
      const response = await apiWithBody<{ config: BestBuyScanConfig; scanStatus: BestBuyScanState; schedulerState: BestBuySchedulerState; error?: string }>(`/adapters/best-buy/${enabled ? "enable-scheduler" : "disable-scheduler"}`, { method: "POST", body: "{}" });
      this.setBestBuyScan(response.body.config, response.body.scanStatus);
      this.bestBuySchedulerState = response.body.schedulerState;
      if (response.body.error) this.adapterLastMessage = response.body.error;
      await this.loadAuditLogs();
    },
    async testBestBuySearch() {
      this.adapterLastMessage = "";
      const response = await apiWithBody<{ adapter: AdapterStatus; results: AdapterProduct[]; error?: string }>("/adapters/best-buy/search", {
        method: "POST",
        body: JSON.stringify({ query: this.adapterQuery || "pokemon tcg", limit: 10 })
      });
      this.upsertAdapter(response.body.adapter);
      this.adapterResults = response.body.results ?? [];
      this.adapterLastMessage = response.body.error ?? `Best Buy test search returned ${this.adapterResults.length} product${this.adapterResults.length === 1 ? "" : "s"}.`;
      await this.loadAuditLogs();
      if (!response.ok && response.status !== 409) {
        throw new Error(response.body.error ?? `Adapter search failed with ${response.status}`);
      }
    },
    async testBestBuyLookup() {
      this.adapterLastMessage = "";
      const response = await apiWithBody<{ adapter: AdapterStatus; result: AdapterProduct | null; error?: string }>("/adapters/best-buy/lookup", {
        method: "POST",
        body: JSON.stringify({ sku: this.adapterLookupSku })
      });
      this.upsertAdapter(response.body.adapter);
      this.adapterResults = response.body.result ? [response.body.result] : [];
      this.adapterLastMessage = response.body.error ?? (response.body.result ? "Best Buy SKU lookup returned one product." : "No Best Buy product found for that SKU.");
      await this.loadAuditLogs();
      if (!response.ok && response.status !== 409) {
        throw new Error(response.body.error ?? `Adapter lookup failed with ${response.status}`);
      }
    },
    async runBestBuyScanNow(confirmationText?: string, approvalConfirmed = false) {
      if (!this.bestBuyManualReadiness.readinessToken || confirmationText !== "RUN ONE READ-ONLY SCAN" || !approvalConfirmed) {
        throw new Error("Run readiness check and complete the read-only confirmation first.");
      }
      this.adapterLastMessage = "";
      const response = await apiWithBody<{ adapter: AdapterStatus; config: BestBuyScanConfig; scanStatus: BestBuyScanState; results: AdapterProduct[]; liveFinds: DemoLiveFind[]; error?: string }>("/adapters/best-buy/run-scan", {
        method: "POST",
        body: JSON.stringify({ readinessToken: this.bestBuyManualReadiness.readinessToken, confirmReadOnly: true, approvalConfirmed: true, confirmationText })
      });
      this.upsertAdapter(response.body.adapter);
      if (response.body.config && response.body.scanStatus) {
        this.setBestBuyScan(response.body.config, response.body.scanStatus);
      }
      this.adapterResults = response.body.results ?? [];
      if (response.body.liveFinds?.length) {
        this.finds = response.body.liveFinds;
      }
      this.adapterLastMessage = response.body.error ?? `Best Buy scan found ${this.adapterResults.length} read-only candidate${this.adapterResults.length === 1 ? "" : "s"} and created ${this.bestBuyScanStatus.lastAlertCount} alert event${this.bestBuyScanStatus.lastAlertCount === 1 ? "" : "s"}.`;
      await this.loadAuditLogs();
      await this.checkBestBuyManualReadiness(false);
      if (!response.ok && ![409, 429].includes(response.status)) {
        throw new Error(response.body.error ?? `Best Buy scan failed with ${response.status}`);
      }
    },
    async runBestBuyTestScan() {
      throw new Error("Use Scan Settings readiness and confirmation for a manual scan.");
    },
    async loadMSRPMappings(status?: "ALL" | MSRPMappingStatus) {
      const effectiveStatus = status ?? this.msrpMappingFilter;
      const path = effectiveStatus && effectiveStatus !== "ALL" ? `/msrp-mappings?status=${effectiveStatus}` : "/msrp-mappings";
      const response = await api<{ mappings: MSRPMapping[] }>(path);
      this.msrpMappings = response.mappings;
      for (const mapping of response.mappings) {
        this.msrpCategorySelections[mapping.id] = mapping.mappedCategoryId ?? mapping.suggestedCategoryId ?? this.msrpCategorySelections[mapping.id] ?? "";
      }
    },
    async loadMSRPCategories() {
      const response = await api<{ categories: MSRPMappingCategory[] }>("/msrp-mappings/categories");
      this.msrpCategories = response.categories;
    },
    async suggestMSRPFromFind(find: DemoLiveFind) {
      const response = await api<{ mapping: MSRPMapping }>("/msrp-mappings/suggest", {
        method: "POST",
        body: JSON.stringify({
          storeKey: find.storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          retailerProductId: find.productId,
          productName: find.productName,
          productUrl: find.productUrl,
          imageUrl: find.imageColor,
          currentPriceCents: find.priceCents
        })
      });
      this.upsertMSRPMapping(response.mapping);
      await this.loadAuditLogs();
      return response.mapping;
    },
    async mapMSRP(mappingId: string, categoryId?: string) {
      const selected = categoryId ?? this.msrpCategorySelections[mappingId];
      if (!selected) {
        throw new Error("Select a category before mapping.");
      }
      const response = await api<{ mapping: MSRPMapping }>(`/msrp-mappings/${mappingId}/map`, {
        method: "POST",
        body: JSON.stringify({ categoryId: selected })
      });
      this.upsertMSRPMapping(response.mapping);
      await this.loadAll();
      return response.mapping;
    },
    async ignoreMSRP(mappingId: string) {
      const response = await api<{ mapping: MSRPMapping }>(`/msrp-mappings/${mappingId}/ignore`, { method: "POST", body: "{}" });
      this.upsertMSRPMapping(response.mapping);
      await this.loadAuditLogs();
    },
    async reviewMSRP(mappingId: string) {
      const response = await api<{ mapping: MSRPMapping }>(`/msrp-mappings/${mappingId}/needs-review`, { method: "POST", body: "{}" });
      this.upsertMSRPMapping(response.mapping);
      await this.loadAuditLogs();
    },
    upsertMSRPMapping(mapping: MSRPMapping) {
      const index = this.msrpMappings.findIndex((item) => item.id === mapping.id);
      if (index === -1) {
        this.msrpMappings.unshift(mapping);
      } else {
        this.msrpMappings[index] = mapping;
      }
      this.msrpCategorySelections[mapping.id] = mapping.mappedCategoryId ?? mapping.suggestedCategoryId ?? this.msrpCategorySelections[mapping.id] ?? "";
    },
    upsertAdapter(adapter?: AdapterStatus) {
      if (!adapter) {
        return;
      }
      const index = this.adapters.findIndex((item) => item.storeKey === adapter.storeKey);
      if (index === -1) {
        this.adapters.push(adapter);
      } else {
        this.adapters[index] = adapter;
      }
    },
    setBestBuyScan(config: BestBuyScanConfig, scanStatus: BestBuyScanState) {
      this.bestBuyScanConfig = config;
      this.bestBuyScanStatus = scanStatus;
      this.bestBuySearchTermsText = config.searchTerms.join("\n");
    }
  }
});
