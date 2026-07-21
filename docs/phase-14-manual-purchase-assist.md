# Phase 14: Manual Purchase Assist

## Goal

Phase 14 verifies the DB-backed mock scan path and adds a manual-only decision workflow for alerts and live finds. It helps track what happened after opening a product, without automating carts, checkout, retailer pages, or purchases.

## Manual-Only Workflow

The dashboard can now record:

- `NEW`
- `OPENED`
- `BOUGHT`
- `SKIPPED`
- `SNOOZED`
- `SOLD_OUT`
- `TOO_EXPENSIVE`
- `NOT_INTERESTED`
- `NEEDS_MAPPING`

These are local decision records. They do not interact with retailer carts, accounts, sessions, cookies, or payment flows.

## Actions

From Live Finds and Notification History, the user can:

- open the product page manually
- mark bought
- mark skipped
- mark too expensive
- mark already sold out
- mark not interested
- mark needs MSRP mapping
- snooze for 1 hour, 6 hours, 24 hours, 7 days, or a custom time
- unsnooze
- save a private note

## Bought And Skipped

Bought decisions can include optional quantity, final price, and private note.

Skipped decisions can include one of:

- `PRICE_TOO_HIGH`
- `SOLD_OUT`
- `NOT_INTERESTED`
- `WRONG_PRODUCT`
- `ALREADY_BOUGHT`
- `NEEDS_REVIEW`
- `OTHER`

## Snooze Behavior

Snoozing marks the local find as snoozed and stores a decision record. Future scan work can use the decision to suppress repeated alerts for the same product during the snooze window while still recording scan history.

## Manual Checkout Checklist

Before opening a product, the UI shows:

1. Confirm seller is official retailer.
2. Confirm price is still within your max.
3. Confirm shipping/pickup option.
4. Confirm quantity limit.
5. Complete payment only on the retailer website.

## Audit Logs

Sanitized audit events are created for product opened, checklist viewed, marked bought, marked skipped, snoozed, unsnoozed, note updated, and decision changed.

## Safety Policy

- No checkout automation.
- No add-to-cart.
- No auto-purchase.
- No scraping.
- No browser automation.
- No CAPTCHA, queue, rate-limit, login-protection, or purchase-limit bypass.
- No retailer credentials, cookies, sessions, card data, CVV, or payment data.
- Best Buy live scans remain disabled until official API approval/key setup is complete.
