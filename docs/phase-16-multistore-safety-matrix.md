# Phase 16 - Multi-Store Adapter Research + Safety Matrix

## Purpose

Phase 16 creates a conservative safety matrix for future store adapters. It does not add live scanners, scraping, browser automation, cart actions, checkout, or purchase automation.

The matrix is used to decide whether a store can move toward a future read-only adapter or must remain manual/open-only.

## Conservative Classification Rules

Stores are classified conservatively:

- Prefer official/public API documentation.
- Treat unknown API access as `RESEARCH_PENDING`.
- Treat high-demand queues, human checks, and anti-bot controls as blockers.
- Do not use scraper APIs or browser automation as adapter approval.
- Do not store retailer credentials, cookies, sessions, payment data, card data, or CVV.
- Do not bypass CAPTCHA, queues, waiting rooms, rate limits, anti-bot protections, login protections, or purchase limits.

## Recommended Modes

- `OFFICIAL_API_CANDIDATE`: official or clearly allowed read-only API path exists, but still requires configuration, terms review, rate limits, and audit controls.
- `MANUAL_OPEN_ONLY`: keep manual launch/open-product behavior only.
- `RESEARCH_PENDING`: more official-source review is needed before any adapter design.
- `MOCK_ONLY`: use local demo/mock behavior only.
- `BLOCKED_FOR_AUTOMATION`: do not automate unless an explicit approved pathway exists.

## Risk Levels

- `LOW`: official read-only API candidate with clear product/price/availability support.
- `MEDIUM`: official APIs exist, but use case or compliance scope needs review.
- `HIGH`: automation, queue, or protection concerns are significant.
- `UNKNOWN`: no confirmed official consumer availability pathway.

## Store Matrix

| Store | Current status | Official API found | Search | Lookup | Price | Availability | Seller filtering | Mode | Risk | Next safe step |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| Best Buy | `APPROVAL_PENDING` | Yes | Yes | Yes | Yes | Yes | Yes | `OFFICIAL_API_CANDIDATE` | `LOW` | Wait for approval/key, restart API, readiness check, one controlled read-only scan. |
| Target | `MANUAL_ONLY` | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | `BLOCKED_FOR_AUTOMATION` | `HIGH` | Keep manual/open-only until explicit approved pathway exists. |
| Walmart | `RESEARCH_ONLY` | Yes | Unknown | Unknown | Unknown | Unknown | Unknown | `RESEARCH_PENDING` | `MEDIUM` | Review developer/API terms for permitted consumer restock use. |
| GameStop | `RESEARCH_ONLY` | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | `RESEARCH_PENDING` | `UNKNOWN` | Search for official developer or affiliate product feed access. |
| Pokemon Center | `MANUAL_ONLY` | Unknown | Unknown | Unknown | Unknown | Unknown | Yes | `MANUAL_OPEN_ONLY` | `HIGH` | Keep manual launch links; do not bypass queues/human checks. |
| Amazon | `RESEARCH_ONLY` | Yes | Yes | Yes | Yes | Unknown | Unknown | `RESEARCH_PENDING` | `MEDIUM` | Review Product Advertising API eligibility and official-seller constraints. |
| Costco | `RESEARCH_ONLY` | Unknown | Unknown | Unknown | Unknown | Unknown | Yes | `RESEARCH_PENDING` | `UNKNOWN` | Research official partner/product feed options; do not scrape. |
| Sam's Club | `RESEARCH_ONLY` | Yes | Unknown | Unknown | Unknown | Unknown | Unknown | `RESEARCH_PENDING` | `UNKNOWN` | Review whether advertising/catalog APIs permit read-only restock use. |
| BJ's | `RESEARCH_ONLY` | Unknown | Unknown | Unknown | Unknown | Unknown | Yes | `RESEARCH_PENDING` | `UNKNOWN` | Research official API/partner access; keep manual/open-only. |
| Barnes & Noble | `RESEARCH_ONLY` | Unknown | Unknown | Unknown | Unknown | Unknown | Yes | `RESEARCH_PENDING` | `UNKNOWN` | Research official feeds or affiliate APIs; keep manual/open-only. |
| Dick's Sporting Goods | `RESEARCH_ONLY` | Unknown | Unknown | Unknown | Unknown | Unknown | Yes | `RESEARCH_PENDING` | `UNKNOWN` | Research official developer, affiliate, or product feed access. |
| Ace Hardware | `RESEARCH_ONLY` | Unknown | Unknown | Unknown | Unknown | Unknown | Yes | `RESEARCH_PENDING` | `UNKNOWN` | Research official product sync/feed partner options. |

