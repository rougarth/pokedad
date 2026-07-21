# Phase 4 Store Adapters

Phase 4 adds the safe store adapter framework and the first read-only adapter candidate for Best Buy. The goal is to learn how official store data can flow into PokeDad Radar without changing the private-use, human-in-the-loop safety posture.

## Goals

- Create a reusable adapter contract for store product search, product lookup, price checks, availability checks, and open-product/open-cart URLs.
- Register store adapters through a safety-checked registry.
- Implement Best Buy using official/public developer API support only.
- Keep cart assist open-only/manual.
- Show adapter status and test results in the dashboard.
- Audit adapter checks and errors without logging secrets.

## Allowed Behavior

- Use official/public APIs where the retailer permits read-only product and availability access.
- Search products, look up SKUs, read price fields, read availability fields, and show official product URLs.
- Normalize read-only results into PokeDad Radar product/live-find candidate shapes.
- Open a retailer product page or cart page in the user's browser.
- Stop and report manual action states such as CAPTCHA, queue, waiting room, login challenge, or human check.

## Blocked Behavior

- Checkout automation.
- Auto-purchase or payment submission.
- CAPTCHA, queue, waiting-room, rate-limit, anti-bot, login-protection, or purchase-limit bypass.
- Retailer credential, password, cookie, session, card, CVV, or payment data storage.
- Scraping or automated access where an official/approved read-only path is not available.
- Target automation in Phase 4.

## Store Adapter Safety Rules

- Adapters may only expose read-only and open-only capabilities.
- Blocked capabilities are shown in the UI but cannot be registered as active adapter capabilities.
- Adapter configuration may include API keys, but secrets must remain in environment variables or the encrypted secret abstraction.
- Audit logs must redact passwords, tokens, cookies, authorization headers, session values, card data, CVV, and payment fields.
- Any future detection of CAPTCHA, queue, waiting room, login challenge, or purchase limit must return a manual-action status instead of trying to continue.

## Per-Store Status

| Store | Phase 4 status |
| --- | --- |
| Best Buy | Official/public product API research/read-only candidate. |
| Target | Research only, blocked for automation until an explicit approved pathway exists. |
| Pokemon Center | Manual/open-only for now. |
| Walmart | Research only. |
| GameStop | Research only. |
| Sam's Club | Research only. |
| Costco | Research only. |
| BJ's | Research only. |
| Amazon | Official seller/manual/open-only for now. |
| Barnes & Noble | Research only. |
| Dick's Sporting Goods | Research only. |
| Ace Hardware | Research only. |

## Why Best Buy Is First

Best Buy is first because its developer site documents public APIs for Products, Stores, Categories, and related data. The Product API documentation describes catalog data that includes pricing, availability, descriptions, and images, which matches Phase 4's read-only adapter goals.

References:

- https://developer.bestbuy.com/apis
- https://bestbuyapis.github.io/api-documentation/

## Why Target Is Not Implemented Yet

Target remains research-only in Phase 4. No Target adapter will be added until there is an explicit approved pathway for read-only product and availability access. The project will not scrape Target pages, automate login, interact with carts, or attempt to work around protections.

## Future Store Review Checklist

- Is there an official/public API or documented approved partner path?
- Do the terms permit the intended private read-only use?
- Are rate limits and attribution requirements documented?
- Can the adapter run without storing retailer credentials, cookies, or sessions?
- Can product search, SKU lookup, price, and availability be read without browser automation?
- What manual-action states must be surfaced to the user?
- What data may be persisted, and what data must never be logged?
- Does the adapter avoid checkout, purchase, queue bypass, CAPTCHA bypass, and purchase-limit bypass?
