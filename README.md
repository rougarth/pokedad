# PokeDad Radar

Private Pokemon TCG restock dashboard and human-in-the-loop cart-assist tool.

This project is designed for personal fair-price purchasing. It must not bypass CAPTCHA, queues, waiting rooms, purchase limits, anti-bot systems, or retailer rules. Checkout always remains manual on the retailer website.

## Scaffold

- `apps/api`: Fastify API, Prisma schema, security services, starter routes.
- `apps/web`: Vue 3 + Vite dashboard shell.
- `apps/extension`: browser helper shell.
- `packages/shared`: shared statuses, DTOs, and price evaluation helpers.
- `docs`: product, architecture, API, dashboard, helper, security, and roadmap plans.

## Local Start

```bash
npm install
docker compose up -d
npm run db:migrate
npm run db:seed
npm run prisma:generate
npm run dev:api
npm run dev:web
```

Default local admin login, used only when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are not set:

- Email: `admin@pokedad.local`
- Password: `pokedad-dev-password`

## Windows Setup

1. Install and open Docker Desktop.
2. Restart PowerShell after installing Docker Desktop so `docker` is available in `PATH`.
3. Verify Docker from PowerShell:

```powershell
docker --version
docker compose version
```

4. Create local environment files. The root `.env` supports direct Prisma commands run from the project root, and `apps/api/.env` supports API workspace scripts:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
```

5. Install dependencies and start the local database:

```powershell
npm install
docker compose up -d
```

6. Migrate, seed, and run the app:

```powershell
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
```

This checkout uses host port `55433` because `5432` and `5433` were already occupied on the setup machine. The PostgreSQL URL is:

```env
DATABASE_URL="postgresql://pokedad:pokedad@localhost:55433/pokedad?schema=public"
```

If port `55433` is also unavailable, choose another free host port and update `docker-compose.yml`, `.env`, and `apps/api/.env` together.

The original default would be:

```env
DATABASE_URL="postgresql://pokedad:pokedad@localhost:5432/pokedad?schema=public"
```

## Phase 3 Database Workflow

```bash
docker compose up -d
npx prisma validate --schema apps/api/prisma/schema.prisma
npm run prisma:generate
npm run db:migrate
npm run db:seed
```

`npm run db:seed` refreshes demo data for the local admin user. It does not store retailer passwords, retailer cookies, retailer session tokens, card numbers, CVV, or payment data.

## Phase 3 Limitations

- Store behavior is still open-only/demo-only.
- Alert delivery is persisted as placeholder `AlertEvent` records.
- Browser helper remains a shell.
- No real retailer adapters exist yet.
- No checkout automation exists.

## Phase 4 Store Adapters

Phase 4 adds a safety-checked store adapter framework and a Best Buy read-only adapter. Best Buy is installed as an official/public Products API candidate, but the app still starts without a key.

To enable live Best Buy read-only checks, add an API key to both local env files:

```env
BEST_BUY_API_KEY="your-best-buy-developer-key"
```

Leave it blank to keep the adapter in `API key needed` mode:

```env
BEST_BUY_API_KEY=""
```

Run the app:

```powershell
cd C:\Users\gbrie\Documents\Playground\poke-dad-radar
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
```

Test the adapter page:

1. Sign in at `http://127.0.0.1:5175/login`.
2. Open `Store Adapters`.
3. Confirm Best Buy shows either `Configured` or `API key needed`.
4. Use `Test Search` or `Test SKU Lookup`. If no API key is configured, the page should show a friendly configuration message and the app should keep running.
5. Open `Live Finds` and use `Run Best Buy Test Scan` for a read-only/manual candidate scan.

Phase 4 limitations:

- Best Buy is read-only: product search, SKU lookup, price, availability, image, and product URL only.
- No add-to-cart, checkout, payment, or auto-purchase flow exists.
- No CAPTCHA, queue, waiting-room, rate-limit, login-protection, or purchase-limit bypass exists.
- No retailer passwords, cookies, sessions, card data, CVV, or payment data are stored.
- Target and all other stores remain research-only or manual/open-only until an explicit approved read-only pathway is reviewed.

## Phase 5 Best Buy Scan Loop

Phase 5 adds a production-safe Best Buy scan loop and local alert pipeline. It still uses only the Best Buy read-only adapter.

Add a key when you want live Best Buy API scans:

```env
BEST_BUY_API_KEY="your-best-buy-developer-key"
```

