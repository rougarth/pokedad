# ngrok Home-Server Deployment

## Public Routes

```text
https://flavored-flint-hardcore.ngrok-free.dev
https://flavored-flint-hardcore.ngrok-free.dev/api
```

The official `ngrok/ngrok:latest` container sends outbound tunnel traffic to `http://web:80`. nginx serves the SPA and proxies `/api/*` to the private API container. PostgreSQL, Redis, and the API have no host-published ports in this stack.

## Private Environment

Create these untracked files from their examples:

```text
.env.ngrok
apps/api/.env.ngrok
apps/web/.env.ngrok
```

Set the reserved domain and a real `NGROK_AUTHTOKEN` in `.env.ngrok`. Never print, share, or commit this token or any session, encryption, database, Discord, API, or webhook secret.

Replace every local development default before startup, including the `pokedad` database password, local admin password, sample session secret, and sample encryption key. The start script rejects these known defaults.

The production URL values are:

```env
PUBLIC_APP_URL="https://flavored-flint-hardcore.ngrok-free.dev"
API_BASE_URL="https://flavored-flint-hardcore.ngrok-free.dev/api"
DISCORD_REDIRECT_URI="https://flavored-flint-hardcore.ngrok-free.dev/api/discord/oauth/callback"
NGROK_DOMAIN="flavored-flint-hardcore.ngrok-free.dev"
```

Add this exact redirect URI in the Discord Developer Portal before testing production OAuth:

```text
https://flavored-flint-hardcore.ngrok-free.dev/api/discord/oauth/callback
```

## Validate and Build

```powershell
docker compose --env-file .env.ngrok -f docker-compose.home-server.yml -f docker-compose.ngrok.yml config --quiet
docker compose --env-file .env.ngrok -f docker-compose.home-server.yml -f docker-compose.ngrok.yml build
```

## Start, Check, Stop

The start script refuses to run when required values are blank/placeholders and uses production-safe `prisma migrate deploy`:

```powershell
.\scripts\ngrok-home-server-start.ps1
.\scripts\ngrok-home-server-check.ps1
.\scripts\ngrok-home-server-stop.ps1
```

After startup, verify HTTPS, login/logout, secure cookies, Discord status, Notification History, and that the Best Buy scheduler remains stopped with no requests.

## Backup

```powershell
.\scripts\ngrok-home-server-backup.ps1
```

Backups are written under `backups/ngrok-home-server`. Keep protected off-server copies and never restore over the live database during a smoke test.

## Safety

This configuration adds no retailer scanner, scraping, browser automation, add-to-cart, checkout, auto-purchase, credential/session storage, payment storage, or retailer protection bypass. Retailer behavior remains manual/open-only.
