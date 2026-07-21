# Phase 5 Best Buy Scan Loop

Phase 5 adds a production-safe Best Buy scan loop and local alert pipeline. It uses the Phase 4 Best Buy read-only adapter only.

## Safety Scope

Allowed:

- Read-only Best Buy product searches through the official/public API.
- Product lookup, price checks, online availability, product URLs, and images.
- Persisting sanitized product, stock check, alert event, and audit records.
- Opening product pages and the static Best Buy cart URL for manual use.

Blocked:

- Checkout automation.
- Auto-purchase.
- Add-to-cart.
- Payment submission.
- CAPTCHA, queue, waiting-room, rate-limit, anti-bot, login-protection, or purchase-limit bypass.
- Retailer credential, password, cookie, session, card, CVV, or payment data storage.

## Configuration

Best Buy scan configuration is stored in `AppSetting` under `bestBuyScanConfig`.

Default search terms:

- pokemon cards
- pokemon tcg
- pokemon booster
- pokemon elite trainer box
- pokemon booster bundle
- pokemon collection box
- pokemon tin
- pokemon premium collection
- pokemon upc

The default scan interval is 30 minutes, with a minimum 1.5 second delay between API calls.

## Statuses

- `IDLE`
- `CONFIGURATION_NEEDED`
- `RUNNING`
- `SUCCEEDED`
- `FAILED`
- `RATE_LIMITED`
- `DISABLED`

Scan status is stored in `AppSetting` under `bestBuyScanStatus`.

## Rate Limiting

Manual scans are blocked when:

- A scan is already running.
- The scan is disabled.
- `BEST_BUY_API_KEY` is missing.
- The previous scan is still inside the configured scan interval.

The scan loop does not retry aggressively after API errors.

## Alert Behavior

Phase 5 creates local `AlertEvent` records for accepted prices, MSRP matches, and optionally unknown MSRP items when enabled.

Duplicate alert suppression uses:

- same Best Buy product/SKU
- same price
- same stock status
- same online availability state
- inside the configured cooldown window

Real Telegram, Discord, SMS, or email delivery is not implemented in Phase 5 unless a safe encrypted channel already exists. Alert events are persisted for the dashboard and future delivery workers.

## Running A Scan

```powershell
cd C:\Users\gbrie\Documents\Playground\poke-dad-radar
docker compose up -d
npm run dev:api
npm run dev:web
```

Then sign in and use:

- `Store Adapters` -> `Run Scan Now`
- `Live Finds` -> `Run Best Buy Scan Now`
- `Scan Settings` -> edit and save scan rules

The app works without `BEST_BUY_API_KEY`; scans return `CONFIGURATION_NEEDED` and create sanitized audit logs.
