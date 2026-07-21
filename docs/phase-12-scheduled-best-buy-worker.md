# Phase 12: Scheduled Best Buy Read-Only Worker

## Goal

Phase 12 adds a conservative scheduler around the existing official Best Buy Products API adapter. It persists scan state, uses Redis for a distributed lease, applies the existing MSRP and price rules, and sends accepted-price alerts through enabled channels.

## Safety Defaults

- The scheduler is disabled by default.
- Scheduled intervals are clamped to at least 30 minutes.
- Only one scheduled scan may hold the per-user Redis lease.
- Existing API-call delays, result limits, duplicate cooldowns, official-seller rules, and sealed-product filters remain active.
- A missing or unapproved `BEST_BUY_API_KEY` produces `CONFIGURATION_NEEDED` without a Best Buy request.
- Redis failure produces `REDIS_UNAVAILABLE`; the worker does not scan without its distributed lease.
- No aggressive retry is performed.

## Enable and Monitor

1. Add an approved key to `.env` and `apps/api/.env`.
2. Restart the API.
3. Run one successful manual read-only scan first.
4. Open **Scan Settings**.
5. Confirm an interval of at least 1800 seconds and enable the scheduler.

The page reports the worker status, last tick, last scheduled scan, next run, latest result, and sanitized error. API endpoints are:

- `GET /adapters/best-buy/scheduler-status`
- `POST /adapters/best-buy/enable-scheduler`
- `POST /adapters/best-buy/disable-scheduler`

## Alerts and History

Scheduled scans reuse the Phase 10 mobile alert templates. Accepted products create alert events, duplicate cooldown remains enforced, and delivery attempts appear in Notification History. Unknown MSRP alerts and scan-failure alerts remain controlled by their existing settings.

## Current Approval State

Best Buy can restrict a newly issued key while its developer application is pending. Keep the scheduler disabled until the dashboard confirms API access approval. PokeDad Radar never attempts to bypass this restriction.

## Prohibited Behavior

Phase 12 does not scrape BestBuy.com, use undocumented endpoints, automate a browser, add to cart, checkout, purchase, store retailer credentials or sessions, or bypass CAPTCHA, queues, waiting rooms, rate limits, login controls, or purchase limits. Product actions remain Open Product only.
