# Phase 24: Home Server Operations Hardening

## Goal

Keep the private ngrok deployment available after Windows restarts, create retained database backups, and make updates recoverable without exposing secrets or retailer services.

## Automatic startup

Docker Desktop must start with Windows. `ngrok-home-server-recover.ps1` waits up to ten minutes for Docker, starts the existing images without rebuilding or rerunning migrations, and verifies the internal web/API, PostgreSQL, and Redis health checks.

Run PowerShell as Administrator once:

```powershell
.\scripts\install-home-server-tasks.ps1
```

When run as Administrator this installs:

- `PokeDad Radar - Startup` at system startup.
- `PokeDad Radar - Daily Backup` daily at 03:00.

Without elevation, it safely installs a per-user recovery task at logon plus the daily backup. This is suitable for Docker Desktop, which normally starts in the signed-in user's session.

Remove them with `scripts\uninstall-home-server-tasks.ps1`.

## Backups

`ngrok-home-server-backup.ps1` creates a PostgreSQL SQL dump under `backups/ngrok-home-server` and removes dumps older than 14 days by default. Keep an encrypted copy on another device or protected cloud storage. Test restores only into a separate disposable database; never overwrite the live database as a routine test.

## Updates and rollback

Run:

```powershell
.\scripts\ngrok-home-server-update.ps1
```

The script backs up the database, installs locked dependencies, runs typecheck/build/audit/security checks, tags the current API/web images as rollback images, builds, deploys migrations, recreates services, and runs health checks. If application startup fails, the previous application images are restored. Prisma migrations are intentionally not reversed automatically; use the pre-update backup and a reviewed restore procedure if a database rollback is required.

## Reboot recovery test

1. Create a fresh backup.
2. Confirm Docker Desktop starts automatically.
3. Restart Windows during a maintenance window.
4. Wait for Docker and the scheduled recovery task.
5. Run `scripts\ngrok-home-server-check.ps1`.
6. Verify the public HTTPS dashboard, login, Discord status, and Notification History.
7. Confirm Best Buy remains stopped unless explicitly configured and enabled.

## Monitoring

Run `scripts\ngrok-home-server-check.ps1` after updates and periodically. Monitor Docker container health, disk space, backup timestamps, public HTTPS availability, Discord delivery failures, and scheduler state. An external uptime monitor may check only `/api/health`; it must not receive app credentials.

## Safety

The operational scripts do not print env files, tokens, passwords, webhook URLs, or encryption keys. PostgreSQL and Redis remain private inside Docker. This phase adds no scanning, scraping, cart, checkout, add-to-cart, browser automation, or retailer credential storage.
