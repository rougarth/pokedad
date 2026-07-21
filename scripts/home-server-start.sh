#!/usr/bin/env sh
set -eu
test -f .env.home-server || { echo "Missing .env.home-server" >&2; exit 1; }
docker info >/dev/null
docker compose --env-file .env.home-server -f docker-compose.home-server.yml config --quiet
docker compose --env-file .env.home-server -f docker-compose.home-server.yml up -d
docker compose --env-file .env.home-server -f docker-compose.home-server.yml ps
