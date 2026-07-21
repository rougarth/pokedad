export enum StoreSessionState {
  LOGGED_IN = "LOGGED_IN",
  NOT_LOGGED_IN = "NOT_LOGGED_IN",
  LOGIN_EXPIRED = "LOGIN_EXPIRED",
  HUMAN_CHECK_NEEDED = "HUMAN_CHECK_NEEDED",
  QUEUE_OR_WAITING_ROOM = "QUEUE_OR_WAITING_ROOM",
  QUEUE_DETECTED = "QUEUE_DETECTED",
  CAPTCHA_DETECTED = "CAPTCHA_DETECTED",
  UNKNOWN = "UNKNOWN"
}

export enum CartAssistStatus {
  NOT_ATTEMPTED = "NOT_ATTEMPTED",
  PRODUCT_FOUND = "PRODUCT_FOUND",
  PRICE_ACCEPTED = "PRICE_ACCEPTED",
  ADD_TO_CART_ATTEMPTED = "ADD_TO_CART_ATTEMPTED",
  CART_READY = "CART_READY",
  LOGIN_REQUIRED = "LOGIN_REQUIRED",
  HUMAN_CHECK_REQUIRED = "HUMAN_CHECK_REQUIRED",
  QUEUE_DETECTED = "QUEUE_DETECTED",
  CAPTCHA_DETECTED = "CAPTCHA_DETECTED",
  SOLD_OUT = "SOLD_OUT",
  PRICE_CHANGED = "PRICE_CHANGED",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED"
}

export enum ProductCategoryKind {
  ELITE_TRAINER_BOX = "ELITE_TRAINER_BOX",
  POKEMON_CENTER_ETB = "POKEMON_CENTER_ETB",
  BOOSTER_BUNDLE = "BOOSTER_BUNDLE",
  BOOSTER_BOX = "BOOSTER_BOX",
  COLLECTION_BOX = "COLLECTION_BOX",
  PREMIUM_COLLECTION = "PREMIUM_COLLECTION",
  ULTRA_PREMIUM_COLLECTION = "ULTRA_PREMIUM_COLLECTION",
  MINI_TIN = "MINI_TIN",
  TIN = "TIN",
  SLEEVED_BOOSTER = "SLEEVED_BOOSTER",
  NEW_RELEASE = "NEW_RELEASE"
}

export enum SellerPolicy {
  OFFICIAL_ONLY = "OFFICIAL_ONLY",
  APPROVED_SELLERS_ONLY = "APPROVED_SELLERS_ONLY",
  MANUAL_REVIEW = "MANUAL_REVIEW"
}

export enum StockStatus {
  IN_STOCK = "IN_STOCK",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  PREORDER = "PREORDER",
  BACKORDER = "BACKORDER",
  UNKNOWN = "UNKNOWN"
}

export enum PriceStatus {
  ACCEPTED = "ACCEPTED",
  MSRP_MATCH = "MSRP_MATCH",
  ACCEPTED_MARKUP = "ACCEPTED_MARKUP",
  OVER_LIMIT = "OVER_LIMIT",
  THIRD_PARTY_SKIPPED = "THIRD_PARTY_SKIPPED",
  UNKNOWN_MSRP = "UNKNOWN_MSRP"
}

export enum AlertStatus {
  NOT_SENT = "NOT_SENT",
  READY = "READY",
  SENT = "SENT",
  FAILED = "FAILED",
  SUPPRESSED = "SUPPRESSED"
}

export enum CartAssistMode {
  OPEN_ONLY = "OPEN_ONLY",
  LOCAL_HELPER_READY = "LOCAL_HELPER_READY",
  DISABLED = "DISABLED"
}

export enum SkipReason {
  NONE = "NONE",
  THIRD_PARTY_SELLER = "THIRD_PARTY_SELLER",
  MARKETPLACE_SCALPER = "MARKETPLACE_SCALPER",
  USED_OR_OPEN_BOX = "USED_OR_OPEN_BOX",
  SINGLES_OR_LOOSE_CARDS = "SINGLES_OR_LOOSE_CARDS",
  PRICE_ABOVE_MAX = "PRICE_ABOVE_MAX",
  SUSPICIOUS_LISTING = "SUSPICIOUS_LISTING",
  HUMAN_CHECK_REQUIRED = "HUMAN_CHECK_REQUIRED",
  QUEUE_DETECTED = "QUEUE_DETECTED",
  PURCHASE_LIMIT_MANUAL_DECISION = "PURCHASE_LIMIT_MANUAL_DECISION",
  STORE_DISABLED = "STORE_DISABLED"
}

export type PriceRuleScope = "GLOBAL" | "STORE" | "CATEGORY" | "PRODUCT";

export interface PriceEvaluationInput {
  priceCents: number;
  msrpCents?: number | null;
  customMaxPriceCents?: number | null;
  toleranceCents?: number | null;
  sellerAccepted?: boolean;
}

export interface PriceEvaluationResult {
  accepted: boolean;
  priceStatus: PriceStatus;
  acceptedMaxPriceCents: number | null;
  skipReason: SkipReason.NONE | SkipReason.PRICE_ABOVE_MAX | SkipReason.THIRD_PARTY_SELLER;
}