The app still works without it. Manual scans return `CONFIGURATION_NEEDED` and create sanitized audit logs.

Manual scan surfaces:

- `Store Adapters` -> `Run Scan Now`
- `Live Finds` -> `Run Best Buy Scan Now`
- `Scan Settings` -> configure terms, interval, cooldown, and result limits

Scan safety behavior:

- Default interval is conservative: 30 minutes.
- A scan lock prevents duplicate simultaneous scans.
- Repeated scans are rate-limited.
- API errors are recorded without aggressive retry loops.
- Duplicate alerts are suppressed for the same SKU, price, and availability state inside the configured cooldown window.
- Alerts are persisted as local `AlertEvent` records unless a future encrypted delivery integration is added.

Phase 5 still has no checkout, add-to-cart, auto-purchase, payment submission, CAPTCHA bypass, queue bypass, waiting-room bypass, login-protection bypass, or purchase-limit bypass.

## Phase 6 MSRP Mapping

Phase 6 adds a manual MSRP mapping workflow for `UNKNOWN_MSRP` scan results.

Use `MSRP Mapping` in the sidebar to:

- review unmapped and suggested products
- accept keyword suggestions
- manually choose a product category
- ignore unclear products
- mark products as needs review
- recalculate related stock check price status after mapping

The keyword matcher is local and transparent. It checks terms such as `booster bundle`, `elite trainer box`, `pokemon center etb`, `upc`, `collection box`, `premium collection`, `mini tin`, `tin`, `sleeved booster`, and `booster box`.

Scan settings now include:

- `Alert on unknown MSRP products`
- `Auto-suggest MSRP category`

Unknown MSRP alerts remain off by default. Phase 6 does not add checkout, add-to-cart, auto-purchase, payment submission, CAPTCHA bypass, queue bypass, waiting-room bypass, login-protection bypass, or purchase-limit bypass.

## Phase 7 Real Alerts

Phase 7 adds encrypted, private Telegram and Discord delivery. Open `Alerts` to add a Telegram bot token and chat ID or a Discord incoming webhook URL. Secrets are encrypted with AES-256-GCM before PostgreSQL storage and are returned to the dashboard only as masked configuration labels.

Required encryption setting:

```env
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef"
```

Use a private, unique 32-character key outside local development. Do not change the key while channels are configured unless you plan to replace their encrypted credentials.

Scan Settings now include:

- `Send alerts automatically` (default on)
- `Send scan failure alerts` (default off)
- `Alert on unknown MSRP` (default off)
- `Alert cooldown minutes`

Run locally:

```powershell
cd C:\Users\gbrie\Documents\Playground\poke-dad-radar
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
```

See `docs/phase-7-real-alerts.md` for provider setup, testing, encryption behavior, troubleshooting, and safety limitations. Phase 7 remains alert-only: no checkout, cart automation, purchase flow, or retailer protection bypass was added.

## Phase 8 Controlled Best Buy Live Scan

Phase 8 adds a boolean-only Best Buy key status endpoint and a fuller latest-scan summary. Best Buy API live finds are source-tagged and remain open-product only.

Obtain a key from the official Best Buy Developer Portal, then set it locally in both `.env` and `apps/api/.env`:

```env
BEST_BUY_API_KEY="your-local-key"
```

Never paste the key into chat or commit it. Restart `npm run dev:api` after changing the local environment. When the key is blank, the app remains healthy and returns `CONFIGURATION_NEEDED` without making a live API request.

See `docs/phase-8-best-buy-live-scan.md` for the controlled one-scan procedure, result interpretation, alerts, MSRP mapping, troubleshooting, and safety policy.

## Phase 9 Discord OAuth Connect

Phase 9 adds a **Connect Discord** flow using Discord's official OAuth2 authorization-code grant and the `webhook.incoming` scope. Discord presents the server/channel selection UI; PokeDad Radar encrypts the returned webhook and reuses the existing alert delivery pipeline.

Add these values to `.env` and `apps/api/.env`:

```env
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""
DISCORD_REDIRECT_URI="http://127.0.0.1:4000/discord/oauth/callback"
```

Register that redirect URI exactly in the Discord Developer Portal, then restart the API. Missing configuration does not prevent startup and is shown safely on the Alerts page. See `docs/phase-9-discord-oauth-connect.md` for setup, connection, testing, disconnect, troubleshooting, encryption, and safety details.

## Phase 10 Mobile Alerts and Notification History