## Store-by-Store Notes

### Best Buy

Sources: [Best Buy Developer Portal](https://developer.bestbuy.com/), [Best Buy APIs](https://developer.bestbuy.com/apis), [Best Buy API documentation](https://bestbuyapis.github.io/api-documentation/), [Best Buy API legal](https://developer.bestbuy.com/legal).

Best Buy is the first official API candidate because the Products API documents product catalog, pricing, availability, specifications, descriptions, and images. PokeDad Radar still keeps it gated by approval/key readiness and read-only controls.

### Target

Source: [Target Terms & Conditions](https://www.target.com/c/terms-conditions/-/N-4sr7l).

Target remains blocked for automation/manual-open-only until an explicit approved pathway exists. No Target scanner, scraping, or browser automation should be added.

### Walmart

Sources: [Walmart Developer Portal](https://developer.walmart.com/), [Walmart Marketplace APIs](https://developer.walmart.com/us-marketplace/docs/introduction-to-marketplace-apis).

Walmart APIs exist, but the visible developer docs are marketplace/supplier oriented. Consumer restock usage needs compliance review before any adapter.

### GameStop

No official public consumer product availability API is configured for this project. Keep research-only and do not scrape.

### Pokemon Center

Sources: [Pokemon Center Terms of Use](https://www.pokemoncenter.com/terms-of-use), [Pokemon Center Virtual Queue](https://support.pokemoncenter.com/hc/en-us/articles/37286495522452-Pok%C3%A9mon-Center-Virtual-Queue).

Pokemon Center remains manual/open-only. Queues, waiting rooms, purchase limits, and human checks must never be bypassed.

### Amazon

Source: [Amazon Product Advertising API](https://webservices.amazon.com/paapi5/documentation/).

Amazon has official APIs, but Product Advertising API access, display rules, rate limits, and seller/source filtering need review. No Amazon scanner in this phase.

### Costco

No confirmed official consumer product availability API is configured. Keep research-only and do not scrape.

### Sam's Club

Sources: [Sam's Club Advertising Partners Overview](https://developer.samsclub.com/API/overview/), [Catalog Item Search](https://developer.samsclub.com/API/catalog-item-search/).

Sam's Club APIs appear advertising/catalog oriented. Consumer restock availability use is not confirmed.

### BJ's

No confirmed official consumer product availability API is configured. Keep research-only and do not scrape.

### Barnes & Noble

No confirmed public product availability API is configured. Keep research-only and do not scrape.

### Dick's Sporting Goods

Source: [DICK'S Sporting Goods developer page](https://www.dickssportinggoods.com/services/developer).

No confirmed public consumer product availability API is configured for this project.

### Ace Hardware

No confirmed public consumer product availability API is configured. Keep research-only and do not scrape.

## Why Live Adapters Are Not Added

This phase is intentionally documentation, safety review, and UI visibility only. A future adapter requires confirmed official/allowed access, terms review, rate-limit review, and secret handling before implementation.

## Future Adapter Readiness Checklist

1. Official API or explicitly allowed public access confirmed.
2. Terms reviewed.
3. Rate limits reviewed.
4. Authentication requirements reviewed.
5. No credential/session/cookie storage needed.
6. Read-only availability/price lookup supported.
7. No CAPTCHA/queue/purchase-limit bypass.
8. Manual/Open Product only.
9. Secret storage plan defined if API key is needed.
10. Audit/log sanitization confirmed.

## Safety Policy

No checkout automation, auto-purchase, add-to-cart, retailer-page automation, scraping, CAPTCHA bypass, queue bypass, waiting-room bypass, rate-limit bypass, login-protection bypass, purchase-limit bypass, retailer credential/session/cookie storage, payment data storage, card data storage, or CVV storage.
