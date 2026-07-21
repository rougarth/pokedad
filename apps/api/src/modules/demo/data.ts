import {
  AlertStatus,
  CartAssistMode,
  CartAssistStatus,
  ProductCategoryKind,
  SellerPolicy,
  SkipReason,
  StockStatus,
  StoreSessionState,
  evaluateAcceptablePrice,
  type DemoAlertChannel,
  type DemoAuditLog,
  type DemoCartAttempt,
  type DemoHistoryEvent,
  type DemoLiveFind,
  type DemoPriceRule,
  type DemoProduct,
  type DemoRadarRules,
  type DemoStore
} from "@pokedad-radar/shared";
import { sanitizeForAudit } from "../../security/sanitizer.js";

const now = () => new Date().toISOString();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

export const products: DemoProduct[] = [
  { id: "prod-booster-bundle", name: "Mega Evolution Booster Bundle", category: ProductCategoryKind.BOOSTER_BUNDLE, imageColor: "#157f7b", msrpCents: 2699 },
  { id: "prod-etb", name: "Journey Together Elite Trainer Box", category: ProductCategoryKind.ELITE_TRAINER_BOX, imageColor: "#b98522", msrpCents: 4999 },
  { id: "prod-pc-etb", name: "Pokemon Center Elite Trainer Box", category: ProductCategoryKind.POKEMON_CENTER_ETB, imageColor: "#6d5bd0", msrpCents: 5999 },
  { id: "prod-upc", name: "Ultra Premium Collection", category: ProductCategoryKind.ULTRA_PREMIUM_COLLECTION, imageColor: "#17201a", msrpCents: 11999 },
  { id: "prod-collection-box", name: "Ex Collection Box", category: ProductCategoryKind.COLLECTION_BOX, imageColor: "#c2413b", msrpCents: 1999 },
  { id: "prod-premium", name: "Premium Figure Collection", category: ProductCategoryKind.PREMIUM_COLLECTION, imageColor: "#2563eb", msrpCents: 3999 },
  { id: "prod-mini-tin", name: "Mini Tin Display", category: ProductCategoryKind.MINI_TIN, imageColor: "#16a34a", msrpCents: 999 },
  { id: "prod-sleeved", name: "Sleeved Booster Pack", category: ProductCategoryKind.SLEEVED_BOOSTER, imageColor: "#ea580c", msrpCents: 499 },
  { id: "prod-new-release", name: "New Release Build & Battle Stadium", category: ProductCategoryKind.NEW_RELEASE, imageColor: "#0891b2", msrpCents: null }
];

