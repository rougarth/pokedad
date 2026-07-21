import type {
  AdapterCapability,
  AdapterStatus,
  AvailabilityCheckInput,
  AvailabilityResult,
  BlockedCapability,
  ProductLookupInput,
  ProductLookupResult,
  ProductSearchQuery,
  ProductSearchResult,
  RetailerProductRef
} from "./types.js";

export interface StoreAdapter {
  storeKey: string;
  displayName: string;
  capabilities: AdapterCapability[];
  blockedCapabilities: BlockedCapability[];
  safetyNotes: string[];
  getStatus(): AdapterStatus;
  searchProducts?(query: ProductSearchQuery): Promise<ProductSearchResult[]>;
  lookupProduct?(input: ProductLookupInput): Promise<ProductLookupResult | null>;
  checkAvailability?(input: AvailabilityCheckInput): Promise<AvailabilityResult>;
  getOpenProductUrl?(product: RetailerProductRef): string;
  getOpenCartUrl?(): string;
}
