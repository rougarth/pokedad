# Phase 20 - Local Analytics Dashboard

## Goal

Phase 20 adds a private local Analytics page for understanding purchase decisions, spend, wishlist progress, release coverage, manual link activity, alert delivery outcomes, and MSRP mapping state.

This is local/private analytics only:

- no external analytics service
- no tracking pixels
- no third-party data sharing
- no retailer URL fetching by the backend

## Data Sources

Analytics are derived from existing local PostgreSQL tables:

- `PurchaseDecision`
- `StockCheckResult`
- `WishlistItem`
- `ManualStoreLink`
- `ReleaseCalendarItem`
- `AlertEvent`
- `AlertDelivery`
- `ProductMSRPMapping`
- `ActionItemState`

No analytics-specific tracking table is created. Phase 20 only adds audit enum values for sanitized analytics view/export logging.

## Spending Calculations

Spending uses only explicit purchase decision data:

```text
line total = finalPriceCents * quantity
```

If `finalPriceCents` is missing, the product is listed as missing final price. The app does not guess spend from current price.

Calculated views include:

- total spend
- spend this week
- spend this month
- spend by store
- spend by set
- spend by category
- average item price
- highest purchase
- bought vs skipped ratio

## Wishlist Progress

Wishlist progress compares desired quantity with bought quantity inferred from matching purchase decisions and local metadata. It also shows:

- priority
- alert behavior
- related releases
- related manual links
- last alert
- last manual link open

## Release Coverage

Release coverage highlights whether each release has:

- a wishlist item
- manual store links
- Discord reminders enabled
- reminder offsets

Coverage warnings include:

- `NO_WISHLIST_ITEM`
- `NO_MANUAL_LINKS`
- `NO_REMINDER`
- `URGENT_NO_LINKS`

## Manual Link Activity

Manual link analytics use only stored local metadata:

- open count
- last opened time
- store
- link type
- safety/risk mode
- wishlist attachment
- release calendar attachment

The backend never fetches, scans, or validates retailer URLs.

## Alert Analytics

Alert analytics summarize:

- alerts created
- sent
- failed
- suppressed
- Discord deliveries sent
- mock/demo/test alerts
- accepted-price alerts
- release reminders
- unknown MSRP alerts
- scan/config alerts

Secrets, webhook URLs, tokens, API keys, and auth headers are never included.

## CSV Exports

Implemented exports:

- `GET /analytics/export/bought.csv`
- `GET /analytics/export/skipped.csv`

Exports include product/decision fields only. They do not include secrets, tokens, webhooks, API keys, cookies, sessions, auth headers, payment data, card data, or CVV.

## Mock/Demo Labeling

Analytics flags mock/demo/test records using existing local metadata and alert message/title markers. Current demo-heavy data is clearly labeled as `MOCK/DEMO` in purchase tables.

## Safety Policy

- No live retailer scanning.
- No scraping.
- No backend retailer URL fetches.
- No browser automation.
- No add-to-cart.
- No checkout automation.
- No auto-purchase.
- No CAPTCHA, queue, waiting room, login-protection, rate-limit, anti-bot, or purchase-limit bypass.
- No retailer credentials, passwords, cookies, sessions, payment data, card data, or CVV storage.

Retailer behavior remains manual/open-only.
