param(
  [string]$OutputPath = "backups/ngrok-home-server/pokedad-$(Get-Date -Format yyyyMMdd-HHmmss).sql",
  [int]$RetentionDays = 14
)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Test-Path ".env.ngrok")) { throw "Missing .env.ngrok." }
& "$PSScriptRoot/backup-db.ps1" -ComposeFile "docker-compose.home-server.yml" -OutputPath $OutputPath
if ($LASTEXITCODE -ne 0) { throw "Database backup failed." }

$backupDirectory = Split-Path -Parent $OutputPath
if (Test-Path -LiteralPath $backupDirectory) {
  $cutoff = (Get-Date).AddDays(-$RetentionDays)
  Get-ChildItem -LiteralPath $backupDirectory -Filter "pokedad-*.sql" -File |
    Where-Object LastWriteTime -lt $cutoff |
    Remove-Item -Force
}
Write-Host "Backup created. Store a protected copy away from the home server."
