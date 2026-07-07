#!/usr/bin/env bash
# Auto-deploy script — run on Hetzner after git pull (or via GitHub Actions).
set -euo pipefail

REPO_DIR="${DEPLOY_PATH:-$HOME/FoodTruckPOS}"
BACKEND_DIR="$REPO_DIR/backend"
cd "$REPO_DIR"

echo "=== ChaslayPOS deploy @ $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="
echo "=== Git pull ==="
git fetch origin main
git reset --hard origin/main

BACKEND_ENV="$BACKEND_DIR/.env"
RECEIPTS_ENV="$BACKEND_DIR/receipts.env"

if [[ ! -f "$BACKEND_ENV" ]]; then
  echo "ERROR: Missing $BACKEND_ENV"
  echo "Copy backend/.env.example to backend/.env and set secrets on the server."
  exit 1
fi

if [[ ! -f "$RECEIPTS_ENV" ]]; then
  echo "WARNING: Missing $RECEIPTS_ENV — copying from receipts.env.example"
  cp "$BACKEND_DIR/receipts.env.example" "$RECEIPTS_ENV"
  echo "Edit $RECEIPTS_ENV (SMTP + API_KEY) before production use."
fi

cd "$BACKEND_DIR"

echo "=== Docker build & start (api + receipts + caddy + postgres) ==="
docker compose up -d --build

echo "=== Wait for services ==="
sleep 12

echo "=== Database migrate ==="
docker compose exec -T api npm run migrate

echo "=== Seed (idempotent) ==="
docker compose exec -T api npm run seed || true

echo "=== Sushi Sake shop menu (idempotent) ==="
docker compose exec -T api npm run seed-sushi-sake-menu -- --slug=sushi-sake || true

echo "=== Health checks ==="
curl -sf http://localhost:3000/health && echo " api OK"
curl -sf http://localhost:8080/health && echo " receipts OK"

echo ""
echo "Deploy complete."
echo "  API:    https://api.chaslay.com/health"
echo "  Admin:  https://admin.chaslay.com/"
echo "  Shop:   https://shop.chaslay.com/demo"
echo "  Pay:    https://pay.chaslay.com/receipts/"
