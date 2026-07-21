param([string]$ComposeFile = "docker-compose.home-server.yml")
$ErrorActionPreference = "Stop"
if (-not (Test-Path ".env.home-server")) { throw "Missing .env.home-server." }
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker daemon is not running." }
docker compose --env-file .env.home-server -f $ComposeFile config --quiet
docker compose --env-file .env.home-server -f $ComposeFile up -d
docker compose --env-file .env.home-server -f $ComposeFile ps
