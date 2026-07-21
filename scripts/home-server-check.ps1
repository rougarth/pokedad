param([string]$ComposeFile = "docker-compose.home-server.yml")
$ErrorActionPreference = "Stop"
if (-not (Test-Path ".env.home-server")) { throw "Missing .env.home-server." }

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker daemon is not running." }
docker compose --env-file .env.home-server -f $ComposeFile ps

docker compose --env-file .env.home-server -f $ComposeFile exec -T web wget -qO- http://127.0.0.1/api/health *> $null
if ($LASTEXITCODE -ne 0) { throw "Internal API health check failed." }
Write-Host "Internal API health: OK"

docker compose --env-file .env.home-server -f $ComposeFile exec -T postgres pg_isready -U pokedad -d pokedad *> $null
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL health check failed." }
Write-Host "PostgreSQL health: OK"

docker compose --env-file .env.home-server -f $ComposeFile exec -T redis redis-cli ping *> $null
if ($LASTEXITCODE -ne 0) { throw "Redis health check failed." }
Write-Host "Redis health: OK"

$latest = Get-ChildItem -Path backups -Filter "*.sql" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latest) { Write-Host "Latest backup:" $latest.LastWriteTime } else { Write-Warning "No local SQL backup found." }
Get-PSDrive -Name (Split-Path -Qualifier (Get-Location).Path).TrimEnd(':') | Select-Object Name, Used, Free
Write-Host "Check the authenticated Security/Scan Settings pages for Discord and scheduler status."
