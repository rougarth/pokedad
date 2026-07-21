param([switch]$SkipInstall)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$compose = @("compose", "--env-file", ".env.ngrok", "-f", "docker-compose.home-server.yml", "-f", "docker-compose.ngrok.yml")

function Invoke-Checked([scriptblock]$Command, [string]$FailureMessage) {
  & $Command
  if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
}

& "$PSScriptRoot\ngrok-home-server-backup.ps1"
if (-not $SkipInstall) { Invoke-Checked { npm ci } "Dependency installation failed." }
Invoke-Checked { npm run typecheck } "Typecheck failed."
Invoke-Checked { npm run build } "Build failed."
Invoke-Checked { npm audit } "Dependency audit failed."
Invoke-Checked { npm run security:check } "Security check failed."

$apiImage = "pokedad-home-server-api"
$webImage = "pokedad-home-server-web"
docker image inspect $apiImage *> $null
if ($LASTEXITCODE -eq 0) { docker tag $apiImage "$apiImage`:rollback" }
docker image inspect $webImage *> $null
if ($LASTEXITCODE -eq 0) { docker tag $webImage "$webImage`:rollback" }

try {
  Invoke-Checked { & docker @compose build } "Container build failed."
  Invoke-Checked { & docker @compose run --rm api npm run db:deploy } "Database deploy failed."
  Invoke-Checked { & docker @compose up -d } "Container startup failed."
  & "$PSScriptRoot\ngrok-home-server-check.ps1"
  Write-Host "Update completed and health checks passed."
} catch {
  Write-Warning "Update failed. Restoring previous application images. Database changes are not automatically reversed."
  docker image inspect "$apiImage`:rollback" *> $null
  if ($LASTEXITCODE -eq 0) { docker tag "$apiImage`:rollback" $apiImage }
  docker image inspect "$webImage`:rollback" *> $null
  if ($LASTEXITCODE -eq 0) { docker tag "$webImage`:rollback" $webImage }
  & docker @compose up -d --force-recreate api web ngrok
  throw
}
