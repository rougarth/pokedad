# PokeDad Radar Product Requirements

## Purpose

PokeDad Radar is a private Pokemon TCG restock dashboard and cart-assist tool for one household. It helps identify sealed Pokemon TCG products at fair prices from major retailers, alerts the owner quickly, and helps open the correct retailer page or cart so the owner can finish checkout manually.

The system is not a scalper bot, not an auto-checkout bot, and not a tool for bypassing retailer protections. It must stop and notify the owner whenever a retailer requires CAPTCHA, a queue, a waiting room, a login challenge, MFA, a purchase-limit decision, or any other human action.

## Target User

- Primary user: a parent buying sealed Pokemon TCG products at fair prices for a child.
- Initial deployment: private local/self-hosted use.
- Future option: community alerts or SaaS users, provided retailer rules, privacy, and human-in-the-loop controls remain intact.

## In Scope

- Secure dashboard login.
- Product watch rules for sealed Pokemon TCG products.
- Store-level monitoring settings and session status tracking.
- Price acceptability rules by global default, store, category, and product.
- Live finds table with stock, seller, price, alert, and cart-assist status.
- Alert channels for Telegram, Discord webhook, SMS, email, and browser notifications.
- Browser extension or local helper for:
  - Opening product pages.
  - Opening cart pages.
  - Attempting add-to-cart only where allowed and safe.
  - Stopping on human checks, anti-bot checks, queues, login challenges, and purchase limits.
- Audit logs that describe actions without storing sensitive session or payment data.

## Explicitly Out Of Scope

- Automatic checkout.
- Storing credit card numbers, CVV, full payment details, retailer passwords, cookies, or retailer session tokens in the backend.
- Bypassing CAPTCHA, queues, waiting rooms, bot defenses, MFA, purchase limits, rate limits, or retailer rules.
- Buying from third-party sellers by default.
- Marketplace scalper listings.
- Used/open box products.
- Singles or loose cards unless manually added later as a different product class.

## Supported Product Categories

- Elite Trainer Boxes
- Pokemon Center ETBs
- Booster Bundles
- Booster Boxes
- Collection Boxes
- Premium Collections
- Ultra Premium Collections
- Mini Tins
- Tins
- Sleeved Boosters
- New release sealed products

## Store Coverage Targets

MVP store records should include:

- Target
- Best Buy
- Pokemon Center
- Walmart
- GameStop
- Sam's Club
- Costco
- BJ's
- Amazon, official seller only
- Barnes & Noble
- Dick's Sporting Goods
- Ace Hardware

Store adapters should be added one at a time. Each adapter must document whether it uses public pages, official feeds/APIs, browser-only checks, or manual-only flows.

## Core User Flow

1. The owner opens the dashboard.
2. The backend schedules safe monitor checks for enabled stores and products.
3. The system records stock, seller, price, category, and skip reasons.
4. Price rules decide whether the find is acceptable.
5. If acceptable, alerts are sent.
6. If cart assist is enabled and safe for that store, the browser helper opens or attempts an add-to-cart action through the already logged-in browser session.
7. The helper stops on CAPTCHA, queue, login/MFA, human verification, purchase limit, or unexpected anti-bot signals.
8. The owner manually finishes checkout on the retailer website.

## Status Definitions

### Store Session Status

- `LOGGED_IN`
- `NOT_LOGGED_IN`
- `LOGIN_EXPIRED`
- `HUMAN_CHECK_NEEDED`
- `QUEUE_OR_WAITING_ROOM`
- `UNKNOWN`

### Cart Assist Status

- `NOT_ATTEMPTED`
- `PRODUCT_FOUND`
- `PRICE_ACCEPTED`
- `ADD_TO_CART_ATTEMPTED`
- `CART_READY`
- `LOGIN_REQUIRED`
- `HUMAN_CHECK_REQUIRED`
- `QUEUE_DETECTED`
- `CAPTCHA_DETECTED`
- `SOLD_OUT`
- `PRICE_CHANGED`
- `FAILED`
- `SKIPPED`

## Skip Reasons

- Third-party seller not approved.
- Marketplace listing.
- Used/open box.
- Singles or loose cards.
- Price above accepted maximum.
- Suspicious product title, seller, or listing metadata.
- Human verification detected.
- Queue/waiting room detected.
- Purchase limit requires manual decision.
- Store adapter disabled.

## MVP Success Criteria

- The app can run locally with a dashboard, API, PostgreSQL, and Redis.
- The owner can manage store records, watch rules, price rules, alert channels, and history.
- Stock results can be ingested through a safe mock/manual adapter before real store adapters are added.
- The price engine correctly accepts or rejects finds by global, store, category, and product rules.
- Sensitive alert tokens are encrypted at rest.
- The backend never stores retailer credentials, cookies, session tokens, or payment data.
- Cart assist is represented as a human-in-the-loop workflow with stop states.