Phase 10 adds compact Discord embeds, Telegram-ready text templates, alert priorities, preview/test tools, configurable message details, and an authenticated Notification History page with provider delivery details and sanitized errors. Discord tests are clearly marked, and channel secrets remain encrypted and masked.

Open `Alerts` to preview or send a template test. Open `Notification History` to filter and inspect delivery results. Alert formatting preferences live under `Scan Settings`. See `docs/phase-10-mobile-alerts-notification-history.md` for behavior, troubleshooting, duplicate webhook cleanup, and safety limits.

Phase 10 remains notification-only: it adds no cart, checkout, auto-purchase, retailer credentials, or protection bypass.

## Phase 12 Scheduled Best Buy Worker

Phase 12 adds an opt-in, Redis-locked scheduler for the official Best Buy Products API adapter. It is disabled by default, enforces a minimum 30-minute interval, performs no scan when the API key is missing or pending approval, and reuses the existing price rules, cooldowns, Discord alerts, and Notification History.

Configure and monitor it under `Scan Settings`. Complete one successful manual scan before enabling scheduled scans. See `docs/phase-12-scheduled-best-buy-worker.md` for status meanings, safety defaults, endpoints, and approval limitations.

Phase 12 remains read-only and Open Product only. It adds no scraping, browser automation, cart, checkout, or purchase flow.

## Phase 13 Best Buy Manual Scan Readiness

Phase 13 gates every real manual Best Buy scan behind a local readiness check, a five-minute single-use token, explicit approval/read-only confirmations, and an exact confirmation phrase. Scan Settings now reports configuration readiness, scheduler state, Redis, alert channel readiness, request counts, products checked, matches, duration, and sanitized errors.

The readiness check does not contact Best Buy. Confirm developer approval yourself, restart the API after adding the key, run readiness, then authorize exactly one official API scan. Keep the scheduler `STOPPED`. See `docs/phase-13-best-buy-manual-scan-readiness.md` for the complete runbook.

## Phase 13 Best Buy Approval Pending + Mock Mode

While Best Buy API approval/key access is pending, the dashboard now shows `APPROVAL_PENDING`, explains that live scans are paused, and keeps the scheduler stopped. Enabling the scheduler without a key returns a setup-needed response and makes no retailer request.

Use **Scan Settings** -> **Run Mock Scan** to exercise local products, accepted/over-limit/unknown-MSRP counts, MSRP mapping candidates, alert events, duplicate suppression, Live Finds, and Notification History. Every mock record is labeled `MOCK / DEMO — no retailer request was made`, and request count remains `0`.

Use **Send Mock Discord Alert** to send a clearly marked `TEST / MOCK ALERT — PokeDad Radar` message through the connected Discord channel. Secrets remain encrypted and masked. See `docs/phase-13-bestbuy-approval-pending-mode.md`.

## Phase 14 Manual Purchase Assist

Phase 14 adds DB-backed purchase decision tracking for Live Finds and Notification History. This is manual-only UX: Open Product, Mark Bought, Mark Skipped, Snooze/Unsnooze, mark Too Expensive/Sold Out/Not Interested/Needs Mapping, and private notes.

The manual assist panel shows price, MSRP, max accepted price, source, delivery status, last seen time, and a checkout checklist. It never adds to cart, checks out, automates a browser, stores retailer credentials, or touches payment data. See `docs/phase-14-manual-purchase-assist.md`.

## Phase 15 Wishlist and Priority Rules

Phase 15 adds a private Wishlist page for Pokemon TCG products, sets, categories, store preferences, desired quantities, max prices, allowed markups, priority, and alert behavior. Wishlist matching is local and keyword/category/store based.

Mock Scan Mode now demonstrates urgent, high, dashboard-only, unknown-MSRP, and ignored wishlist outcomes without making any retailer request. Live Finds and Notification History show wishlist priority, matched item, set name, and alert behavior. See `docs/phase-15-wishlist-priority-rules.md`.

Phase 15 still adds no scraping, cart automation, checkout, add-to-cart, auto-purchase, retailer credentials, sessions, cookies, or payment data.

## Phase 16 Multi-Store Safety Matrix

Phase 16 adds a static, conservative Store Safety Matrix for Best Buy, Target, Walmart, GameStop, Pokemon Center, Amazon, Costco, Sam's Club, BJ's, Barnes & Noble, Dick's Sporting Goods, and Ace Hardware.

