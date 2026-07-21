# Phase 13: Best Buy Approval Pending Mode + Mock Scan Polish

## Goal

Phase 13 keeps PokeDad Radar useful while Best Buy Developer API approval is pending. Live Best Buy scans stay paused until `BEST_BUY_API_KEY` is configured and the API is restarted.

## Approval Pending Mode

When no Best Buy key is configured, the adapter reports `APPROVAL_PENDING` and the scan controls explain:

`Best Buy API approval pending. Live scans are paused until BEST_BUY_API_KEY is configured.`

The scheduler remains stopped. Trying to enable it without a key returns a setup-needed response, keeps scheduled scans disabled, and records a sanitized audit log. No retailer request is made.

## Mock Scan Mode

Mock Scan Mode is local-only and clearly labeled:

`MOCK / DEMO — no retailer request was made`

It simulates:

- products returned
- accepted products
- MSRP matches
- accepted markup
- over-limit products
- unknown MSRP products
- MSRP mapping candidates created
- alert events created
- duplicate alerts suppressed

Mock scan records use `BEST_BUY_MOCK_DEMO` source metadata and `lastRequestCount: 0`.

## Mock Discord Alerts

The mock Discord action sends a clearly marked test message to the connected Discord channel:

`TEST / MOCK ALERT — PokeDad Radar`

It is stored in Notification History as TEST, MOCK, and DEMO so it cannot be confused with a real restock alert.

## Real Key Runbook Later

1. Apply for Best Buy Developer API access.
2. Wait for Best Buy approval.
3. Add `BEST_BUY_API_KEY` to `.env`.
4. Add `BEST_BUY_API_KEY` to `apps/api/.env`.
5. Restart the API.
6. Confirm `/config/status` shows the key configured.
7. Run the readiness check.
8. Run one controlled manual live scan.
9. Verify Discord alert delivery and Notification History.
10. Only then consider enabling the scheduled worker.

## Safety Rules

- No checkout automation.
- No add-to-cart.
- No auto-purchase.
- No browser automation or scraping.
- No bypass of CAPTCHA, queues, waiting rooms, rate limits, login protections, or purchase limits.
- No retailer credentials, cookies, sessions, card data, CVV, or payment data.
- Official Best Buy API only when live mode is approved and configured.
