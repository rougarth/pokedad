const BLOCKED_CAPABILITIES = Object.freeze([
  "UNAPPROVED_SCRAPING",
  "ADD_TO_CART",
  "AUTO_CHECKOUT",
  "PAYMENT_SUBMISSION",
  "CAPTCHA_BYPASS",
  "QUEUE_BYPASS",
  "RETAILER_CREDENTIAL_STORAGE",
  "RETAILER_COOKIE_STORAGE"
]);

const stores = {
  "best-buy": { displayName: "Best Buy", mode: "OFFICIAL_API_CANDIDATE", liveAllowed: true },
  target: { displayName: "Target", mode: "BLOCKED_FOR_AUTOMATION", liveAllowed: false },
  walmart: { displayName: "Walmart", mode: "RESEARCH_PENDING", liveAllowed: false },
  "pokemon-center": { displayName: "Pokemon Center", mode: "MANUAL_OPEN_ONLY", liveAllowed: false },
  gamestop: { displayName: "GameStop", mode: "RESEARCH_PENDING", liveAllowed: false },
  amazon: { displayName: "Amazon", mode: "RESEARCH_PENDING", liveAllowed: false },
  costco: { displayName: "Costco", mode: "RESEARCH_PENDING", liveAllowed: false },
  "sams-club": { displayName: "Sam's Club", mode: "RESEARCH_PENDING", liveAllowed: false },
  bjs: { displayName: "BJ's", mode: "RESEARCH_PENDING", liveAllowed: false }
};

export function getStoreSafety(storeKey) {
  const store = stores[storeKey];
  return store ? { storeKey, ...store, blockedCapabilities: BLOCKED_CAPABILITIES } : null;
}

export function listStoreSafety() {
  return Object.keys(stores).map(getStoreSafety);
}
