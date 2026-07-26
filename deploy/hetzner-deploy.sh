#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env.production ]]; then
  echo "Missing .env.production — copy from .env.production.example first"
  exit 1
fi

echo "==> Stopping conflicting stacks (if any)"
if [[ -d /opt/lexflow ]]; then
  (cd /opt/lexflow && docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production down || true)
fi

# Keep a backup outside the app tree so sync --delete cannot wipe secrets
cp -f .env.production /root/manupos.env.production

echo "==> Building and starting ManuPOS"
docker compose --env-file .env.production up -d --build migrate
docker compose --env-file .env.production up -d --build

echo "==> Waiting for API health"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:3000/health" >/dev/null 2>&1 || \
     docker compose --env-file .env.production exec -T api node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    echo "API is healthy"
    break
  fi
  sleep 2
done

echo "==> Status"
docker compose --env-file .env.production ps
echo "Deploy complete: https://${DOMAIN:-manupos.webprintmedia.swiss}"
