# Phase 15 - Product Wishlist + Priority Rules

## Goal

Phase 15 adds a private wishlist layer so PokeDad Radar can rank Pokemon TCG finds before more stores are researched or connected.

The wishlist answers:

- which products and sets are urgent
- which products can alert Discord
- which products should stay dashboard-only
- which listings should be ignored
- which price caps are acceptable above MSRP

This phase does not add any retailer scanner, scraping, cart automation, checkout automation, or purchase automation.

## Wishlist Items

Wishlist items support:

- product name
- set name
- MSRP category
- optional store preference
- priority
- desired quantity
- max acceptable price
- allowed markup
- alert behavior
- keywords
- notes
- active/inactive state

Priority values:

- `LOW`
- `NORMAL`
- `HIGH`
- `URGENT`
- `IGNORE`

Alert behavior values:

- `ALERT_IMMEDIATELY`
- `DASHBOARD_ONLY`
- `DO_NOT_ALERT`
- `REVIEW_FIRST`

## Seeded Set Tracking

The seed includes editable set-tracking examples:

- Prismatic Evolutions
- Journey Together
- Surging Sparks
- Twilight Masquerade
- Temporal Forces
- Paldean Fates
- 151
- Crown Zenith
- Obsidian Flames
- Scarlet & Violet
- Sword & Shield

These are local wishlist records. No external Pokemon or retailer API is used.

## Matching Logic

Wishlist matching is local and transparent. It checks:

- product name keywords
- set name keywords
- category match
- store key match
- SKU text when available

`IGNORE` and `DO_NOT_ALERT` rules suppress Discord delivery. `DASHBOARD_ONLY` and `REVIEW_FIRST` keep products visible in the dashboard without sending Discord alerts.

## Mock Scan Examples

Mock Scan Mode now demonstrates:

- Prismatic Evolutions Booster Bundle -> urgent accepted
- Pokemon Center ETB -> urgent accepted
- Random Collection Box -> dashboard-only normal
- Unknown Pokemon Product -> MSRP mapping needed
- Loose/single-card marketplace-like listing -> ignored

Every mock result remains labeled:

```text
MOCK / DEMO - no retailer request was made
```

Best Buy request count remains `0`.

## Alerts

Accepted mock products may create clearly marked test/mock alert events when the matching wishlist rule allows alerts.

Ignored products do not trigger Discord. Dashboard-only products remain visible in Live Finds but do not trigger Discord.

## Future Multi-Store Use

The wishlist layer is store-agnostic. Future read-only adapters can reuse the same matching service after each store has been reviewed for an official or clearly allowed data path.

## Safety Rules

- No checkout automation.
- No auto-purchase.
- No add-to-cart.
- No browser automation.
- No CAPTCHA, queue, waiting-room, rate-limit, login-protection, or purchase-limit bypass.
- No retailer credential, session, or cookie storage.
- No payment/card/CVV storage.
- No scraping of Best Buy, Target, Costco, Sam's Club, BJ's, Walmart, GameStop, Pokemon Center, Amazon, or any retailer.
- Store behavior remains read-only and Open Product only.
