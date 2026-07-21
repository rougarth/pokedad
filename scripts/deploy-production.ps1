param(
  [string]$ComposeFile = "docker-compose.production.yml",
  [switch]$SkipMigrate
)

$ErrorActionPreference = "Stop"

function Import-EnvFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }
    $name, $value = $line.Split("=", 2)
    $value = $value.Trim().Trim('"').Trim("'")
    [Environment]::SetEnvironmentVariable($name.Trim(), $value, "Process")
  }
}

Import-EnvFile ".env.production"
Import-EnvFile "apps/api/.env.production"

npm install
npm run typecheck
npm run build
npm audit
npx prisma validate --schema apps/api/prisma/schema.prisma
npm run prisma:generate
npm run security:check

docker compose -f $ComposeFile config
docker compose -f $ComposeFile build

if (-not $SkipMigrate) {
  npm run db:deploy
}

docker compose -f $ComposeFile up -d
docker compose -f $ComposeFile ps
Write-Host "Production deploy helper finished. Verify HTTPS and Discord OAuth redirect configuration before exposing the app."
