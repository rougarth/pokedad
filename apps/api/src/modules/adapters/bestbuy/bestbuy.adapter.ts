import { StockStatus } from "@pokedad-radar/shared";
import type { AdapterCapability, AdapterStatus, AvailabilityCheckInput, AvailabilityResult, BlockedCapability, ProductLookupInput, ProductLookupResult, ProductSearchQuery, ProductSearchResult, RetailerProductRef } from "../types.js";
import type { StoreAdapter } from "../store-adapter.interface.js";
import { mapBestBuyAvailability, mapBestBuyProduct } from "./bestbuy.mapper.js";
import type { BestBuyProductsResponse } from "./bestbuy.types.js";

const BASE_URL = "https://api.bestbuy.com/v1";
const DEFAULT_FIELDS = [
  "sku",
  "name",
  "salePrice",
  "regularPrice",
  "onlineAvailability",
  "inStoreAvailability",
  "orderable",
  "url",
  "image",
  "thumbnailImage",
  "manufacturer",
  "type"
].join(",");

function sanitizeQuery(value: string): string {
  return value
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export class BestBuyAdapter implements StoreAdapter {
  readonly storeKey = "best-buy";
  readonly displayName = "Best Buy";
  readonly capabilities: AdapterCapability[] = ["PRODUCT_SEARCH", "PRODUCT_LOOKUP", "PRICE_CHECK", "AVAILABILITY_CHECK", "OPEN_PRODUCT", "OPEN_CART", "CART_ASSIST_READINESS"];
  readonly blockedCapabilities: BlockedCapability[] = ["AUTO_CHECKOUT", "PAYMENT_SUBMISSION", "CAPTCHA_BYPASS", "QUEUE_BYPASS", "PURCHASE_LIMIT_BYPASS", "UNAPPROVED_BUYING_AGENT", "RETAILER_CREDENTIAL_STORAGE", "RETAILER_COOKIE_STORAGE"];
  readonly safetyNotes = [
    "Uses Best Buy's official/public Products API only.",
    "Read-only product, price, and availability checks.",
    "Seller is treated as Best Buy official only.",
    "No add-to-cart, checkout, payment, queue bypass, CAPTCHA bypass, or credential/session storage."
  ];

  constructor(private readonly apiKey?: string) {}

  getStatus(): AdapterStatus {
    const configured = Boolean(this.apiKey);
    return {
      storeKey: this.storeKey,
      displayName: this.displayName,
      configured,
      configurationNeeded: !configured,
      status: configured ? "READY" : "APPROVAL_PENDING",
      capabilities: [...this.capabilities],
      blockedCapabilities: [...this.blockedCapabilities],
      safetyNotes: [...this.safetyNotes],
      message: configured
        ? "Best Buy API key is configured for official read-only checks."
        : "Best Buy API approval pending. Live scans are paused until BEST_BUY_API_KEY is configured."
    };
  }

  async searchProducts(query: ProductSearchQuery): Promise<ProductSearchResult[]> {
    this.assertConfigured();
    const safeQuery = sanitizeQuery(query.query || "pokemon tcg");
    const searchTerms = safeQuery || "pokemon tcg";
    const pageSize = Math.min(Math.max(query.limit ?? 10, 1), 20);
    const response = await this.fetchProducts(`(search=${encodeURIComponent(searchTerms)})`, pageSize);
    return response.products?.map(mapBestBuyProduct) ?? [];
  }

  async lookupProduct(input: ProductLookupInput): Promise<ProductLookupResult | null> {
    this.assertConfigured();
    const sku = input.sku.replace(/[^\w-]/g, "").slice(0, 40);
    if (!sku) {
      return null;
    }
    const response = await this.fetchProducts(`(sku=${encodeURIComponent(sku)})`, 1);
    const product = response.products?.[0];
    return product ? mapBestBuyProduct(product) : null;
  }

  async checkAvailability(input: AvailabilityCheckInput): Promise<AvailabilityResult> {
    this.assertConfigured();
    const lookup = await this.lookupProduct({ sku: input.sku });
    if (!lookup) {
      return {
        storeKey: this.storeKey,
        sku: input.sku,
        stockStatus: StockStatus.UNKNOWN,
        onlineAvailability: "UNKNOWN"
      };
    }
    return mapBestBuyAvailability({
      sku: lookup.sku,
      name: lookup.name,
      salePrice: lookup.priceCents == null ? undefined : lookup.priceCents / 100,
      regularPrice: lookup.regularPriceCents == null ? undefined : lookup.regularPriceCents / 100,
      onlineAvailability: lookup.shippingAvailable ?? undefined,
      inStoreAvailability: lookup.pickupAvailable ?? undefined,
      url: lookup.productUrl,
      image: lookup.imageUrl ?? undefined
    });
  }

  getOpenProductUrl(product: RetailerProductRef): string {
    if (product.productUrl) {
      return product.productUrl;
    }
    const sku = product.sku ?? product.externalId;
    return sku ? `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(sku)}` : "https://www.bestbuy.com/site/searchpage.jsp?st=pokemon%20tcg";
  }

  getOpenCartUrl(): string {
    return "https://www.bestbuy.com/cart";
  }

  private assertConfigured(): void {
    if (!this.apiKey) {
      throw new Error("BEST_BUY_API_KEY is not configured.");
    }
  }

  private async fetchProducts(filter: string, pageSize: number): Promise<BestBuyProductsResponse> {
    const url = `${BASE_URL}/products${filter}?apiKey=${encodeURIComponent(this.apiKey ?? "")}&format=json&pageSize=${pageSize}&show=${DEFAULT_FIELDS}`;
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "PokeDadRadar/0.1 private-read-only"
      }
    });

    if (!response.ok) {
      throw new Error(`Best Buy API returned ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<BestBuyProductsResponse>;
  }
}
