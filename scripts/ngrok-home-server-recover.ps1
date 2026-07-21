param(
  [int]$DockerWaitMinutes = 10,
  [int]$RetrySeconds = 15
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is not installed or not available in PATH."
}

$deadline = (Get-Date).AddMinutes($DockerWaitMinutes)
do {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds $RetrySeconds
} while ((Get-Date) -lt $deadline)

if ($LASTEXITCODE -ne 0) {
  throw "Docker did not become ready within $DockerWaitMinutes minutes."
}

$compose = @("compose", "--env-file", ".env.ngrok", "-f", "docker-compose.home-server.yml", "-f", "docker-compose.ngrok.yml")
& docker @compose up -d
if ($LASTEXITCODE -ne 0) { throw "The home-server containers could not be started." }
& "$PSScriptRoot\ngrok-home-server-check.ps1"
Write-Host "PokeDad Radar recovered after startup."
