$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Test-Path ".env.ngrok")) { throw "Missing .env.ngrok." }
$compose = @("compose", "--env-file", ".env.ngrok", "-f", "docker-compose.home-server.yml", "-f", "docker-compose.ngrok.yml")
& docker @compose ps
& docker @compose exec -T web wget -qO- http://127.0.0.1/api/health *> $null
if ($LASTEXITCODE -ne 0) { throw "Internal web/API health check failed." }
& docker @compose exec -T postgres pg_isready -U pokedad -d pokedad *> $null
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL health check failed." }
& docker @compose exec -T redis redis-cli ping *> $null
if ($LASTEXITCODE -ne 0) { throw "Redis health check failed." }
Write-Host "Internal web/API, PostgreSQL, and Redis checks passed."
