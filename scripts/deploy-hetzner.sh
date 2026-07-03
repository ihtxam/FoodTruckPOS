#!/usr/bin/env bash
# Auto-deploy script — run on Hetzner after git pull (or via GitHub Actions).
set -euo pipefail

REPO_DIR="${DEPLOY_PATH:-$HOME/FoodTruckPOS}"
cd "$REPO_DIR"

echo "=== ChaslayPOS deploy @ $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="
echo "=== Git pull ==="
git fetch origin main
git reset --hard origin/main

BACKEND_ENV="$REPO_DIR/backend/.env"
RECEIPTS_ENV="$REPO_DIR/server/chaslay-receipts/.env"

if [[ ! -f "$BACKEND_ENV" ]]; then
  echo "ERROR: Missing $BACKEND_ENV"
  echo "Copy backend/.env.example to backend/.env and set secrets on the server."
  exit 1
fi

if [[ ! -f "$RECEIPTS_ENV" ]]; then
  echo "WARNING: Missing $RECEIPTS_ENV — copying from .env.example"
  cp "$REPO_DIR/server/chaslay-receipts/.env.example" "$RECEIPTS_ENV"
  echo "Edit $RECEIPTS_ENV before production use."
fi

cd "$REPO_DIR/backend"

echo "=== Docker build & start ==="
docker compose up -d --build

echo "=== Wait for API ==="
sleep 12

echo "=== Database migrate ==="
docker compose exec -T api npm run migrate

echo "=== Seed (idempotent) ==="
docker compose exec -T api npm run seed || true

echo "=== Health checks ==="
curl -sf http://localhost:3000/health && echo " api OK"
curl -sf http://localhost:8080/health && echo " receipts OK"

echo ""
echo "Deploy complete."
echo "  API:    https://api.chaslay.com/health"
echo "  Admin:  https://admin.chaslay.com/"
echo "  Shop:   https://shop.chaslay.com/demo"
echo "  Pay:    https://pay.chaslay.com/receipts/"
