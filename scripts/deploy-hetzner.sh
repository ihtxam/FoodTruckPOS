#!/usr/bin/env bash
# Deploy FoodTruckPOS (ManuPOS panel + Android API) on Hetzner.
set -euo pipefail

REPO_DIR="${DEPLOY_PATH:-$HOME/FoodTruckPOS}"
SECRETS_DIR="${CHASLAY_SECRETS_DIR:-/root/chaslay-secrets}"
cd "$REPO_DIR"

echo "=== FoodTruckPOS / ManuPOS deploy @ $(date -u +"%Y-%m-%dT%H:%M:%SZ") ==="

mkdir -p "$SECRETS_DIR"
ENV_FILE="$SECRETS_DIR/.env.production"
LEGACY_ENV="$SECRETS_DIR/backend.env"

rand_hex() {
  openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | xxd -p -c 48 | head -1
}

env_get() {
  # env_get KEY file
  local key="$1" file="$2"
  [[ -f "$file" ]] || return 0
  # shellcheck disable=SC2002
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//' || true
}

ensure_env_production() {
  local jwt dbpass adminpass legacy_jwt legacy_admin legacy_dburl

  if [[ -f "$REPO_DIR/.env.production" && ! -L "$REPO_DIR/.env.production" && ! -f "$ENV_FILE" ]]; then
    cp "$REPO_DIR/.env.production" "$ENV_FILE"
    echo "Migrated secrets: .env.production -> $ENV_FILE"
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    cp "$REPO_DIR/.env.production.example" "$ENV_FILE"
    echo "Created $ENV_FILE from example"
  fi

  # Pull useful values from legacy Chaslay backend.env when present
  legacy_admin="$(env_get SUPERADMIN_PASSWORD "$LEGACY_ENV")"
  legacy_jwt="$(env_get LICENSE_SECRET "$LEGACY_ENV")"
  legacy_dburl="$(env_get DATABASE_URL "$LEGACY_ENV")"

  jwt="$(env_get JWT_SECRET "$ENV_FILE")"
  dbpass="$(env_get POSTGRES_PASSWORD "$ENV_FILE")"
  adminpass="$(env_get SEED_SUPERADMIN_PASSWORD "$ENV_FILE")"

  # Replace placeholders / empty required values
  if [[ -z "$jwt" || "$jwt" == replace-with-long-random-secret* ]]; then
    jwt="${legacy_jwt:-}"
    [[ -n "$jwt" && ${#jwt} -ge 16 ]] || jwt="$(rand_hex)"
    if grep -qE '^JWT_SECRET=' "$ENV_FILE"; then
      sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${jwt}|" "$ENV_FILE"
    else
      echo "JWT_SECRET=${jwt}" >>"$ENV_FILE"
    fi
    echo "Set JWT_SECRET in $ENV_FILE"
  fi

  if [[ -z "$dbpass" || "$dbpass" == replace-with-strong-db-password* ]]; then
    # Prefer password embedded in legacy DATABASE_URL user:pass@
    if [[ -n "$legacy_dburl" ]]; then
      dbpass="$(printf '%s' "$legacy_dburl" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')"
    fi
    [[ -n "$dbpass" ]] || dbpass="$(rand_hex)"
    if grep -qE '^POSTGRES_PASSWORD=' "$ENV_FILE"; then
      sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${dbpass}|" "$ENV_FILE"
    else
      echo "POSTGRES_PASSWORD=${dbpass}" >>"$ENV_FILE"
    fi
    echo "Set POSTGRES_PASSWORD in $ENV_FILE"
  fi

  # Bootstrap panel password (seed syncs this into Postgres on every migrate)
  adminpass="${SEED_SUPERADMIN_PASSWORD_OVERRIDE:-ChaslayAdmin123!}"
  if [[ -n "$legacy_admin" && "$legacy_admin" != "change_me_superadmin_password" && -z "${SEED_SUPERADMIN_PASSWORD_OVERRIDE:-}" ]]; then
    adminpass="$legacy_admin"
  fi
  if grep -qE '^SEED_SUPERADMIN_PASSWORD=' "$ENV_FILE"; then
    sed -i "s|^SEED_SUPERADMIN_PASSWORD=.*|SEED_SUPERADMIN_PASSWORD=${adminpass}|" "$ENV_FILE"
  else
    echo "SEED_SUPERADMIN_PASSWORD=${adminpass}" >>"$ENV_FILE"
  fi
  echo "Synced SEED_SUPERADMIN_PASSWORD in $ENV_FILE"
  # Recovery default for panel login (override with SEED_SUPERADMIN_PASSWORD_OVERRIDE)
  if [[ "${FORCE_CHASLAY_ADMIN_BOOTSTRAP:-1}" == "1" ]]; then
    sed -i "s|^SEED_SUPERADMIN_PASSWORD=.*|SEED_SUPERADMIN_PASSWORD=ChaslayAdmin123!|" "$ENV_FILE"
    echo "Forced SEED_SUPERADMIN_PASSWORD=ChaslayAdmin123! (set FORCE_CHASLAY_ADMIN_BOOTSTRAP=0 to keep custom)"
  fi

  # Ensure Chaslay host defaults
  grep -qE '^DOMAIN=' "$ENV_FILE" || echo 'DOMAIN=chaslay.com' >>"$ENV_FILE"
  grep -qE '^PUBLIC_APP_URL=' "$ENV_FILE" || echo 'PUBLIC_APP_URL=https://admin.chaslay.com' >>"$ENV_FILE"
  grep -qE '^PUBLIC_RECEIPT_BASE_URL=' "$ENV_FILE" || echo 'PUBLIC_RECEIPT_BASE_URL=https://pay.chaslay.com' >>"$ENV_FILE"
  grep -qE '^CORS_ALLOW_ALL=' "$ENV_FILE" || echo 'CORS_ALLOW_ALL=true' >>"$ENV_FILE"

  # Force known-good public URLs for this stack
  sed -i 's|^DOMAIN=.*|DOMAIN=chaslay.com|' "$ENV_FILE"
  sed -i 's|^PUBLIC_APP_URL=.*|PUBLIC_APP_URL=https://admin.chaslay.com|' "$ENV_FILE"
  if grep -qE '^PUBLIC_RECEIPT_BASE_URL=' "$ENV_FILE"; then
    sed -i 's|^PUBLIC_RECEIPT_BASE_URL=.*|PUBLIC_RECEIPT_BASE_URL=https://pay.chaslay.com|' "$ENV_FILE"
  else
    echo 'PUBLIC_RECEIPT_BASE_URL=https://pay.chaslay.com' >>"$ENV_FILE"
  fi
}

ensure_env_production

ln -sfn "$ENV_FILE" "$REPO_DIR/.env.production"
ln -sfn "$ENV_FILE" "$REPO_DIR/.env"

echo "=== Git pull ==="
git fetch origin main
git reset --hard origin/main
chmod +x "$REPO_DIR/scripts/deploy-hetzner.sh" || true

# Re-exec updated script so new ensure_env_production / seed logic is used
if [[ "${DEPLOY_POST_PULL:-}" != "1" ]]; then
  echo "=== Re-executing updated deploy script ==="
  exec env DEPLOY_POST_PULL=1 bash "$REPO_DIR/scripts/deploy-hetzner.sh"
fi

ensure_env_production
ln -sfn "$ENV_FILE" "$REPO_DIR/.env.production"
ln -sfn "$ENV_FILE" "$REPO_DIR/.env"

echo "=== Stop legacy backend compose (frees :80/:443) ==="
if [[ -f "$REPO_DIR/backend/docker-compose.yml" ]]; then
  (cd "$REPO_DIR/backend" && docker compose down || true)
fi
# Also stop any leftover containers from old stack names
docker rm -f backend-caddy-1 backend-api-1 backend-receipts-1 backend-postgres-1 2>/dev/null || true

echo "=== Docker build & start ==="
docker compose --env-file .env.production up -d --build

echo "=== Wait for services ==="
sleep 20

echo "=== Database migrate / seed ==="
docker compose --env-file .env.production run --rm migrate

echo "=== Health checks ==="
API_HEALTH="$(curl -sf http://127.0.0.1:3000/health || docker compose --env-file .env.production exec -T api wget -qO- http://127.0.0.1:3000/health || true)"
echo "local api: ${API_HEALTH:-unreachable}"
curl -sf https://api.chaslay.com/health || true
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

FLOOR_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H 'X-Api-Key: invalid' http://127.0.0.1:3000/v1/floor/main-pos || true)
echo "floor/main-pos HTTP ${FLOOR_CODE:-unreachable} (401 expected without valid API key)"

echo "=== Deploy complete ==="
echo "  Admin:  https://admin.chaslay.com/"
echo "  API:    https://api.chaslay.com/health"
echo "  Shop:   https://shop.chaslay.com/"
echo "  Pay:    https://pay.chaslay.com/receipt/"
echo "  Secrets: $ENV_FILE"
