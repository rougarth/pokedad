export type StoreSafetyMode =
  | "OFFICIAL_API_CANDIDATE"
  | "MANUAL_OPEN_ONLY"
  | "RESEARCH_PENDING"
  | "MOCK_ONLY"
  | "BLOCKED_FOR_AUTOMATION";

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

export const storeSafetyMatrix: StoreSafetyMatrixItem[] = [
  {
    storeKey: "best-buy",
    displayName: "Best Buy",
    status: "APPROVAL_PENDING",
    officialApiFound: true,
    apiAccessNotes: "Best Buy Developer Products API exists. Local key approval/access is still pending; use read-only only after approval.",
    supportsProductSearch: true,
    supportsProductLookup: true,
    supportsPrice: true,
    supportsAvailability: true,
    supportsSellerFiltering: true,
    recommendedMode: "OFFICIAL_API_CANDIDATE",
    riskLevel: "LOW",
    safetyNotes: ["Official Products API candidate.", "Read-only product, price, availability, image, and URL only.", "No cart, checkout, browser automation, credentials, cookies, or sessions."],
    termsConcerns: ["API key approval and Best Buy API terms must be followed.", "No requests until key access is approved and configured."],
    blockedCapabilities: ["AUTO_CHECKOUT", "PAYMENT_SUBMISSION", "CAPTCHA_BYPASS", "QUEUE_BYPASS", "PURCHASE_LIMIT_BYPASS", "RETAILER_CREDENTIAL_STORAGE", "RETAILER_COOKIE_STORAGE"],
    nextSafeStep: "Wait for Best Buy approval, add BEST_BUY_API_KEY locally, restart API, run readiness check, then one controlled manual read-only scan."
  },
  {
    storeKey: "target",
    displayName: "Target",
    status: "MANUAL_ONLY",
    officialApiFound: null,
    apiAccessNotes: "No approved consumer restock API has been configured for this app.",
    supportsProductSearch: null,
    supportsProductLookup: null,
    supportsPrice: null,
    supportsAvailability: null,
    supportsSellerFiltering: null,
    recommendedMode: "BLOCKED_FOR_AUTOMATION",
    riskLevel: "HIGH",
    safetyNotes: ["Target remains manual/open-only.", "Do not add scraping or automated store interaction."],
    termsConcerns: ["Terms/automation concerns require explicit approved pathway before any adapter work."],
    blockedCapabilities: ["PRODUCT_SEARCH", "PRODUCT_LOOKUP", "PRICE_CHECK", "AVAILABILITY_CHECK", "AUTO_CHECKOUT", "CAPTCHA_BYPASS", "QUEUE_BYPASS"],
    nextSafeStep: "Research official/approved API or partner pathway only; keep manual launch links until confirmed."
  },
  {
    storeKey: "walmart",
    displayName: "Walmart",
    status: "RESEARCH_ONLY",
    officialApiFound: true,
    apiAccessNotes: "Walmart developer APIs exist, but current public docs appear marketplace/supplier oriented and need compliance review for consumer restock use.",
    supportsProductSearch: null,
    supportsProductLookup: null,
    supportsPrice: null,
    supportsAvailability: null,
    supportsSellerFiltering: null,
    recommendedMode: "RESEARCH_PENDING",
    riskLevel: "MEDIUM",
    safetyNotes: ["No live Walmart scanner in this phase.", "Do not scrape Walmart pages."],
    termsConcerns: ["Confirm API program eligibility, terms, rate limits, and whether consumer product availability use is allowed."],
    blockedCapabilities: ["AUTO_CHECKOUT", "PAYMENT_SUBMISSION", "CAPTCHA_BYPASS", "QUEUE_BYPASS", "RETAILER_CREDENTIAL_STORAGE"],
    nextSafeStep: "Review Walmart developer program docs for an approved read-only product availability path."
  },
  {
    storeKey: "gamestop",
    displayName: "GameStop",
    status: "RESEARCH_ONLY",
    officialApiFound: null,
    apiAccessNotes: "No confirmed official public product availability API is configured.",
    supportsProductSearch: null,
    supportsProductLookup: null,
    supportsPrice: null,
    supportsAvailability: null,
    supportsSellerFiltering: null,
    recommendedMode: "RESEARCH_PENDING",
    riskLevel: "UNKNOWN",
    safetyNotes: ["Research only.", "No scraping or browser automation."],
    termsConcerns: ["Needs official/public API confirmation before adapter design."],
    blockedCapabilities: ["PRODUCT_SEARCH", "PRODUCT_LOOKUP", "PRICE_CHECK", "AVAILABILITY_CHECK", "AUTO_CHECKOUT"],
    nextSafeStep: "Search for official developer or affiliate product feed access; otherwise keep manual/open-only."
  },
  {
    storeKey: "pokemon-center",
    displayName: "Pokemon Center",
    status: "MANUAL_ONLY",
    officialApiFound: null,
    apiAccessNotes: "No approved public product availability API is configured.",
    supportsProductSearch: null,
    supportsProductLookup: null,
    supportsPrice: null,
    supportsAvailability: null,
    supportsSellerFiltering: true,
    recommendedMode: "MANUAL_OPEN_ONLY",
    riskLevel: "HIGH",
    safetyNotes: ["High-demand Pokemon releases may use queues or human checks.", "Manual/open-only unless an official pathway exists."],
    termsConcerns: ["Do not bypass queues, waiting rooms, human checks, purchase limits, or anti-bot controls."],
    blockedCapabilities: ["PRODUCT_SEARCH", "PRODUCT_LOOKUP", "AVAILABILITY_CHECK", "AUTO_CHECKOUT", "CAPTCHA_BYPASS", "QUEUE_BYPASS", "PURCHASE_LIMIT_BYPASS"],
    nextSafeStep: "Keep manual launch links and wishlist tracking; only revisit if Pokemon Center publishes an approved read-only API."
  },
  {
    storeKey: "amazon",
    displayName: "Amazon",
    status: "RESEARCH_ONLY",
    officialApiFound: true,
    apiAccessNotes: "Amazon Product Advertising API exists but requires program access and compliance review. Seller/source filtering must be reviewed.",
    supportsProductSearch: true,
    supportsProductLookup: true,
    supportsPrice: true,
    supportsAvailability: null,
    supportsSellerFiltering: null,
    recommendedMode: "RESEARCH_PENDING",
    riskLevel: "MEDIUM",
    safetyNotes: ["Official API research only.", "No scraping, checkout, or marketplace automation."],
    termsConcerns: ["Product Advertising API participation, usage restrictions, display requirements, and rate limits must be reviewed."],
    blockedCapabilities: ["AUTO_CHECKOUT", "PAYMENT_SUBMISSION", "CAPTCHA_BYPASS", "QUEUE_BYPASS", "RETAILER_CREDENTIAL_STORAGE", "RETAILER_COOKIE_STORAGE"],
    nextSafeStep: "Review Product Advertising API eligibility and whether official-seller-only Pokemon TCG alerts are permitted."
  },
  {
    storeKey: "costco",
    displayName: "Costco",
    status: "RESEARCH_ONLY",
    officialApiFound: null,
    apiAccessNotes: "No confirmed official consumer product availability API is configured.",
    supportsProductSearch: null,
    supportsProductLookup: null,
    supportsPrice: null,
    supportsAvailability: null,
    supportsSellerFiltering: true,
    recommendedMode: "RESEARCH_PENDING",
    riskLevel: "UNKNOWN",
    safetyNotes: ["No live Costco scanner.", "Do not scrape Costco pages."],
    termsConcerns: ["Membership and inventory context require careful review."],
    blockedCapabilities: ["PRODUCT_SEARCH", "PRODUCT_LOOKUP", "PRICE_CHECK", "AVAILABILITY_CHECK", "AUTO_CHECKOUT"],
    nextSafeStep: "Research official partner/product feed options; otherwise keep manual/open-only."
  },
  {
    storeKey: "sams-club",
    displayName: "Sam's Club",
    status: "RESEARCH_ONLY",
    officialApiFound: true,
    apiAccessNotes: "Sam's Club advertising APIs exist; consumer restock availability use is not confirmed.",
    supportsProductSearch: null,
    supportsProductLookup: null,
    supportsPrice: null,
    supportsAvailability: null,
    supportsSellerFiltering: null,
    recommendedMode: "RESEARCH_PENDING",
    riskLevel: "UNKNOWN",
    safetyNotes: ["No live Sam's Club scanner.", "Do not scrape product pages."],
    termsConcerns: ["Advertising/catalog APIs may not permit consumer restock scanning."],
    blockedCapabilities: ["AUTO_CHECKOUT", "PAYMENT_SUBMISSION", "CAPTCHA_BYPASS", "QUEUE_BYPASS"],
    nextSafeStep: "Review whether official MAP/catalog APIs can be used for read-only product availability alerts."
  },
  {
    storeKey: "bjs",
    displayName: "BJ's",
    status: "RESEARCH_ONLY",
    officialApiFound: null,
    apiAccessNotes: "No confirmed official consumer product availability API is configured for this app.",
    supportsProductSearch: null,
    supportsProductLookup: null,
    supportsPrice: null,
    supportsAvailability: null,
    supportsSellerFiltering: true,
    recommendedMode: "RESEARCH_PENDING",
    riskLevel: "UNKNOWN",
    safetyNotes: ["No live BJ's scanner.", "Do not scrape BJ's pages."],
    termsConcerns: ["Membership, pickup, and inventory behavior need official review."],
    blockedCapabilities: ["PRODUCT_SEARCH", "PRODUCT_LOOKUP", "PRICE_CHECK", "AVAILABILITY_CHECK", "AUTO_CHECKOUT"],
    nextSafeStep: "Research official API/partner access; keep manual/open-only until confirmed."
  },
  {
    storeKey: "barnes-noble",
    displayName: "Barnes & Noble",
    status: "RESEARCH_ONLY",
    officialApiFound: null,
    apiAccessNotes: "No confirmed public product availability API is configured.",
    supportsProductSearch: null,
    supportsProductLookup: null,
    supportsPrice: null,
    supportsAvailability: null,
    supportsSellerFiltering: true,
    recommendedMode: "RESEARCH_PENDING",
    riskLevel: "UNKNOWN",
    safetyNotes: ["Research only.", "No scraping or browser automation."],
    termsConcerns: ["Needs official/API or affiliate data pathway review."],
    blockedCapabilities: ["PRODUCT_SEARCH", "PRODUCT_LOOKUP", "PRICE_CHECK", "AVAILABILITY_CHECK", "AUTO_CHECKOUT"],
    nextSafeStep: "Research official feeds or affiliate APIs; keep manual/open-only."
  },
  {
    storeKey: "dicks-sporting-goods",
    displayName: "Dick's Sporting Goods",
    status: "RESEARCH_ONLY",
    officialApiFound: null,
    apiAccessNotes: "No confirmed public consumer product availability API is configured.",
    supportsProductSearch: null,
    supportsProductLookup: null,
    supportsPrice: null,
    supportsAvailability: null,
    supportsSellerFiltering: true,
    recommendedMode: "RESEARCH_PENDING",
    riskLevel: "UNKNOWN",
    safetyNotes: ["Research only.", "No scraping or browser automation."],
    termsConcerns: ["Promotional/advertising APIs, if any, are not automatically suitable for restock scanning."],
    blockedCapabilities: ["PRODUCT_SEARCH", "PRODUCT_LOOKUP", "PRICE_CHECK", "AVAILABILITY_CHECK", "AUTO_CHECKOUT"],
    nextSafeStep: "Research official developer, affiliate, or product feed access; keep manual/open-only."
  },
  {
    storeKey: "ace-hardware",
    displayName: "Ace Hardware",
    status: "RESEARCH_ONLY",
    officialApiFound: null,
    apiAccessNotes: "No confirmed public consumer product availability API is configured.",
    supportsProductSearch: null,
    supportsProductLookup: null,
    supportsPrice: null,
    supportsAvailability: null,
    supportsSellerFiltering: true,
    recommendedMode: "RESEARCH_PENDING",
    riskLevel: "UNKNOWN",
    safetyNotes: ["Research only.", "No scraping or browser automation."],
    termsConcerns: ["Local-store inventory and dealer data require official pathway review."],
    blockedCapabilities: ["PRODUCT_SEARCH", "PRODUCT_LOOKUP", "PRICE_CHECK", "AVAILABILITY_CHECK", "AUTO_CHECKOUT"],
    nextSafeStep: "Research official product sync/feed partner options; keep manual/open-only."
  }
];

export function getStoreSafetyItem(storeKey: string): StoreSafetyMatrixItem | null {
  return storeSafetyMatrix.find((item) => item.storeKey === storeKey) ?? null;
}
