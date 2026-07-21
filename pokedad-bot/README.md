# PokeDad Bot

Safe command worker for PokeDad Radar. It does not scrape retailers, automate browser pages, add products to carts, submit checkout, solve challenges, or store retailer sessions.

## Commands

The worker listens on Redis channel `pokedad:safe-command` and publishes responses to `pokedad:safe-result`.

```json
{"action":"status","requestId":"example-1"}
{"action":"scan","store":"walmart","sku":"demo","mode":"mock","requestId":"example-2"}
```

Best Buy live scans remain inside the authenticated API readiness flow. Other stores return `MANUAL_ONLY` unless `mode` is explicitly `mock`.

## Run

```powershell
npm install
npm run start -w @pokedad-radar/bot
```

Health: `http://127.0.0.1:3456/health`
