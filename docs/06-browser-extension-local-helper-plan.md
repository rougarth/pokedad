# Browser Extension / Local Helper Plan

## Purpose

The helper performs browser-local actions that should not be handled by the backend because they involve the owner's logged-in retailer session. It keeps sensitive browser session material inside the browser.

## Allowed Actions

- Open a store login page.
- Open a product page.
- Open a cart page.
- Read coarse page state from the active tab.
- Report high-level status such as logged in, login needed, queue detected, CAPTCHA detected, or cart ready.
- Attempt add-to-cart only for store adapters explicitly marked safe and allowed.

## Disallowed Actions

- Reading or sending cookies to the backend.
- Reading or sending passwords.
- Reading or sending payment details.
- Bypassing CAPTCHA, queues, waiting rooms, MFA, purchase limits, or bot protections.
- Automatically checking out.
- Auto-solving prompts or challenges.
- Circumventing retailer controls.

## Command Flow

1. Helper authenticates to backend with a local helper token.
2. Helper polls or receives commands.
3. Command includes store, product URL, accepted price, expected seller, and allowed action.
4. Helper opens the page in the user's browser.
5. Helper checks for immediate stop states.
6. If safe and allowed, helper can click the store adapter's add-to-cart selector.
7. Helper rechecks price/seller/cart status.
8. Helper reports sanitized status.

## Stop States

- CAPTCHA detected.
- Queue/waiting room detected.
- Human verification detected.
- Login or MFA required.
- Product sold out.
- Price changed above accepted maximum.
- Seller changed or is not approved.
- Quantity limit prompt appears.
- Unexpected page state.

## Store Adapter Safety Levels

- `OPEN_ONLY`: helper only opens pages.
- `SESSION_TEST_ONLY`: helper can check coarse login status.
- `ADD_TO_CART_ALLOWED`: helper can attempt add-to-cart after price/seller recheck.
- `MANUAL_ONLY`: helper cannot automate any page action.

Default all real stores to `OPEN_ONLY` until adapter-specific review is complete.

## Extension MVP

- Manifest V3 extension.
- Popup showing helper connection status and latest command.
- Background service worker polling `/api/v1/helper/commands`.
- Content script with generic stop-state detection.
- No store-specific add-to-cart selectors enabled by default.

