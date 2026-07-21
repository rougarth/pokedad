param(
  [string]$ComposeFile = "docker-compose.production.yml",
  [string]$Service = "postgres",
  [string]$Database = $(if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "pokedad" }),
  [string]$User = $(if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "pokedad" }),
  [string]$OutputPath = "backups/pokedad-$(Get-Date -Format yyyyMMdd-HHmmss).sql"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path (Split-Path $OutputPath) | Out-Null

Write-Host "Creating PostgreSQL backup at $OutputPath"
docker compose -f $ComposeFile exec -T $Service pg_dump -U $User -d $Database | Set-Content -Encoding UTF8 -Path $OutputPath
Write-Host "Backup complete. Store this file securely."