export const stores: DemoStore[] = [
  { id: "store-target", name: "Target", slug: "target", baseUrl: "https://www.target.com", loginUrl: "https://www.target.com/login", cartUrl: "https://www.target.com/cart", sessionState: StoreSessionState.LOGGED_IN, monitoringEnabled: true, cartAssistMode: CartAssistMode.OPEN_ONLY, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "Category rules", defaultToleranceCents: 500, lastCheckTime: hoursAgo(0.1) },
  { id: "store-best-buy", name: "Best Buy", slug: "best-buy", baseUrl: "https://www.bestbuy.com", loginUrl: "https://www.bestbuy.com/identity/signin", cartUrl: "https://www.bestbuy.com/cart", sessionState: StoreSessionState.LOGGED_IN, monitoringEnabled: true, cartAssistMode: CartAssistMode.OPEN_ONLY, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "MSRP + $5", defaultToleranceCents: 500, lastCheckTime: hoursAgo(0.4) },
  { id: "store-pokemon-center", name: "Pokemon Center", slug: "pokemon-center", baseUrl: "https://www.pokemoncenter.com", loginUrl: "https://www.pokemoncenter.com/login", cartUrl: "https://www.pokemoncenter.com/cart", sessionState: StoreSessionState.QUEUE_OR_WAITING_ROOM, monitoringEnabled: true, cartAssistMode: CartAssistMode.OPEN_ONLY, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "PC ETB custom", defaultToleranceCents: 1000, lastCheckTime: hoursAgo(0.2), lastError: "Queue detected. Helper stopped and requires manual action." },
  { id: "store-walmart", name: "Walmart", slug: "walmart", baseUrl: "https://www.walmart.com", loginUrl: "https://www.walmart.com/account/login", cartUrl: "https://www.walmart.com/cart", sessionState: StoreSessionState.LOGIN_EXPIRED, monitoringEnabled: true, cartAssistMode: CartAssistMode.OPEN_ONLY, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "Official seller only", defaultToleranceCents: 500, lastCheckTime: hoursAgo(1.3), lastError: "Login expired for browser helper." },
  { id: "store-gamestop", name: "GameStop", slug: "gamestop", baseUrl: "https://www.gamestop.com", loginUrl: "https://www.gamestop.com/login", cartUrl: "https://www.gamestop.com/cart", sessionState: StoreSessionState.NOT_LOGGED_IN, monitoringEnabled: false, cartAssistMode: CartAssistMode.DISABLED, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "MSRP + $5", defaultToleranceCents: 500, lastCheckTime: hoursAgo(5) },
  { id: "store-sams", name: "Sam's Club", slug: "sams-club", baseUrl: "https://www.samsclub.com", loginUrl: "https://www.samsclub.com/login", cartUrl: "https://www.samsclub.com/cart", sessionState: StoreSessionState.LOGGED_IN, monitoringEnabled: true, cartAssistMode: CartAssistMode.OPEN_ONLY, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "Membership exceptions", defaultToleranceCents: 800, lastCheckTime: hoursAgo(0.8) },
  { id: "store-costco", name: "Costco", slug: "costco", baseUrl: "https://www.costco.com", loginUrl: "https://www.costco.com/LogonForm", cartUrl: "https://www.costco.com/CheckoutCartDisplayView", sessionState: StoreSessionState.UNKNOWN, monitoringEnabled: false, cartAssistMode: CartAssistMode.DISABLED, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "Membership exceptions", defaultToleranceCents: 800, lastCheckTime: hoursAgo(20), lastError: "Monitoring disabled." },
  { id: "store-bjs", name: "BJ's", slug: "bjs", baseUrl: "https://www.bjs.com", loginUrl: "https://www.bjs.com/login", cartUrl: "https://www.bjs.com/cart", sessionState: StoreSessionState.NOT_LOGGED_IN, monitoringEnabled: false, cartAssistMode: CartAssistMode.DISABLED, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "Membership exceptions", defaultToleranceCents: 800, lastCheckTime: hoursAgo(24) },
  { id: "store-amazon", name: "Amazon", slug: "amazon", baseUrl: "https://www.amazon.com", loginUrl: "https://www.amazon.com/ap/signin", cartUrl: "https://www.amazon.com/gp/cart/view.html", sessionState: StoreSessionState.UNKNOWN, monitoringEnabled: true, cartAssistMode: CartAssistMode.OPEN_ONLY, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "Amazon official only", defaultToleranceCents: 0, lastCheckTime: hoursAgo(2.2), lastError: "Skipped third-party marketplace result." },
  { id: "store-barnes", name: "Barnes & Noble", slug: "barnes-noble", baseUrl: "https://www.barnesandnoble.com", loginUrl: "https://www.barnesandnoble.com/account/login", cartUrl: "https://www.barnesandnoble.com/cart", sessionState: StoreSessionState.LOGGED_IN, monitoringEnabled: true, cartAssistMode: CartAssistMode.OPEN_ONLY, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "MSRP + $5", defaultToleranceCents: 500, lastCheckTime: hoursAgo(1.1) },
  { id: "store-dicks", name: "Dick's Sporting Goods", slug: "dicks-sporting-goods", baseUrl: "https://www.dickssportinggoods.com", loginUrl: "https://www.dickssportinggoods.com/Login", cartUrl: "https://www.dickssportinggoods.com/cart", sessionState: StoreSessionState.UNKNOWN, monitoringEnabled: true, cartAssistMode: CartAssistMode.OPEN_ONLY, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "MSRP + $5", defaultToleranceCents: 500, lastCheckTime: hoursAgo(3.5) },
  { id: "store-ace", name: "Ace Hardware", slug: "ace-hardware", baseUrl: "https://www.acehardware.com", loginUrl: "https://www.acehardware.com/login", cartUrl: "https://www.acehardware.com/cart", sessionState: StoreSessionState.NOT_LOGGED_IN, monitoringEnabled: false, cartAssistMode: CartAssistMode.DISABLED, sellerPolicy: SellerPolicy.OFFICIAL_ONLY, priceToleranceLabel: "Manual review", defaultToleranceCents: 300, lastCheckTime: hoursAgo(18) }
];

export let radarRules: DemoRadarRules = {
  monitorAllSealed: true,
  selectedCategories: products.map((product) => product.category),
  monitorNewReleases: true,
  ignoreSingles: true,
  ignoreThirdPartySellers: true,
  shippingPreferred: true,
  pickupPreferred: true,
  pickupZip: "19019",
  pickupRadiusMiles: 25,
  quantityWantedPerProduct: 1,
  maxQuantityPerStoreProduct: 1
};

