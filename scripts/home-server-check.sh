#!/usr/bin/env sh
set -eu
test -f .env.home-server || { echo "Missing .env.home-server" >&2; exit 1; }
docker compose --env-file .env.home-server -f docker-compose.home-server.yml ps
docker compose --env-file .env.home-server -f docker-compose.home-server.yml exec -T web wget -qO- http://127.0.0.1/api/health >/dev/null
docker compose --env-file .env.home-server -f docker-compose.home-server.yml exec -T postgres pg_isready -U pokedad -d pokedad >/dev/null
docker compose --env-file .env.home-server -f docker-compose.home-server.yml exec -T redis redis-cli ping >/dev/null
echo "Internal web/API, PostgreSQL, and Redis checks passed."
