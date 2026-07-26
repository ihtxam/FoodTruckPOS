#!/usr/bin/env bash
# Deploy FoodTruckPOS (ManuPOS panel + Android API) on Hetzner.
set -euo pipefail

REPO_DIR="${DEPLOY_PATH:-$HOME/FoodTruckPOS}"
SECRETS_DIR="${CHASLAY_SECRETS_DIR:-/root/chaslay-secrets}"
cd "$REPO_DIR"

echo "=== FoodTruckPOS / ManuPOS deploy @ $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="

mkdir -p "$SECRETS_DIR"
ENV_FILE="$SECRETS_DIR/.env.production"

if [[ -f "$REPO_DIR/.env.production" && ! -L "$REPO_DIR/.env.production" && ! -f "$ENV_FILE" ]]; then
  cp "$REPO_DIR/.env.production" "$ENV_FILE"
  echo "Migrated secrets: .env.production -> $ENV_FILE"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$REPO_DIR/.env.production.example" "$ENV_FILE"
  echo "IMPORTANT: Edit secrets: nano $ENV_FILE"
fi

ln -sfn "$ENV_FILE" "$REPO_DIR/.env.production"
ln -sfn "$ENV_FILE" "$REPO_DIR/.env"

echo "=== Git pull ==="
git fetch origin main
git reset --hard origin/main
ln -sfn "$ENV_FILE" "$REPO_DIR/.env.production"
ln -sfn "$ENV_FILE" "$REPO_DIR/.env"

echo "=== Docker build & start ==="
docker compose --env-file .env.production up -d --build

echo "=== Wait for services ==="
sleep 15

echo "=== Database migrate / seed ==="
docker compose --env-file .env.production run --rm migrate

echo "=== Health checks ==="
curl -sf http://localhost:3000/health || curl -sf https://api.chaslay.com/health || true
echo

POS_AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3000/v1/pos/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"healthcheck@chaslay.local","password":"wrong"}' || true)
if [[ "$POS_AUTH_CODE" == "400" || "$POS_AUTH_CODE" == "401" || "$POS_AUTH_CODE" == "403" ]]; then
  echo "pos-auth OK (route live, HTTP $POS_AUTH_CODE)"
elif [[ "$POS_AUTH_CODE" == "404" ]]; then
  echo "ERROR: /v1/pos/auth/login not found (404)"
  exit 1
else
  echo "pos-auth HTTP ${POS_AUTH_CODE:-unreachable}"
fi

FLOOR_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/v1/floor/main-pos || true)
echo "floor/main-pos HTTP ${FLOOR_CODE:-unreachable} (401 expected without API key)"

echo "=== Deploy complete ==="
