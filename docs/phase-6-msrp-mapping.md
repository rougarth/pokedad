# Phase 6 MSRP Mapping

Phase 6 adds an MSRP mapping workflow for scanned Pokemon TCG products that do not yet have a known MSRP/category match.

## Goal

Turn `UNKNOWN_MSRP` scan results into mapped products so future scans can apply fair-price rules, suppress bad alerts, and create better accepted-price alerts.

## Workflow

1. A read-only scan finds a product.
2. If the product cannot be priced against known MSRP/category rules, PokeDad Radar creates or refreshes an MSRP mapping candidate.
3. The keyword matcher suggests a category when possible.
4. The user can accept the suggestion, choose another category, ignore the product, or mark it needs review.
5. When mapped, related stock checks are recalculated.
6. If the recalculated price is accepted, an alert event can be created unless duplicate suppression blocks it.

## Mapping Statuses

- `UNMAPPED`: No suggestion or category has been accepted yet.
- `SUGGESTED`: The keyword matcher found a likely category.
- `MAPPED`: The user accepted or manually chose a category.
- `IGNORED`: The product should not be mapped or alerted.
- `NEEDS_REVIEW`: The product is unclear and needs manual review.

## Confidence Values

- `LOW`
- `MEDIUM`
- `HIGH`
- `MANUAL`

`MANUAL` is used when the user chooses a category.

## Keyword Suggestion Rules

- `pokemon center elite trainer box`, `pokemon center etb` -> Pokemon Center ETB
- `booster bundle` -> Booster Bundle
- `elite trainer box`, `etb` -> Elite Trainer Box
- `ultra premium collection`, `upc` -> UPC
- `collection box` -> Collection Box
- `premium collection` -> Premium Collection
- `mini tin` -> Mini Tin
- `tin` -> Tin
- `sleeved booster` -> Sleeved Booster
- `booster box` -> Booster Box

The matcher is local, keyword-based, and intentionally transparent. No external AI service is used.

## Alert Impact

Unknown MSRP products do not create urgent accepted-price alerts unless the scan setting `Alert on unknown MSRP` is enabled.

After a product is mapped:

- related stock checks get MSRP and accepted max price values
- price status is recalculated
- accepted products can create local `AlertEvent` records
- duplicate alert suppression avoids repeating alerts for the same product/price/state inside the cooldown window

## Limitations

- The matcher is simple and can miss vague product names.
- Mapping is user-reviewed; automatic suggestions are not treated as final.
- Real Telegram/Discord delivery is still future work.

## Safety Rules

- No checkout automation.
- No auto-purchase.
- No add-to-cart.
- No CAPTCHA, queue, waiting-room, rate-limit, anti-bot, login-protection, or purchase-limit bypass.
- No retailer credentials, passwords, cookies, sessions, payment data, card data, CVV, or retailer session data are stored.
- Store behavior remains open-product/open-cart/manual only.
