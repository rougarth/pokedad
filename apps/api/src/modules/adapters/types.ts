import type { PriceStatus, StockStatus } from "@pokedad-radar/shared";

export type AdapterCapability =
  | "PRODUCT_SEARCH"
  | "PRODUCT_LOOKUP"
  | "PRICE_CHECK"
  | "AVAILABILITY_CHECK"
  | "OPEN_PRODUCT"
  | "OPEN_CART"
  | "CART_ASSIST_READINESS";

export type BlockedCapability =
  | "AUTO_CHECKOUT"
  | "PAYMENT_SUBMISSION"
  | "CAPTCHA_BYPASS"
  | "QUEUE_BYPASS"
  | "PURCHASE_LIMIT_BYPASS"
  | "UNAPPROVED_BUYING_AGENT"
  | "RETAILER_CREDENTIAL_STORAGE"
  | "RETAILER_COOKIE_STORAGE";

export type AdapterHealthStatus = "READY" | "CONFIGURATION_NEEDED" | "APPROVAL_PENDING" | "DISABLED" | "ERROR";

export type AvailabilityState =
  | "IN_STOCK"
  | "OUT_OF_STOCK"
  | "PREORDER"
  | "BACKORDER"
  | "UNKNOWN"
  | "HUMAN_CHECK_REQUIRED"
  | "QUEUE_DETECTED"
  | "CAPTCHA_DETECTED";

export interface AdapterStatus {
  storeKey: string;
  displayName: string;
  configured: boolean;
  configurationNeeded: boolean;
  status: AdapterHealthStatus;
  capabilities: AdapterCapability[];
  blockedCapabilities: BlockedCapability[];
  safetyNotes: string[];
  message?: string;
}

export interface ProductSearchQuery {
  query: string;
  limit?: number;
}

export interface ProductLookupInput {
  sku: string;
}

export interface AvailabilityCheckInput {
  sku: string;
}

export interface RetailerProductRef {
  sku?: string;
  externalId?: string;
  productUrl?: string;
}

export interface ProductSearchResult {
  storeKey: string;
  storeName: string;
  source: "BEST_BUY_API" | "BEST_BUY_MOCK_DEMO" | "DEMO";
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
  onlineAvailability: AvailabilityState;
  shippingAvailable?: boolean | null;
  pickupAvailable?: boolean | null;
  raw?: Record<string, unknown>;
}

export type ProductLookupResult = ProductSearchResult;

export interface AvailabilityResult {
  storeKey: string;
  sku: string;
  stockStatus: StockStatus;
  onlineAvailability: AvailabilityState;
  shippingAvailable?: boolean | null;
  pickupAvailable?: boolean | null;
  productUrl?: string;
  raw?: Record<string, unknown>;
}

export interface AdapterSearchResponse {
  adapter: AdapterStatus;
  results: ProductSearchResult[];
}
