# Production Safety Policy

PokeDad Radar is private-use-first. Production deployment is for a locked-down personal dashboard, not a public buying bot or checkout agent.

## Allowed

- Private dashboard authentication.
- Manual wishlist, release calendar, analytics, and purchase decision tracking.
- Manual retailer launch links opened by the user.
- Official API usage only after access is approved and terms are reviewed.
- Discord/Telegram alerts with encrypted secrets.
- Local audit logs with sanitized payloads.

## Blocked

- Checkout automation.
- Auto-purchase.
- Add-to-cart automation.
- Retailer page automation.
- Retailer scraping without an approved official/public pathway.
- CAPTCHA bypass.
- Queue or waiting-room bypass.
- Rate-limit bypass.
- Login-protection bypass.
- Purchase-limit bypass.
- Retailer credential, password, cookie, or session storage.
- Payment data, card number, CVV, or CVC storage.

## Secret Handling

- Do not commit `.env`, `.env.production`, or platform secrets.
- Do not print API keys, Discord secrets, webhooks, access tokens, refresh tokens, cookies, or auth headers.
- Store alert provider credentials only through encrypted secret storage.
- Keep `ENCRYPTION_KEY` stable and backed up outside the repo.
- Rotate exposed secrets immediately.

## Manual Retailer Actions

Retailer links are manual references. Opening a link should be initiated by the user in the frontend. The backend must not fetch retailer URLs, scrape availability, add items to carts, submit checkout, or store retailer sessions.

If a retailer shows a CAPTCHA, queue, waiting room, human verification, login challenge, MFA challenge, or purchase limit, the user handles it manually on the retailer website.

## Official API Review Checklist

Before any new live adapter:

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
