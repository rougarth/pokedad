import { PriceStatus, StockStatus } from "@pokedad-radar/shared";
import type { ProductSearchResult, AvailabilityResult, AvailabilityState } from "../types.js";
import type { BestBuyProduct } from "./bestbuy.types.js";

function toCents(value?: number | null): number | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value * 100);
}

function onlineAvailability(product: BestBuyProduct): AvailabilityState {
  if (product.onlineAvailability === true) {
    return "IN_STOCK";
  }
  if (product.orderable === "Preorder") {
    return "PREORDER";
  }
  if (product.onlineAvailability === false || product.orderable === "SoldOut") {
    return "OUT_OF_STOCK";
  }
  return "UNKNOWN";
}

function stockStatus(product: BestBuyProduct): StockStatus {
  const availability = onlineAvailability(product);
  if (availability === "IN_STOCK") return StockStatus.IN_STOCK;
  if (availability === "PREORDER") return StockStatus.PREORDER;
  if (availability === "OUT_OF_STOCK") return StockStatus.OUT_OF_STOCK;
  return StockStatus.UNKNOWN;
}

export function mapBestBuyProduct(product: BestBuyProduct): ProductSearchResult {
  const sku = product.sku == null ? "unknown" : String(product.sku);
  const priceCents = toCents(product.salePrice);
  const regularPriceCents = toCents(product.regularPrice);

  return {
    storeKey: "best-buy",
    storeName: "Best Buy",
    source: "BEST_BUY_API",
    externalId: sku,
    sku,
    name: product.name ?? `Best Buy SKU ${sku}`,
    seller: "Best Buy",
    sellerAccepted: true,
    productUrl: product.url ?? `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(sku)}`,
    imageUrl: product.image ?? product.thumbnailImage ?? null,
    priceCents,
    regularPriceCents,
    msrpCents: regularPriceCents ?? priceCents,
    maxAcceptedPriceCents: regularPriceCents ?? priceCents,
    priceStatus: priceCents == null ? PriceStatus.UNKNOWN_MSRP : PriceStatus.ACCEPTED,
    stockStatus: stockStatus(product),
    onlineAvailability: onlineAvailability(product),
    shippingAvailable: product.onlineAvailability ?? null,
    pickupAvailable: product.inStoreAvailability ?? null,
    raw: {
      sku,
      orderable: product.orderable,
      manufacturer: product.manufacturer,
      type: product.type
    }
  };
}

export function mapBestBuyAvailability(product: BestBuyProduct): AvailabilityResult {
  const mapped = mapBestBuyProduct(product);
  return {
    storeKey: "best-buy",
    sku: mapped.sku ?? mapped.externalId,
    stockStatus: mapped.stockStatus,
    onlineAvailability: mapped.onlineAvailability,
    shippingAvailable: mapped.shippingAvailable,
    pickupAvailable: mapped.pickupAvailable,
    productUrl: mapped.productUrl,
    raw: mapped.raw
  };
}