Open `Store Safety Matrix` to review official API status, recommended mode, risk, supported capabilities, terms concerns, blocked capabilities, and the next safe step for each store. `Store Adapters` now shows safety/risk badges, and Wishlist store preferences warn when a store is research-only/manual-only.

This phase adds no live scanners. Best Buy remains approval-pending, and every other store remains research/manual/open-only until an official or explicitly allowed read-only pathway is confirmed. See `docs/phase-16-multistore-safety-matrix.md`.

## Phase 17 Manual Store Watchlist

Phase 17 adds `Manual Store Links`, a local launch center for user-provided retailer product/search/category/release links. Links can be grouped by store, type, priority, set, category, notes, and wishlist item.

Opening a link is manual: the frontend opens a new tab and the API only records `lastOpenedAt` and `openCount`. The backend never fetches retailer URLs, scrapes pages, checks stock, adds to cart, or checks out. Wishlist and Manual Purchase Assist can show related manual links. See `docs/phase-17-manual-store-watchlist.md`.

## Phase 18 Release Calendar and Launch Reminders

Phase 18 adds `Release Calendar`, a manual launch tracker for Pokemon TCG sets/products. Releases can be attached to wishlist items and multiple Manual Store Links, assigned priority/status, and configured with reminder offsets like 7 days, 1 day, 1 hour, and release time.

Test release reminders use the existing encrypted alert delivery pipeline and are clearly marked `TEST RELEASE REMINDER - PokeDad Radar`. Notification History records reminder events and delivery status. Related manual links still open only from the frontend; the backend only records local open tracking and never fetches retailer URLs.

Walmart is verified across the safety matrix, Manual Store Links seed, Wishlist store preferences, Release Calendar link options, and manual-link integrations as research/manual-only. Phase 18 adds no live scanner, scraping, cart, checkout, add-to-cart, auto-purchase, retailer credential/session storage, or protection bypass. See `docs/phase-18-release-calendar-reminders.md`.

## Phase 19 Today's Action List

Phase 19 adds `Today's Action List`, a daily review dashboard that ranks release dates, urgent wishlist items, manual links to check, MSRP mapping needs, mock/demo finds, recent alerts, snoozed items, and purchase decisions.

The page persists only local action state such as dismissed, snoozed, or done. The action cards are derived from existing DB-backed data. Opening a manual link still only records local `lastOpenedAt`/`openCount` and opens the URL from the frontend; the backend never fetches retailer URLs.

Phase 19 adds no live scanners, scraping, cart automation, checkout, add-to-cart, auto-purchase, retailer credential/session storage, or protection bypass. See `docs/phase-19-today-action-list.md`.

## Phase 20 Local Analytics Dashboard

Phase 20 adds `Analytics`, a private local dashboard for purchase history, estimated spend, wishlist progress, release coverage, manual link activity, alert outcomes, and MSRP mapping status.

Analytics are derived from local PostgreSQL data only. Spending uses explicit `finalPriceCents * quantity` from purchase decisions and does not guess missing prices. Bought/skipped CSV exports are available and exclude secrets, tokens, API keys, webhooks, cookies, sessions, auth headers, and payment data.

Phase 20 adds no external analytics, tracking pixels, live scanners, scraping, backend retailer URL fetching, cart automation, checkout, add-to-cart, auto-purchase, retailer credential/session storage, or protection bypass. See `docs/phase-20-local-analytics-dashboard.md`.

## Phase 21 Private Production Deployment

Phase 21 adds production-ready Docker files, production env examples, login throttling, stricter production CORS, Helmet security headers, request body limits, safe deploy/check scripts, backup/restore helpers, and production safety documentation.

Production env templates:

- `.env.production.example`
- `apps/api/.env.production.example`
- `apps/web/.env.production.example`

Never commit real production `.env` files. Generate a long random `SESSION_SECRET`, and keep the 32-character `ENCRYPTION_KEY` stable and backed up. Losing `ENCRYPTION_KEY` may make encrypted Discord/Telegram credentials unreadable.

Production Docker validation:

```powershell
docker compose -f docker-compose.production.yml config
docker compose -f docker-compose.production.yml build
```

Production deploy helper:

```powershell
.\scripts\deploy-production.ps1
```

Production database migrations use:

```powershell
npm run db:deploy
```

Local development still uses:

```powershell
npm run db:migrate
```

Backup and restore helpers:

```powershell
.\scripts\backup-db.ps1
.\scripts\restore-db.ps1 -InputPath backups\pokedad-example.sql
```

