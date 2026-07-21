param([switch]$SkipMigrate)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$files = @(".env.ngrok", "apps/api/.env.ngrok", "apps/web/.env.ngrok")
foreach ($file in $files) { if (-not (Test-Path -LiteralPath $file)) { throw "Missing $file." } }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker is not installed or not in PATH." }
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker daemon is not running." }

function Read-Env([string]$Path) {
  $result = @{}
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
      $name, $value = $line.Split("=", 2)
      $result[$name.Trim()] = $value.Trim().Trim('"').Trim("'")
    }
  }
  return $result
}

$envMap = Read-Env ".env.ngrok"
$required = @("NGROK_AUTHTOKEN", "NGROK_DOMAIN", "POSTGRES_PASSWORD", "DATABASE_URL", "REDIS_URL", "SESSION_SECRET", "ENCRYPTION_KEY", "ADMIN_EMAIL", "ADMIN_PASSWORD")
foreach ($name in $required) {
  $value = $envMap[$name]
  if ([string]::IsNullOrWhiteSpace($value) -or $value -match "CHANGE_ME|REPLACE_ME") { throw "$name is missing or still uses a placeholder." }
}
if ($envMap["ENCRYPTION_KEY"].Length -ne 32) { throw "ENCRYPTION_KEY must be exactly 32 characters." }
if ($envMap["SESSION_SECRET"].Length -lt 32) { throw "SESSION_SECRET must be at least 32 characters." }
$unsafeDefaults = @{
  POSTGRES_PASSWORD = @("pokedad", "password")
  SESSION_SECRET = @("local-dev-session-secret-change-me")
  ENCRYPTION_KEY = @("0123456789abcdef0123456789abcdef")
  ADMIN_PASSWORD = @("pokedad-dev-password")
}
foreach ($name in $unsafeDefaults.Keys) {
  if ($unsafeDefaults[$name] -contains $envMap[$name]) { throw "$name still uses a known development default." }
}

$compose = @("compose", "--env-file", ".env.ngrok", "-f", "docker-compose.home-server.yml", "-f", "docker-compose.ngrok.yml")
& docker @compose config --quiet
& docker @compose build
& docker @compose up -d postgres redis
if (-not $SkipMigrate) { & docker @compose run --rm api npm run db:deploy }
& docker @compose up -d
& docker @compose ps
Write-Host "ngrok home-server stack started without displaying secret values."
