param(
  [string]$BaseUrl = "http://127.0.0.1:4000",
  [string]$ComposeFile = "docker-compose.production.yml"
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

docker compose -f $ComposeFile ps
npm run security:check

$health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
Write-Host "API health:" ($health | ConvertTo-Json -Compress)
Write-Host "Production check complete."
