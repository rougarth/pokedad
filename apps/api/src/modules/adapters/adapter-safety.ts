import type { AdapterCapability, BlockedCapability } from "./types.js";
import type { StoreAdapter } from "./store-adapter.interface.js";

const forbiddenActiveCapabilities = new Set<string>([
  "AUTO_CHECKOUT",
  "PAYMENT_SUBMISSION",
  "CAPTCHA_BYPASS",
  "QUEUE_BYPASS",
  "PURCHASE_LIMIT_BYPASS",
  "UNAPPROVED_BUYING_AGENT",
  "RETAILER_CREDENTIAL_STORAGE",
  "RETAILER_COOKIE_STORAGE"
]);

const requiredBlockedCapabilities: BlockedCapability[] = [
  "AUTO_CHECKOUT",
  "PAYMENT_SUBMISSION",
  "CAPTCHA_BYPASS",
  "QUEUE_BYPASS",
  "PURCHASE_LIMIT_BYPASS",
  "UNAPPROVED_BUYING_AGENT",
  "RETAILER_CREDENTIAL_STORAGE",
  "RETAILER_COOKIE_STORAGE"
];

const secretKeyPatterns = [
  /password/i,
  /credential/i,
  /cookie/i,
  /session/i,
  /token/i,
  /authorization/i,
  /card/i,
  /payment/i,
  /cvv/i,
  /cvc/i
];

export function assertSafeAdapterRegistration(adapter: StoreAdapter): void {
  const unsafe = adapter.capabilities.filter((capability) => forbiddenActiveCapabilities.has(capability));
  if (unsafe.length > 0) {
    throw new Error(`Adapter ${adapter.storeKey} attempted to expose unsafe capabilities: ${unsafe.join(", ")}`);
  }

  const missingBlocked = requiredBlockedCapabilities.filter((capability) => !adapter.blockedCapabilities.includes(capability));
  if (missingBlocked.length > 0) {
    throw new Error(`Adapter ${adapter.storeKey} must declare blocked capabilities: ${missingBlocked.join(", ")}`);
  }

  if (adapter.capabilities.includes("CART_ASSIST_READINESS") && !adapter.capabilities.includes("OPEN_PRODUCT")) {
    throw new Error(`Adapter ${adapter.storeKey} cart readiness must remain open-product/manual.`);
  }
}

export function assertNoRetailerSecretStorage(value: unknown, path = "adapter"): void {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (secretKeyPatterns.some((pattern) => pattern.test(key))) {
      throw new Error(`Retailer secret/session/payment storage is blocked at ${path}.${key}`);
    }
    assertNoRetailerSecretStorage(child, `${path}.${key}`);
  }
}

export function assertCapabilityAllowed(adapter: StoreAdapter, capability: AdapterCapability): void {
  assertSafeAdapterRegistration(adapter);
  if (!adapter.capabilities.includes(capability)) {
    throw new Error(`${adapter.displayName} does not expose ${capability}.`);
  }
}
