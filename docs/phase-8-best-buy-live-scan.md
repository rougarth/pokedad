# Phase 8: Controlled Best Buy Live Scan

## Goal

Phase 8 verifies one controlled, read-only scan through the official Best Buy Products API. It does not use browser automation, scraping, cart actions, checkout, or purchasing.

## Get an API key

1. Visit the official Best Buy Developer Portal: https://developer.bestbuy.com/
2. Use **Get API Key**, register, and follow the activation instructions.
3. Review the Best Buy Developer API terms and call limits before using the key.

The Products API provides catalog, pricing, availability, description, and image data. PokeDad Radar uses only read-only product search and lookup operations.

## Configure locally

Never paste the key into chat, source files, screenshots, or documentation.

Set the key locally in both files so workspace and Prisma/API commands use the same configuration:

```text
C:\Users\gbrie\Documents\Playground\poke-dad-radar\.env
C:\Users\gbrie\Documents\Playground\poke-dad-radar\apps\api\.env
```

Add or update:

```env
BEST_BUY_API_KEY="your-local-key"
```

Restart the API after changing either env file:

```powershell
cd C:\Users\gbrie\Documents\Playground\poke-dad-radar
npm run dev:api
```

The authenticated `GET /config/status` endpoint returns only:

```json
{ "bestBuyApiKeyConfigured": true }
```

It never returns the key.

## Controlled scan

1. Sign in at `http://127.0.0.1:5175`.
2. Open **Store Adapters**.
3. Confirm the Best Buy Developer API badge says **Configured**.
4. Review the conservative search terms and limits under **Scan Settings**.
5. Select **Run Scan Now** once.

The controlled terms are `pokemon cards`, `pokemon tcg`, `pokemon booster`, `pokemon elite trainer box`, and `pokemon booster bundle`. Keep result limits between 5 and 10 per query and retain a delay between calls. Do not repeatedly trigger the scan while its cooldown is active.

## Reading results

The latest-result summary reports start and finish time, duration, returned products, accepted products, over-limit products, unknown-MSRP products, new mapping candidates, alerts created, and duplicate alerts suppressed. Errors are sanitized.

Persisted results use:

- `RetailerProduct` for normalized Best Buy products
- `StockCheckResult` for price and availability observations
- `ProductMSRPMapping` for new unknown-MSRP candidates
- `AlertEvent` for qualifying non-suppressed alerts
- `AuditLog` for sanitized operational history

## Price and MSRP behavior

Known categories and accepted mappings apply their MSRP and maximum accepted price. Unknown products create or refresh an MSRP mapping candidate when auto-suggestion is enabled. Unknown-MSRP alerts remain disabled unless explicitly enabled in Scan Settings.

## Alert behavior

Accepted-price events respect the configured cooldown. Enabled Telegram and Discord channels receive eligible events when automatic delivery is enabled. If no supported channel is enabled, the scan remains successful and the local alert event remains available without provider delivery.

## Missing or invalid keys

- Blank key: the adapter reports `CONFIGURATION_NEEDED`; no Best Buy request runs.
- Invalid key or API rejection: the scan reports a sanitized failure without returning or logging the key.
- Rate-limited or duplicate scan: the scan stops conservatively and reports the next allowed time.
- No products: the scan succeeds with zero persisted results.

## Safety

- Official Best Buy Developer API only.
- No Target scraping or automation.
- No add-to-cart, checkout, payment, or auto-purchase.
- No CAPTCHA, queue, waiting-room, rate-limit, anti-bot, login-protection, or purchase-limit bypass.
- No retailer credentials, cookies, sessions, card data, CVV, or payment data storage.