export const priceRules: DemoPriceRule[] = [
  { id: "rule-global", scope: "GLOBAL", label: "Global fair-price default", target: "All sealed products", allowedMarkupCents: 500, maxAcceptedPriceCents: null, enabled: true },
  { id: "rule-booster", scope: "CATEGORY", label: "Booster Bundle cap", target: "Booster Bundle", msrpCents: 2699, allowedMarkupCents: 800, maxAcceptedPriceCents: 3499, categorySpecificToleranceCents: 800, enabled: true },
  { id: "rule-etb", scope: "CATEGORY", label: "ETB cap", target: "Elite Trainer Box", msrpCents: 4999, allowedMarkupCents: 1000, maxAcceptedPriceCents: 5999, categorySpecificToleranceCents: 1000, enabled: true },
  { id: "rule-pc-etb", scope: "PRODUCT", label: "Pokemon Center ETB override", target: "Pokemon Center ETB", msrpCents: 5999, allowedMarkupCents: 1000, maxAcceptedPriceCents: 6999, productSpecificOverrideCents: 6999, enabled: true },
  { id: "rule-upc", scope: "CATEGORY", label: "UPC cap", target: "Ultra Premium Collection", msrpCents: 11999, allowedMarkupCents: 1000, maxAcceptedPriceCents: 12999, categorySpecificToleranceCents: 1000, enabled: true },
  { id: "rule-membership", scope: "STORE", label: "Membership store exception", target: "Sam's Club / Costco / BJ's", allowedMarkupCents: 800, maxAcceptedPriceCents: null, storeSpecificToleranceCents: 800, enabled: true }
];

function evaluatedFind(input: Omit<DemoLiveFind, "priceStatus" | "maxAcceptedPriceCents"> & { toleranceCents: number; customMaxPriceCents?: number | null }): DemoLiveFind {
  const result = evaluateAcceptablePrice({
    priceCents: input.priceCents,
    msrpCents: input.msrpCents,
    toleranceCents: input.toleranceCents,
    customMaxPriceCents: input.customMaxPriceCents,
    sellerAccepted: input.sellerAccepted
  });

  return {
    ...input,
    priceStatus: result.priceStatus,
    maxAcceptedPriceCents: result.acceptedMaxPriceCents
  };
}

