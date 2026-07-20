#!/usr/bin/env bash
# Auto-deploy script — run on Hetzner after git pull (or via GitHub Actions).
set -euo pipefail

REPO_DIR="${DEPLOY_PATH:-$HOME/FoodTruckPOS}"
BACKEND_DIR="$REPO_DIR/backend"
SECRETS_DIR="${CHASLAY_SECRETS_DIR:-/root/chaslay-secrets}"
cd "$REPO_DIR"

echo "=== ChaslayPOS deploy @ $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="

mkdir -p "$SECRETS_DIR"

BACKEND_ENV="$SECRETS_DIR/backend.env"
RECEIPTS_ENV="$SECRETS_DIR/receipts.env"

# One-time migration: move env files out of git repo (survives git pull / reset)
if [[ -f "$BACKEND_DIR/.env" && ! -L "$BACKEND_DIR/.env" && ! -f "$BACKEND_ENV" ]]; then
  cp "$BACKEND_DIR/.env" "$BACKEND_ENV"
  echo "Migrated secrets: backend/.env -> $BACKEND_ENV"
fi
if [[ -f "$BACKEND_DIR/receipts.env" && ! -L "$BACKEND_DIR/receipts.env" && ! -f "$RECEIPTS_ENV" ]]; then
  cp "$BACKEND_DIR/receipts.env" "$RECEIPTS_ENV"
  echo "Migrated secrets: backend/receipts.env -> $RECEIPTS_ENV"
fi

if [[ ! -f "$BACKEND_ENV" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_ENV"
  echo ""
  echo "IMPORTANT: Edit secrets (they persist outside git):"
  echo "  nano $BACKEND_ENV"
  echo ""
fi

if [[ ! -f "$RECEIPTS_ENV" ]]; then
  cp "$BACKEND_DIR/receipts.env.example" "$RECEIPTS_ENV"
  echo "Created $RECEIPTS_ENV — set SMTP + API_KEY when ready."
fi

# Docker compose reads backend/.env — symlink to permanent secrets (never overwritten by git)
ln -sfn "$BACKEND_ENV" "$BACKEND_DIR/.env"
ln -sfn "$RECEIPTS_ENV" "$BACKEND_DIR/receipts.env"

echo "=== Git pull ==="
git fetch origin main
git reset --hard origin/main

# Re-link after git reset (in case .env was tracked by mistake)
ln -sfn "$BACKEND_ENV" "$BACKEND_DIR/.env"
ln -sfn "$RECEIPTS_ENV" "$BACKEND_DIR/receipts.env"

cd "$BACKEND_DIR"

echo "=== Docker build & start (api + receipts + caddy + postgres) ==="
docker compose up -d --build

echo "=== Wait for services ==="
sleep 12

echo "=== Database migrate ==="
docker compose exec -T api npm run migrate

echo "=== Seed (idempotent) ==="
docker compose exec -T api npm run seed || true

echo "=== Health checks ==="
curl -sf http://localhost:3000/health && echo " api OK"
curl -sf http://localhost:8080/health && echo " receipts OK"

POS_AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/v1/pos/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"healthcheck@chaslay.local","password":"wrong"}')
if [[ "$POS_AUTH_CODE" == "401" ]]; then
  echo " pos-auth OK (tablet login route live)"
elif [[ "$POS_AUTH_CODE" == "404" ]]; then
  echo " ERROR: /v1/pos/auth/login not found (404). API container may be running old code."
  exit 1
else
  echo " pos-auth HTTP $POS_AUTH_CODE"
fi

echo ""
echo "Deploy complete."
echo "  Secrets (permanent): $BACKEND_ENV"
echo "  Superadmin password: stored in Postgres after first login (survives redeploys)"
echo "  Reset superadmin:    docker compose exec api npm run set-superadmin-password -- 'NewPassword123'"
echo "  API:    https://api.chaslay.com/health"
echo "  Admin:  https://admin.chaslay.com/"
echo "  Shop:   https://shop.chaslay.com/demo"
echo "  Pay:    https://pay.chaslay.com/receipts/"