Security check:

```powershell
npm run security:check
```

For production Discord OAuth, update the Discord Developer Portal redirect URI to your public HTTPS route, for example:

```text
https://pokedad.yourdomain.com/api/discord/oauth/callback
```

Use HTTPS in production. Keep PostgreSQL and Redis private. See `docs/phase-21-private-production-deployment.md` and `docs/production-safety-policy.md` for the full deployment and safety runbooks.

## Phase 22 Home Server and Cloudflare Tunnel

Phase 22 adds a private home-server deployment using one HTTPS hostname, an outbound Cloudflare Tunnel, and a Docker-only network. nginx serves the SPA and proxies `/api/*` to Fastify, so Cloudflare exposes only `http://web:80`. The API, PostgreSQL, and Redis have no host-published ports.

Create private home-server env files from:

- `.env.home-server.example`
- `apps/api/.env.home-server.example`
- `apps/web/.env.home-server.example`

Set a strong database password, a long random `SESSION_SECRET`, an exactly 32-character stable `ENCRYPTION_KEY`, your HTTPS domain, and the remotely managed tunnel token. Never commit these files. Configure the Cloudflare public hostname to use `http://web:80`.

Windows setup and operation:

```powershell
.\scripts\home-server-setup.ps1
.\scripts\home-server-check.ps1
.\scripts\home-server-backup.ps1
.\scripts\home-server-stop.ps1
.\scripts\home-server-start.ps1
```

The production Discord redirect must match the public route exactly:

```text
https://pokedad.example.com/api/discord/oauth/callback
```

Cloudflare Access with an email allowlist is recommended as an additional gate, while the app's own login remains enabled. No router port forwarding is required. See `docs/phase-22-home-server-cloudflare-tunnel.md` for Windows/Linux setup, tunnel creation, backups, restores, updates, monitoring, troubleshooting, and safety policy.

### ngrok Home-Server Alternative

The home-server stack can use the reserved ngrok domain:

```text
https://flavored-flint-hardcore.ngrok-free.dev
https://flavored-flint-hardcore.ngrok-free.dev/api
```

Create the untracked `.env.ngrok`, `apps/api/.env.ngrok`, and `apps/web/.env.ngrok` files from their examples, then set the real ngrok token locally. Never print or commit env files or secrets.

```powershell
.\scripts\ngrok-home-server-start.ps1
.\scripts\ngrok-home-server-check.ps1
.\scripts\ngrok-home-server-backup.ps1
.\scripts\ngrok-home-server-stop.ps1
```

Add this exact URI to the Discord Developer Portal before testing production Discord Connect:

```text
https://flavored-flint-hardcore.ngrok-free.dev/api/discord/oauth/callback
```

See `docs/ngrok-home-server-deployment.md`. nginx remains the only tunnel origin, and PostgreSQL, Redis, and Fastify remain private inside Docker.

## Safety Rules

## Phase 24 Home Server Operations

Install Windows startup recovery and a daily 03:00 database backup from an elevated PowerShell:

```powershell
.\scripts\install-home-server-tasks.ps1
```

Safe operational commands:

```powershell
.\scripts\ngrok-home-server-check.ps1
.\scripts\ngrok-home-server-backup.ps1
.\scripts\ngrok-home-server-update.ps1
```

Backups are retained for 14 days locally by default; keep a protected off-machine copy. Updates create a backup first and retain rollback API/web images. Database migrations are never automatically reversed. See `docs/phase-24-home-server-operations.md`.

## Phase 25 Local Real Signals

The Chrome helper supports explicit, preview-before-save product signal capture from a user-opened BJ's, Costco, Sam's Club, or Walmart page. Captures are labeled `LOCAL_BROWSER_CAPTURE`, validated by domain, rate limited, persisted as a stock observation, and connected to MSRP Mapping. The backend never fetches retailer URLs.

This is not a crawler: there is no background polling, scheduled retailer request, browser navigation, login/session collection, CAPTCHA or queue bypass, cart, checkout, or purchase automation. See `docs/phase-25-local-real-signals.md`.

## Safety Rules

- Do not store retailer credentials, cookies, session tokens, card numbers, CVV, or full payment data.
- Do not log secrets or browser session data.
- Stop and notify the user on CAPTCHA, queue, waiting room, MFA, login challenge, purchase limit, or ambiguous page state.
- Prefer official/public data sources and conservative store adapters.