export const liveFinds: DemoLiveFind[] = [
  evaluatedFind({ id: "find-1", productId: "prod-booster-bundle", productName: "Mega Evolution Booster Bundle", category: ProductCategoryKind.BOOSTER_BUNDLE, storeId: "store-target", storeName: "Target", seller: "Target", sellerAccepted: true, productUrl: "https://www.target.com/demo-booster-bundle", cartUrl: "https://www.target.com/cart", imageColor: "#157f7b", priceCents: 3499, msrpCents: 2699, toleranceCents: 800, customMaxPriceCents: 3499, stockStatus: StockStatus.IN_STOCK, shippingStatus: "Available", pickupStatus: "Available", cartAssistStatus: CartAssistStatus.PRICE_ACCEPTED, alertStatus: AlertStatus.READY, ignored: false, bought: false, foundAt: hoursAgo(0.08) }),
  evaluatedFind({ id: "find-2", productId: "prod-pc-etb", productName: "Pokemon Center Elite Trainer Box", category: ProductCategoryKind.POKEMON_CENTER_ETB, storeId: "store-pokemon-center", storeName: "Pokemon Center", seller: "Pokemon Center", sellerAccepted: true, productUrl: "https://www.pokemoncenter.com/demo-pc-etb", cartUrl: "https://www.pokemoncenter.com/cart", imageColor: "#6d5bd0", priceCents: 6999, msrpCents: 5999, toleranceCents: 1000, customMaxPriceCents: 6999, stockStatus: StockStatus.IN_STOCK, shippingStatus: "Available", pickupStatus: "Unavailable", cartAssistStatus: CartAssistStatus.QUEUE_DETECTED, alertStatus: AlertStatus.SENT, ignored: false, bought: false, foundAt: hoursAgo(0.2) }),
  evaluatedFind({ id: "find-3", productId: "prod-etb", productName: "Journey Together Elite Trainer Box", category: ProductCategoryKind.ELITE_TRAINER_BOX, storeId: "store-best-buy", storeName: "Best Buy", seller: "Best Buy", sellerAccepted: true, productUrl: "https://www.bestbuy.com/demo-etb", cartUrl: "https://www.bestbuy.com/cart", imageColor: "#b98522", priceCents: 4999, msrpCents: 4999, toleranceCents: 1000, stockStatus: StockStatus.PREORDER, shippingStatus: "Available", pickupStatus: "Unknown", cartAssistStatus: CartAssistStatus.PRODUCT_FOUND, alertStatus: AlertStatus.SENT, ignored: false, bought: false, foundAt: hoursAgo(0.7) }),
  evaluatedFind({ id: "find-4", productId: "prod-upc", productName: "Ultra Premium Collection", category: ProductCategoryKind.ULTRA_PREMIUM_COLLECTION, storeId: "store-walmart", storeName: "Walmart", seller: "ToyResale Outlet", sellerAccepted: false, productUrl: "https://www.walmart.com/demo-upc", cartUrl: "https://www.walmart.com/cart", imageColor: "#17201a", priceCents: 15999, msrpCents: 11999, toleranceCents: 1000, customMaxPriceCents: 12999, stockStatus: StockStatus.IN_STOCK, shippingStatus: "Available", pickupStatus: "Unavailable", cartAssistStatus: CartAssistStatus.SKIPPED, alertStatus: AlertStatus.SUPPRESSED, ignored: false, bought: false, foundAt: hoursAgo(1.8) }),
  evaluatedFind({ id: "find-5", productId: "prod-premium", productName: "Premium Figure Collection", category: ProductCategoryKind.PREMIUM_COLLECTION, storeId: "store-sams", storeName: "Sam's Club", seller: "Sam's Club", sellerAccepted: true, productUrl: "https://www.samsclub.com/demo-premium", cartUrl: "https://www.samsclub.com/cart", imageColor: "#2563eb", priceCents: 4799, msrpCents: 3999, toleranceCents: 1000, customMaxPriceCents: 4999, stockStatus: StockStatus.IN_STOCK, shippingStatus: "Available", pickupStatus: "Available", cartAssistStatus: CartAssistStatus.CART_READY, alertStatus: AlertStatus.SENT, ignored: false, bought: false, foundAt: hoursAgo(2.1) }),
  evaluatedFind({ id: "find-6", productId: "prod-new-release", productName: "New Release Build & Battle Stadium", category: ProductCategoryKind.NEW_RELEASE, storeId: "store-barnes", storeName: "Barnes & Noble", seller: "Barnes & Noble", sellerAccepted: true, productUrl: "https://www.barnesandnoble.com/demo-new-release", cartUrl: "https://www.barnesandnoble.com/cart", imageColor: "#0891b2", priceCents: 5999, msrpCents: null, toleranceCents: 500, stockStatus: StockStatus.UNKNOWN, shippingStatus: "Unknown", pickupStatus: "Unknown", cartAssistStatus: CartAssistStatus.NOT_ATTEMPTED, alertStatus: AlertStatus.NOT_SENT, ignored: false, bought: false, foundAt: hoursAgo(4.5) })
];

export const cartQueue: DemoCartAttempt[] = [
  { id: "cart-1", liveFindId: "find-1", productName: "Mega Evolution Booster Bundle", storeName: "Target", status: CartAssistStatus.PRICE_ACCEPTED, productUrl: "https://www.target.com/demo-booster-bundle", cartUrl: "https://www.target.com/cart", requestedQuantity: 1, lastMessage: "Open-only helper can open product/cart; no checkout automation.", createdAt: hoursAgo(0.08), updatedAt: hoursAgo(0.05) },
  { id: "cart-2", liveFindId: "find-2", productName: "Pokemon Center Elite Trainer Box", storeName: "Pokemon Center", status: CartAssistStatus.QUEUE_DETECTED, productUrl: "https://www.pokemoncenter.com/demo-pc-etb", cartUrl: "https://www.pokemoncenter.com/cart", requestedQuantity: 1, stopReason: "Queue detected. System stopped and requires manual user action.", lastMessage: "Manual action required before any further helper action.", createdAt: hoursAgo(0.2), updatedAt: hoursAgo(0.18) },
  { id: "cart-3", liveFindId: "find-5", productName: "Premium Figure Collection", storeName: "Sam's Club", status: CartAssistStatus.CART_READY, productUrl: "https://www.samsclub.com/demo-premium", cartUrl: "https://www.samsclub.com/cart", requestedQuantity: 1, lastMessage: "Demo cart-ready state. Checkout remains manual.", createdAt: hoursAgo(2.1), updatedAt: hoursAgo(2) },
  { id: "cart-4", liveFindId: "find-4", productName: "Ultra Premium Collection", storeName: "Walmart", status: CartAssistStatus.SKIPPED, productUrl: "https://www.walmart.com/demo-upc", cartUrl: "https://www.walmart.com/cart", requestedQuantity: 1, stopReason: "Third-party seller skipped by official-seller-only rule.", lastMessage: "Skipped before cart assist.", createdAt: hoursAgo(1.8), updatedAt: hoursAgo(1.8) },
  { id: "cart-5", liveFindId: "find-demo-captcha", productName: "Sleeved Booster Pack", storeName: "Amazon", status: CartAssistStatus.CAPTCHA_DETECTED, productUrl: "https://www.amazon.com/demo-sleeved", cartUrl: "https://www.amazon.com/gp/cart/view.html", requestedQuantity: 1, stopReason: "CAPTCHA detected. System stopped and requires manual user action.", lastMessage: "No retry until the user clears the human check manually.", createdAt: hoursAgo(3), updatedAt: hoursAgo(2.9) }
];

