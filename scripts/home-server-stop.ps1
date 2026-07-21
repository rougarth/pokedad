param([string]$ComposeFile = "docker-compose.home-server.yml")
$ErrorActionPreference = "Stop"
if (-not (Test-Path ".env.home-server")) { throw "Missing .env.home-server." }
docker compose --env-file .env.home-server -f $ComposeFile stop
Write-Host "Home-server containers stopped. Persistent volumes were not removed."
