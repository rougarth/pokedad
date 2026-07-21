# Phase 25: User-Triggered Local Real Signals

## Scope

PokeDad Radar can capture a product observation from a BJ's, Costco, Sam's Club, or Walmart page that the user has already opened. This is not a crawler or scheduled scraper. The extension reads the current tab only after `Capture Current Page` is clicked, displays a preview, and persists only after `Save Signal` is confirmed.

## Data captured

- Store, product name, current URL, image URL, SKU when present.
- Visible or structured price and availability at capture time.
- Seller/brand metadata when present.
- Capture timestamp and the explicit `LOCAL_BROWSER_CAPTURE` source.

Signals are observations, not guarantees. Prices and stock can change before the retailer page is reopened.

## Safety behavior

- Supported domains are restricted in the extension manifest and validated again by the API.
- CAPTCHA, queue, human-verification, and login-challenge text stops capture.
- The backend never fetches the retailer URL.
- No background page navigation, polling, scheduled capture, login automation, cookies, sessions, cart, checkout, or purchase action exists.
- Helper requests require a strong local shared token and are rate limited.
- New products enter `UNKNOWN_MSRP` and the existing MSRP Mapping workflow suggests a category.

## Why no server scraper

The reviewed Walmart APIs are intended for Marketplace sellers/suppliers and do not establish a general consumer restock API. No suitable official consumer availability API has been confirmed for BJ's, Costco, or Sam's Club. Until explicit permission or an official API is confirmed, these stores remain user-triggered local capture only.

## Extension setup

1. Run `npm run build -w @pokedad-radar/extension`.
2. Open `chrome://extensions`, enable Developer mode, and load `apps/extension/dist` as the unpacked extension.
3. In Connection settings, enter the PokeDad Radar public URL and the private `HELPER_SHARED_TOKEN` from the server environment.
4. Open a supported product page, click the extension, then `Capture Current Page`.
5. Review the preview and click `Save Signal`.

Never share or display the helper token. Reload the extension after code updates.
