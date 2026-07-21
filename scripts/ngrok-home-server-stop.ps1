$ErrorActionPreference = "Stop"
if (-not (Test-Path ".env.ngrok")) { throw "Missing .env.ngrok." }
docker compose --env-file .env.ngrok -f docker-compose.home-server.yml -f docker-compose.ngrok.yml stop
Write-Host "ngrok home-server containers stopped. Persistent volumes were preserved."

