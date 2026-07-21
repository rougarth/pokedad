# Phase 17 - Manual Store Watchlist + Retailer Launch Links

## Goal

Phase 17 adds a manual store watchlist for saving retailer product, search, category, release, home, and custom links. It is a local link organizer and launch center, not a scanner.

## Manual-Only Behavior

Manual Store Links:

- store a user-provided URL
- display store safety warnings from the Store Safety Matrix
- can be attached to wishlist items
- can be opened manually by the user
- record `lastOpenedAt` and `openCount`

The backend never fetches retailer URLs, scrapes pages, checks availability, checks price, adds to cart, or automates checkout.

## Supported Link Types

- `PRODUCT`
- `SEARCH`
- `CATEGORY`
- `RELEASE_PAGE`
- `STORE_HOME`
- `CUSTOM`

## Wishlist Relation

A manual link can be attached to a wishlist item. The Wishlist page shows related manual links so a priority product can have quick launch references such as Target search, Costco search, Pokemon Center release page, or Best Buy search.

## Store Safety Matrix Relation

Every link inherits:

- safety mode
- risk level
- warning message

Examples:

- Target: blocked for automation; manual/open-only.
- Pokemon Center: manual/open-only; queues and human verification must be handled manually.
- Costco, Sam's Club, BJ's: research pending; manual tracking only.
- Best Buy: API approval pending; manual links can be saved while live scans remain paused.

## Manual Purchase Assist

Manual Purchase Assist can show related retailer links for a product or wishlist match. Opening a related link is still manual and only increments local open tracking.

## No Scanning / No Scraping Policy

This phase adds no live scanners and makes no retailer requests from the backend.

Blocked:

- checkout automation
- auto-purchase
- add-to-cart
- browser automation
- scraping
- CAPTCHA, queue, waiting-room, anti-bot, login-protection, rate-limit, or purchase-limit bypass
- retailer credential, password, cookie, session, payment, card, or CVV storage

## Future Roadmap

Future adapters still require an official or explicitly allowed read-only pathway, terms review, rate-limit review, secret storage review, and audit/log sanitization before implementation.
