type StopState = "CAPTCHA_DETECTED" | "QUEUE_DETECTED" | "HUMAN_CHECK_REQUIRED" | "LOGIN_REQUIRED" | null;

// Content scripts must be self-contained because Manifest V3 does not load this
// file as an ES module. Keep these checks conservative and limited to blockers.
function detectStopState(text: string): StopState {
  const patterns: Array<[Exclude<StopState, null>, RegExp]> = [
    ["CAPTCHA_DETECTED", /captcha|verify you are human|i am not a robot/i],
    ["QUEUE_DETECTED", /waiting room|line to enter|high traffic queue/i],
    ["HUMAN_CHECK_REQUIRED", /human verification|security check|unusual activity|prove.*human/i],
    ["LOGIN_REQUIRED", /authentication required|sign in to continue|log in to continue|two-factor|verification code/i]
  ];

  for (const [state, pattern] of patterns) {
    if (pattern.test(text)) return state;
  }
  return null;
}

type StoreKey = "bjs" | "costco" | "sams-club" | "walmart";

interface CapturedSignal {
  storeKey: StoreKey;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
  sku: string | null;
  priceCents: number | null;
  currency: "USD";
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
  sellerName: string | null;
  capturedAt: string;
  captureMode: "USER_TRIGGERED_LOCAL_PAGE";
}

const storeByHost: Array<[RegExp, StoreKey]> = [
  [/(^|\.)bjs\.com$/i, "bjs"],
  [/(^|\.)costco\.com$/i, "costco"],
  [/(^|\.)samsclub\.com$/i, "sams-club"],
  [/(^|\.)walmart\.com$/i, "walmart"]
];

function textMeta(...selectors: string[]): string | null {
  for (const selector of selectors) {
    const node = document.querySelector<HTMLElement>(selector);
    const value = node?.getAttribute("content") ?? node?.textContent;
    if (value?.trim()) return value.trim();
  }
  return null;
}

function productJsonLd(): Record<string, unknown> | null {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  for (const script of Array.from(scripts)) {
    try {
      const parsed: unknown = JSON.parse(script.textContent ?? "null");
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object") continue;
        const record = candidate as Record<string, unknown>;
        const graph = Array.isArray(record["@graph"]) ? record["@graph"] as unknown[] : [record];
        const product = graph.find((item) => item && typeof item === "object" && (item as Record<string, unknown>)["@type"] === "Product");
        if (product && typeof product === "object") return product as Record<string, unknown>;
      }
    } catch {
      // Invalid third-party JSON-LD is ignored; visible metadata remains available.
    }
  }
  return null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cents(value: unknown): number | null {
  const raw = typeof value === "number" ? String(value) : stringValue(value);
  if (!raw) return null;
  const normalized = raw.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function capture(): CapturedSignal {
  const storeKey = storeByHost.find(([pattern]) => pattern.test(location.hostname))?.[1];
  if (!storeKey) throw new Error("UNSUPPORTED_STORE");

  const stopState = detectStopState(document.body?.innerText ?? "");
  if (stopState) throw new Error(stopState);

  const product = productJsonLd();
  const offersRaw = product?.offers;
  const offer = Array.isArray(offersRaw) ? offersRaw[0] : offersRaw;
  const offerRecord = offer && typeof offer === "object" ? offer as Record<string, unknown> : {};
  const brandRaw = product?.brand;
  const brand = brandRaw && typeof brandRaw === "object" ? stringValue((brandRaw as Record<string, unknown>).name) : stringValue(brandRaw);
  const productName = stringValue(product?.name) ?? textMeta('meta[property="og:title"]', 'meta[name="twitter:title"]', "h1");
  if (!productName) throw new Error("PRODUCT_NAME_NOT_FOUND");

  const availability = stringValue(offerRecord.availability)?.toLowerCase() ?? "";
  const body = (document.body?.innerText ?? "").toLowerCase();
  const stockStatus = availability.includes("instock") || /add to cart|shipping available|in stock/.test(body)
    ? "IN_STOCK"
    : availability.includes("outofstock") || /out of stock|sold out|currently unavailable/.test(body)
      ? "OUT_OF_STOCK"
      : "UNKNOWN";
  const imageRaw = product?.image;
  const imageUrl = Array.isArray(imageRaw) ? stringValue(imageRaw[0]) : stringValue(imageRaw);

  return {
    storeKey,
    productName,
    productUrl: location.href,
    imageUrl: imageUrl ?? textMeta('meta[property="og:image"]', 'meta[name="twitter:image"]'),
    sku: stringValue(product?.sku) ?? stringValue(product?.productID) ?? textMeta('[itemprop="sku"]'),
    priceCents: cents(offerRecord.price) ?? cents(textMeta('meta[property="product:price:amount"]', '[itemprop="price"]')),
    currency: "USD",
    stockStatus,
    sellerName: stringValue(offerRecord.seller) ?? brand,
    capturedAt: new Date().toISOString(),
    captureMode: "USER_TRIGGERED_LOCAL_PAGE"
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "POKEDAD_CAPTURE_VISIBLE_SIGNAL") return false;
  try {
    sendResponse({ ok: true, signal: capture() });
  } catch (error) {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : "CAPTURE_FAILED" });
  }
  return false;
});
