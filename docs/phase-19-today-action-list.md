# Phase 19 - Today's Action List + Deal Review Dashboard

## Goal

Phase 19 adds a daily action dashboard that combines the existing local/private data:

- Wishlist priorities
- Release Calendar items
- Manual Store Links
- Mock/demo finds
- Notification History
- Purchase Decisions
- Snoozed/skipped/bought state
- MSRP Mapping needs

This is a review dashboard only. It does not scan retailers, scrape pages, fetch retailer URLs from the backend, add to cart, check out, auto-purchase, or automate browser/store pages.

## Action Item Types

Implemented derived action item types:

- `RELEASE_TODAY`
- `RELEASE_SOON`
- `WISHLIST_PRIORITY`
- `MANUAL_LINK_CHECK`
- `MOCK_FIND_REVIEW`
- `MSRP_MAPPING_NEEDED`
- `PURCHASE_DECISION_NEEDED`
- `SNOOZE_EXPIRED`
- `ALERT_REVIEW`
- `BOUGHT_RECENTLY`
- `SKIPPED_RECENTLY`

Local state statuses:

- `OPEN`
- `IN_PROGRESS`
- `DONE`
- `SNOOZED`
- `DISMISSED`

The action items are derived from existing models. Only local item state is persisted in `ActionItemState`.

## Ranking Logic

The ranking is conservative and manual-first:

1. Release today plus urgent/high priority.
2. Accepted/high-priority product needing manual decision.
3. MSRP mappings needing review.
4. Upcoming release within 7 days.
5. Manual links tied to urgent/high wishlist priorities.
6. Snoozed items returning soon.
7. Recent alerts and reminders.
8. Normal manual review items.

`IGNORE` wishlist/manual items are not surfaced in the normal action list.

## Integrations

The dashboard reads from:

- `ReleaseCalendarItem`
- `WishlistItem`
- `ManualStoreLink`
- `ProductMSRPMapping`
- `StockCheckResult`
- `AlertEvent`
- `PurchaseDecision`

Opening a manual link from Today uses the same safe open tracking pattern:

1. API records `lastOpenedAt` and increments `openCount`.
2. Frontend opens the link in a new tab.
3. Backend does not fetch the retailer URL.

## API

Endpoints:

- `GET /today`
- `GET /today/summary`
- `POST /today/items/:id/dismiss`
- `POST /today/items/:id/snooze`
- `POST /today/items/:id/mark-done`
- `POST /today/manual-links/:id/opened`

All endpoints require dashboard authentication.

## Daily Use

1. Open `Today's Action List`.
2. Review top summary cards.
3. Start with `Urgent Today`.
4. Open manual links yourself.
5. Make purchase decisions manually.
6. Mark items done, snooze them, or dismiss them.
7. Use related pages for MSRP mapping, Wishlist, Release Calendar, and Notification History details.

## Safety Policy

- No live retailer scanning.
- No scraping.
- No backend retailer URL fetches.
- No add-to-cart.
- No checkout automation.
- No auto-purchase.
- No browser automation against retailer pages.
- No CAPTCHA, queue, waiting room, login-protection, rate-limit, anti-bot, or purchase-limit bypass.
- No retailer credentials, passwords, cookies, sessions, payment data, card data, or CVV storage.

Retailer behavior remains manual/open-only.
