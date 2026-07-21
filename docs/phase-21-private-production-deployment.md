# Phase 21 - Private Production Deployment

Phase 21 prepares PokeDad Radar to run as a private production app on a VPS, Railway, Render, Fly.io, DigitalOcean, AWS Lightsail, a Docker server, or a home server. It does not add live retailer scanners, scraping, checkout, add-to-cart, auto-purchase, or retailer page automation.

## Recommended Architecture

```text
Browser
  -> HTTPS domain
  -> Web dashboard
  -> API server
  -> PostgreSQL
  -> Redis
  -> encrypted secrets
  -> Discord webhook delivery
```

Keep PostgreSQL and Redis private. Only the web dashboard and API should be reachable through HTTPS.

## Deployment Options

- VPS or home server with Docker Compose and Caddy/Nginx/Traefik.
- Railway/Render/Fly.io/DigitalOcean/AWS Lightsail with managed PostgreSQL/Redis or private Docker networking.
- Private LAN deployment behind a VPN or reverse proxy.

Do not hardcode platform-specific secrets into the repo. Use platform secret managers or server-local `.env.production` files.

## Required Environment Variables

Use `.env.production.example`, `apps/api/.env.production.example`, and `apps/web/.env.production.example` as templates.

Required production values:

- `NODE_ENV=production`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `PUBLIC_APP_URL`
- `WEB_ORIGIN`
- `API_BASE_URL`
- `VITE_API_BASE_URL`
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` if Discord OAuth is used

`SESSION_SECRET` must be long and random. `ENCRYPTION_KEY` must be exactly 32 characters, stable, and backed up. Losing `ENCRYPTION_KEY` can make encrypted Discord/Telegram credentials unreadable.

## Docker Production

Production files:

- `Dockerfile.api`
- `Dockerfile.web`
- `docker-compose.production.yml`

The production compose file keeps PostgreSQL and Redis off public ports. API is bound to localhost by default so a reverse proxy can safely expose it.

Validate and build:

```powershell
docker compose -f docker-compose.production.yml config
docker compose -f docker-compose.production.yml build
```

Start after production env files are configured:

```powershell
docker compose -f docker-compose.production.yml up -d
```

## HTTPS and Reverse Proxy

HTTPS is required for production cookies and Discord OAuth. Recommended cookie behavior is HttpOnly, SameSite=Lax, and Secure when `NODE_ENV=production`.

Caddy single-domain example:

```caddyfile
pokedad.yourdomain.com {
  encode gzip

  handle_path /api/* {
    reverse_proxy 127.0.0.1:4000
  }

  handle {
    reverse_proxy 127.0.0.1:8080
  }
}
```

Nginx single-domain example:

```nginx
server {
  listen 443 ssl http2;
  server_name pokedad.yourdomain.com;

  location /api/ {
    proxy_pass http://127.0.0.1:4000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location / {
    proxy_pass http://127.0.0.1:8080;
  }
}
```

If you use a single-domain `/api` proxy, set:

```env
API_BASE_URL="https://pokedad.yourdomain.com/api"
VITE_API_BASE_URL="https://pokedad.yourdomain.com/api"
DISCORD_REDIRECT_URI="https://pokedad.yourdomain.com/api/discord/oauth/callback"
```

Update the Discord Developer Portal redirect URI exactly.

## Database Migrations

Local development uses:

```powershell
npm run db:migrate
```

Production uses:

```powershell
npm run db:deploy
```

Never run destructive reset commands against production.

## Backup and Restore

Run a backup before deploys:

```powershell
.\scripts\backup-db.ps1
```

Restore requires an explicit confirmation:

```powershell
.\scripts\restore-db.ps1 -InputPath backups\pokedad-example.sql
```

Store backups securely. If backups include encrypted alert secrets, also back up the matching `ENCRYPTION_KEY` separately in a password manager.

## Security Hardening

Production hardening includes:

- restricted production CORS via `WEB_ORIGIN` and `PUBLIC_APP_URL`
- HttpOnly signed session cookie
- Secure cookie in production
- SameSite=Lax cookie policy
- request body size limit
- Helmet security headers
- no stack traces intentionally exposed by API routes
- login throttling after repeated failures
- sanitized audit logs
- sanitized provider errors
- safe `/health` and `/config/status` responses
- no public PostgreSQL/Redis ports in production compose

Run:

```powershell
npm run security:check
```

The check verifies common mistakes without printing secrets.

## Monitoring

Minimum private monitoring:

- API `/health`
- Docker service health checks
- database storage and backup age
- Redis availability
- Discord delivery failures
- scheduler status
- disk usage

Keep logs sanitized. Do not log API keys, Discord webhooks, Discord OAuth secrets, cookies, auth headers, retailer sessions, or payment data.

## Rollback

Before deployment:

1. Run a database backup.
2. Record the current git commit or release artifact.
3. Build the new containers.
4. Run `npm run db:deploy`.
5. Start the updated stack.

Rollback:

1. Stop the updated stack.
2. Checkout/redeploy the previous artifact.
3. Restore the database backup only if migration rollback cannot be handled safely.
4. Confirm `/health`, login, Discord status, and dashboard pages.

## Safety Limitations

Private production does not change retailer behavior. The app remains manual/open-only unless a future official API path is reviewed and explicitly approved.

Blocked:

- checkout automation
- auto-purchase
- add-to-cart automation
- retailer scraping
- browser automation against retailer sites
- CAPTCHA, queue, waiting-room, rate-limit, login-protection, or purchase-limit bypass
- retailer credential/cookie/session storage
- payment/card/CVV storage
