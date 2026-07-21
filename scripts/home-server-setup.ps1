param([string]$ComposeFile = "docker-compose.home-server.yml")

$ErrorActionPreference = "Stop"

function Import-PrivateEnv([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { throw "Missing $Path. Copy its .example file and configure it first." }
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
      $name, $value = $line.Split("=", 2)
      [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim().Trim('"').Trim("'"), "Process")
    }
  }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker is not installed or is not in PATH." }
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker is installed, but the daemon is not running." }

Import-PrivateEnv ".env.home-server"
if (Test-Path "apps/api/.env.home-server") { Import-PrivateEnv "apps/api/.env.home-server" }

$required = @("POSTGRES_PASSWORD", "DATABASE_URL", "SESSION_SECRET", "ENCRYPTION_KEY", "PUBLIC_APP_URL", "CLOUDFLARE_TUNNEL_TOKEN")
foreach ($name in $required) {
  $value = [Environment]::GetEnvironmentVariable($name, "Process")
  if ([string]::IsNullOrWhiteSpace($value) -or $value -match "CHANGE_ME|TOKEN_REQUIRED") { throw "$name is missing or still uses a placeholder." }
}
if ($env:ENCRYPTION_KEY.Length -ne 32) { throw "ENCRYPTION_KEY must be exactly 32 characters." }
if ($env:SESSION_SECRET.Length -lt 32) { throw "SESSION_SECRET must be at least 32 characters." }

docker compose --env-file .env.home-server -f $ComposeFile config --quiet
docker compose --env-file .env.home-server -f $ComposeFile build
docker compose --env-file .env.home-server -f $ComposeFile up -d postgres redis
docker compose --env-file .env.home-server -f $ComposeFile run --rm api npm run db:deploy
docker compose --env-file .env.home-server -f $ComposeFile up -d
docker compose --env-file .env.home-server -f $ComposeFile ps
Write-Host "Home-server setup complete. Run scripts/home-server-check.ps1 next."
