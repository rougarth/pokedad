# Phase 13: Best Buy Manual Real Scan Readiness

## Goal

Phase 13 prepares one explicitly authorized, read-only scan through the official Best Buy Products API. It does not enable the scheduler and does not validate credentials by scraping or calling undocumented endpoints.

## Readiness Contract

The readiness check verifies locally:

- `BEST_BUY_API_KEY` is non-empty and accepted by environment validation.
- Best Buy scans are enabled.
- The scheduled worker is `STOPPED` and disabled.
- No scan is already running.
- The conservative cooldown has elapsed.
- Redis is available for lock readiness.
- Enabled encrypted alert channels are reported without exposing their secrets.

A successful check returns `READY_FOR_MANUAL_SCAN` and a single-use token valid for five minutes. It makes no Best Buy request. The scan endpoint also requires the exact phrase `RUN ONE READ-ONLY SCAN`, confirmation that Best Buy approved the key, and confirmation that the operation is read-only.

## Exact Runbook

1. Confirm the Best Buy Developer dashboard no longer says access is restricted or pending approval.
2. Add the approved key to both `.env` and `apps/api/.env`:

   ```env
   BEST_BUY_API_KEY="your-local-key"
   ```

3. Restart the API with `npm run dev:api`.
4. Open **Scan Settings** and confirm the scheduler reads `STOPPED`.
5. Select **Run Readiness Check**.
6. Confirm the result is `READY_FOR_MANUAL_SCAN`.
7. Select **Review Manual Scan**, complete all confirmations, and run exactly one scan.
8. Review Best Buy request count, products checked, matches, duration, and any sanitized error.
9. Verify accepted products in Discord and inspect delivery attempts in **Notification History**.
10. Leave the scheduler `STOPPED` after the test.

## Logging and Errors

Completion audits include the trigger, official API request count, unique products checked, filtered matches, alerts, duplicate suppression, and duration. Failures record only sanitized summaries and request counts. HTTP 429/rate-limit responses become `RATE_LIMITED` and respect cooldown. API keys, request URLs containing keys, Discord webhooks, auth headers, and cookies are never logged.

## Safety Policy

The adapter remains official-API-only and read-only. Phase 13 adds no BestBuy.com HTML scraping, undocumented API use, browser automation, cart operation, checkout, payment, purchase, retailer credential/session storage, CAPTCHA bypass, queue bypass, rate-limit bypass, login bypass, or purchase-limit bypass. Open Product remains the only retailer action.
