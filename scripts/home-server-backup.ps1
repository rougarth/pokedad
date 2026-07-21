param([string]$OutputPath = "backups/home-server/pokedad-$(Get-Date -Format yyyyMMdd-HHmmss).sql")
$ErrorActionPreference = "Stop"
if (-not (Test-Path ".env.home-server")) { throw "Missing .env.home-server." }
& "$PSScriptRoot/backup-db.ps1" -ComposeFile "docker-compose.home-server.yml" -OutputPath $OutputPath
if ($LASTEXITCODE -ne 0) { throw "Backup failed." }
Write-Host "Home-server backup created. Copy it to protected storage and test restores periodically."