export const alertChannels: DemoAlertChannel[] = [
  { id: "alert-telegram", type: "Telegram", label: "Dad phone Telegram", enabled: true, destinationHint: "@pokedad_private" },
  { id: "alert-discord", type: "Discord webhook", label: "Family restock channel", enabled: false, destinationHint: "Webhook encrypted" },
  { id: "alert-sms", type: "SMS", label: "Text me", enabled: true, destinationHint: "+1 *** *** 0142" },
  { id: "alert-email", type: "Email", label: "Personal email", enabled: true, destinationHint: "g***@example.com" },
  { id: "alert-browser", type: "Browser notification", label: "This browser", enabled: true, destinationHint: "Local browser" }
];

export const history: DemoHistoryEvent[] = [
  { id: "history-1", productName: "Mega Evolution Booster Bundle", storeName: "Target", priceCents: 3499, msrpCents: 2699, foundAt: hoursAgo(0.08), alertSent: true, cartAssistWorked: false, bought: false, skipReason: SkipReason.NONE },
  { id: "history-2", productName: "Pokemon Center Elite Trainer Box", storeName: "Pokemon Center", priceCents: 6999, msrpCents: 5999, foundAt: hoursAgo(0.2), alertSent: true, cartAssistWorked: false, bought: false, skipReason: SkipReason.QUEUE_DETECTED },
  { id: "history-3", productName: "Ultra Premium Collection", storeName: "Walmart", priceCents: 15999, msrpCents: 11999, foundAt: hoursAgo(1.8), alertSent: false, cartAssistWorked: false, bought: false, skipReason: SkipReason.THIRD_PARTY_SELLER },
  { id: "history-4", productName: "Mini Tin Display", storeName: "Costco", priceCents: 1299, msrpCents: 999, foundAt: hoursAgo(20), soldOutAt: hoursAgo(18), alertSent: false, cartAssistWorked: false, bought: false, skipReason: SkipReason.STORE_DISABLED }
];

export const auditLogs: DemoAuditLog[] = [
  { id: "audit-1", action: "HELPER_CONNECTED", summary: "Local helper heartbeat received without session data.", createdAt: hoursAgo(0.1), metadata: { safetyLevel: "OPEN_ONLY" } },
  { id: "audit-2", action: "CART_ASSIST_STOPPED", summary: "Pokemon Center queue detected; manual action required.", createdAt: hoursAgo(0.18), metadata: { status: CartAssistStatus.QUEUE_DETECTED } },
  { id: "audit-3", action: "ALERT_SENT", summary: "Acceptable price alert sent for Booster Bundle.", createdAt: hoursAgo(0.05), metadata: { channel: "Telegram" } }
];

export function addAuditLog(action: string, summary: string, metadata?: Record<string, unknown>): DemoAuditLog {
  const entry = {
    id: `audit-${Date.now()}`,
    action,
    summary,
    createdAt: now(),
    metadata: sanitizeForAudit(metadata ?? {}) as Record<string, unknown>
  };
  auditLogs.unshift(entry);
  return entry;
}

export function updateRadarRules(nextRules: Partial<DemoRadarRules>): DemoRadarRules {
  radarRules = { ...radarRules, ...nextRules };
  addAuditLog("WATCH_RULE_UPDATED", "Radar rules updated from dashboard.", nextRules);
  return radarRules;
}

