param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$ComposeFile = "docker-compose.production.yml",
  [string]$Service = "postgres",
  [string]$Database = $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "pokedad" }),
  [string]$User = $(if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "pokedad" }),
  [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputPath)) {
  throw "Backup file not found: $InputPath"
}

if (-not $Force) {
  $confirm = Read-Host "Restore will modify database '$Database'. Type RESTORE to continue"
  if ($confirm -ne "RESTORE") {
    Write-Host "Restore canceled."
    exit 1
  }
}

Get-Content -Raw -LiteralPath $InputPath | docker compose -f $ComposeFile exec -T $Service psql -U $User -d $Database
Write-Host "Restore complete."
