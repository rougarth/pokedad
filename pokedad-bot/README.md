# PokeDad Bot

Safe status worker for PokeDad Radar. It does not fabricate product results, scrape retailers, automate browser pages, add products to carts, submit checkout, solve challenges, or store retailer sessions.

## Commands

The worker listens on Redis channel `pokedad:safe-command` and publishes responses to `pokedad:safe-result`.

```json
{"action":"status","requestId":"example-1"}
{"action":"scan","store":"walmart","sku":"reference","requestId":"example-2"}
```

Best Buy live scans remain inside the authenticated API readiness flow. Other stores return `MANUAL_ONLY` until an approved official integration exists.

## Run

```powershell
npm install
npm run start -w @pokedad-radar/bot
```

Health: `http://127.0.0.1:3456/health`

The main Fastify API exposes the authenticated `/bot/status` route. The Store Adapters page uses this route; browsers never connect directly to Redis.

## Optional Webshare proxy

Copy a Webshare list into `proxies.txt`, enable `OUTBOUND_PROXY_ENABLED`, and run:

```powershell
npm run proxy:check -w @pokedad-radar/bot
```

The check never prints proxy addresses, credentials, or the observed IP. Proxies are available only for explicitly approved API egress; they are not used for anti-bot evasion, CAPTCHA bypass, scraping, carts, or checkout.