export function evaluateAcceptablePrice(input: PriceEvaluationInput): PriceEvaluationResult {
  if (input.sellerAccepted === false) {
    return {
      accepted: false,
      priceStatus: PriceStatus.THIRD_PARTY_SKIPPED,
      acceptedMaxPriceCents: null,
      skipReason: SkipReason.THIRD_PARTY_SELLER
    };
  }

  if (input.msrpCents == null) {
    return {
      accepted: false,
      priceStatus: PriceStatus.UNKNOWN_MSRP,
      acceptedMaxPriceCents: null,
      skipReason: SkipReason.NONE
    };
  }

  const acceptedMaxPriceCents = input.customMaxPriceCents ?? input.msrpCents + (input.toleranceCents ?? 0);
  const accepted = input.priceCents <= acceptedMaxPriceCents;
  const priceStatus = !accepted
    ? PriceStatus.OVER_LIMIT
    : input.priceCents === input.msrpCents
      ? PriceStatus.MSRP_MATCH
      : input.priceCents > input.msrpCents
        ? PriceStatus.ACCEPTED_MARKUP
        : PriceStatus.ACCEPTED;

  return {
    accepted,
    priceStatus,
    acceptedMaxPriceCents,
    skipReason: accepted ? SkipReason.NONE : SkipReason.PRICE_ABOVE_MAX
  };
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

export interface DemoStore {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  loginUrl: string;
  cartUrl: string;
  sessionState: StoreSessionState;
  monitoringEnabled: boolean;
  cartAssistMode: CartAssistMode;
  sellerPolicy: SellerPolicy;
  priceToleranceLabel: string;
  defaultToleranceCents: number;
  lastCheckTime: string;
  lastError?: string;
}

export interface DemoPriceRule {
  id: string;
  scope: PriceRuleScope;
  label: string;
  target: string;
  msrpCents?: number | null;
  allowedMarkupCents: number;
  maxAcceptedPriceCents?: number | null;
  storeSpecificToleranceCents?: number | null;
  categorySpecificToleranceCents?: number | null;
  productSpecificOverrideCents?: number | null;
  enabled: boolean;
}

export interface DemoProduct {
  id: string;
  name: string;
  category: ProductCategoryKind;
  imageColor: string;
  msrpCents?: number | null;
}

export interface DemoLiveFind {
  id: string;
  productId: string;
  productName: string;
  category: ProductCategoryKind;
  storeId: string;
  storeName: string;
  source?: string;
  seller: string;
  sellerAccepted: boolean;
  productUrl: string;
  cartUrl: string;
  imageColor: string;
  priceCents: number;
  msrpCents?: number | null;
  maxAcceptedPriceCents?: number | null;
  priceStatus: PriceStatus;
  stockStatus: StockStatus;
  shippingStatus: "Available" | "Unavailable" | "Unknown";
  pickupStatus: "Available" | "Unavailable" | "Unknown";
  cartAssistStatus: CartAssistStatus;
  alertStatus: AlertStatus;
  ignored: boolean;
  bought: boolean;
  snoozedUntil?: string;
  purchaseDecisionStatus?: string | null;
  purchaseSkipReason?: string | null;
  purchaseNote?: string | null;
  purchaseQuantity?: number | null;
  purchaseFinalPriceCents?: number | null;
  wishlistPriority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | "IGNORE" | null;
  wishlistAlertBehavior?: "ALERT_IMMEDIATELY" | "DASHBOARD_ONLY" | "DO_NOT_ALERT" | "REVIEW_FIRST" | null;
  wishlistItemId?: string | null;
  wishlistItemName?: string | null;
  wishlistSetName?: string | null;
  wishlistDesiredQuantity?: number | null;
  wishlistMaxPriceCents?: number | null;
  wishlistMatchReasons?: string[];
  foundAt: string;
}

export interface DemoCartAttempt {
  id: string;
  liveFindId: string;
  productName: string;
  storeName: string;
  status: CartAssistStatus;
  productUrl: string;
  cartUrl: string;
  requestedQuantity: number;
  stopReason?: string;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemoRadarRules {
  monitorAllSealed: boolean;
  selectedCategories: ProductCategoryKind[];
  monitorNewReleases: boolean;
  ignoreSingles: boolean;
  ignoreThirdPartySellers: boolean;
  shippingPreferred: boolean;
  pickupPreferred: boolean;
  pickupZip: string;
  pickupRadiusMiles: number;
  quantityWantedPerProduct: number;
  maxQuantityPerStoreProduct: number;
}

export interface DemoAlertChannel {
  id: string;
  provider?: "TELEGRAM" | "DISCORD" | "EMAIL" | "BROWSER";
  name?: string;
  type?: string;
  label?: string;
  enabled: boolean;
  configured?: boolean;
  maskedConfig?: string;
  destinationHint?: string;
  lastTestStatus?: string | null;
  lastTestAt?: string | null;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DemoHistoryEvent {
  id: string;
  productName: string;
  storeName: string;
  priceCents: number;
  msrpCents?: number | null;
  foundAt: string;
  soldOutAt?: string;
  alertSent: boolean;
  cartAssistWorked: boolean;
  bought: boolean;
  skipReason: SkipReason;
}

export interface DemoAuditLog {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
