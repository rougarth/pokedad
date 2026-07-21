# Phase 18 - Manual Release Calendar + Launch Reminders

## Goal

Phase 18 adds a manual release calendar for Pokemon TCG sets and products. It helps track release dates, attach wishlist items and manual store links, and send dashboard/Discord reminders before release.

This is not a scanner, scraper, auto-buy tool, cart tool, checkout flow, or retailer automation system.

## Release Items

Release calendar items track:

- title
- set name
- product name
- product category
- release date/time
- timezone
- priority
- status
- wishlist relation
- related manual store links
- reminder offsets
- Discord reminder enabled/disabled
- notes
- active/inactive

Statuses:

- `PLANNED`
- `UPCOMING`
- `RELEASED`
- `WATCHING`
- `BOUGHT`
- `SKIPPED`
- `CANCELED`

Priorities:

- `LOW`
- `NORMAL`
- `HIGH`
- `URGENT`

## Reminder Offsets

Supported reminder offsets:

- `SEVEN_DAYS` - 7 days before
- `THREE_DAYS` - 3 days before
- `ONE_DAY` - 1 day before
- `TWELVE_HOURS` - 12 hours before
- `ONE_HOUR` - 1 hour before
- `AT_RELEASE` - at release time

Phase 18 calculates and displays the next reminder time. It also supports manually sending a test reminder through the existing encrypted alert delivery pipeline.

## Discord Reminder Behavior

Test reminders are clearly marked:

```text
TEST RELEASE REMINDER - PokeDad Radar
```

Reminder messages include the release title, set/product, release date, priority, related wishlist item, and attached manual links. They also state:

```text
Reminder only - no retailer request was made.
```

Discord delivery reuses the existing encrypted webhook/OAuth channel. Webhook URLs and tokens are never returned to the frontend or written to audit logs.

## Wishlist Integration

Wishlist items can be attached to release calendar entries. The Wishlist page shows related release items with release time and priority context.

## Manual Store Links Integration

Release calendar entries can attach multiple Manual Store Links. Opening a related link remains manual:

1. The API records `lastOpenedAt` and increments `openCount`.
2. The frontend opens the URL in a new tab.
3. The backend does not fetch, scrape, scan, or inspect the retailer URL.

## Notification History

Release reminders create `AlertEvent` records with:

- `RELEASE_REMINDER`
- `TEST_RELEASE_REMINDER`

Notification History shows the reminder title, priority, status, delivery attempts, sanitized errors, and message preview. It does not expose secrets.

## Walmart Verification

Walmart remains research/manual-only:

- Store Safety Matrix includes Walmart as `RESEARCH_PENDING / MEDIUM`.
- Manual Store Links seed includes a Walmart Pokemon cards search link.
- Manual Store Links can filter by Walmart.
- Wishlist store preference can reference Walmart and shows the research-only warning.
- Release Calendar items can attach Walmart manual links.
- Manual Purchase Assist can show Walmart related manual links when attached through wishlist/manual links.
- No Walmart scanner, scraper, cart, checkout, or add-to-cart automation exists.

## Safety Rules

- No live retailer scanning.
- No retailer scraping.
- No backend fetch of retailer URLs.
- No browser automation.
- No add-to-cart.
- No checkout automation.
- No auto-purchase.
- No CAPTCHA, queue, waiting room, login-protection, rate-limit, anti-bot, or purchase-limit bypass.
- No retailer credentials, passwords, cookies, sessions, payment data, card data, or CVV storage.
- Retailer behavior remains manual/open-only.

## Local Runbook

```powershell
cd C:\Users\gbrie\Documents\Playground\poke-dad-radar
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
```

Open `Release Calendar`, create or edit a manual release, attach wishlist/manual links, and use `Test reminder` to send a marked test reminder to enabled alert channels.
