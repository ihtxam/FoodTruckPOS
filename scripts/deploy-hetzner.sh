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
  grep -qE '^PUBLIC_APP_URL=' "$ENV_FILE" || echo 'PUBLIC_APP_URL=https://app.chaslay.com' >>"$ENV_FILE"
  grep -qE '^PUBLIC_RECEIPT_BASE_URL=' "$ENV_FILE" || echo 'PUBLIC_RECEIPT_BASE_URL=https://pay.chaslay.com' >>"$ENV_FILE"
  grep -qE '^CORS_ALLOW_ALL=' "$ENV_FILE" || echo 'CORS_ALLOW_ALL=true' >>"$ENV_FILE"

  # Force known-good public URLs for this stack
  sed -i 's|^DOMAIN=.*|DOMAIN=chaslay.com|' "$ENV_FILE"
  sed -i 's|^PUBLIC_APP_URL=.*|PUBLIC_APP_URL=https://app.chaslay.com|' "$ENV_FILE"
  if grep -qE '^PUBLIC_RECEIPT_BASE_URL=' "$ENV_FILE"; then
    sed -i 's|^PUBLIC_RECEIPT_BASE_URL=.*|PUBLIC_RECEIPT_BASE_URL=https://pay.chaslay.com|' "$ENV_FILE"
  else
    echo 'PUBLIC_RECEIPT_BASE_URL=https://pay.chaslay.com' >>"$ENV_FILE"
  fi

  # Recover / normalize Brevo (Sendinblue) keys from this file or legacy Chaslay envs
  ensure_brevo_env "$ENV_FILE"
}

# Copy KEY=value from SRC into DEST if DEST is missing/empty for that key
copy_env_key() {
  local src="$1" dest="$2" key="$3"
  local val
  val="$(grep -E "^${key}=" "$src" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
  [[ -n "$val" ]] || return 0
  if grep -qE "^${key}=" "$dest"; then
    local existing
    existing="$(grep -E "^${key}=" "$dest" | tail -n1 | cut -d= -f2- || true)"
    if [[ -z "$existing" ]]; then
      sed -i "s|^${key}=.*|${key}=${val}|" "$dest"
      echo "Filled empty ${key} in $dest from legacy env"
    fi
  else
    echo "${key}=${val}" >>"$dest"
    echo "Imported ${key} into $dest from legacy env"
  fi
}

ensure_brevo_env() {
  local dest="$1"
  local candidates=(
    "$dest"
    /root/chaslay-secrets/.env
    /root/chaslay/.env
    /root/chaslay/.env.production
    /root/Chaslay/.env
    /root/Chaslay/.env.production
    /root/FoodTruckPOS/backend/.env
    /root/FoodTruckPOS/.env
    /opt/chaslay/.env
    /opt/chaslay/.env.production
  )

  local src
  for src in "${candidates[@]}"; do
    [[ -f "$src" ]] || continue
    copy_env_key "$src" "$dest" "BREVO_API_KEY"
    copy_env_key "$src" "$dest" "SENDINBLUE_API_KEY"
    copy_env_key "$src" "$dest" "SIB_API_KEY"
    copy_env_key "$src" "$dest" "BREVO_FROM_EMAIL"
    copy_env_key "$src" "$dest" "BREVO_SENDER_EMAIL"
    copy_env_key "$src" "$dest" "SENDINBLUE_FROM_EMAIL"
    copy_env_key "$src" "$dest" "BREVO_FROM_NAME"
    copy_env_key "$src" "$dest" "FROM_EMAIL"
    copy_env_key "$src" "$dest" "MAIL_FROM"
  done

  # Normalize aliases ? BREVO_* so docker-compose always has the preferred names
  local api from name
  api="$(grep -E '^(BREVO_API_KEY|SENDINBLUE_API_KEY|SIB_API_KEY)=' "$dest" 2>/dev/null | grep -v '=$' | head -n1 | cut -d= -f2- || true)"
  from="$(grep -E '^(BREVO_FROM_EMAIL|BREVO_SENDER_EMAIL|SENDINBLUE_FROM_EMAIL|FROM_EMAIL|MAIL_FROM)=' "$dest" 2>/dev/null | grep -v '=$' | head -n1 | cut -d= -f2- || true)"
  name="$(grep -E '^(BREVO_FROM_NAME|SENDINBLUE_FROM_NAME|MAIL_FROM_NAME)=' "$dest" 2>/dev/null | grep -v '=$' | head -n1 | cut -d= -f2- || true)"

  if [[ -n "$api" ]]; then
    if grep -qE '^BREVO_API_KEY=' "$dest"; then
      sed -i "s|^BREVO_API_KEY=.*|BREVO_API_KEY=${api}|" "$dest"
    else
      echo "BREVO_API_KEY=${api}" >>"$dest"
    fi
  fi
  if [[ -n "$from" ]]; then
    if grep -qE '^BREVO_FROM_EMAIL=' "$dest"; then
      sed -i "s|^BREVO_FROM_EMAIL=.*|BREVO_FROM_EMAIL=${from}|" "$dest"
    else
      echo "BREVO_FROM_EMAIL=${from}" >>"$dest"
    fi
  fi
  if [[ -n "$name" ]]; then
    if grep -qE '^BREVO_FROM_NAME=' "$dest"; then
      sed -i "s|^BREVO_FROM_NAME=.*|BREVO_FROM_NAME=${name}|" "$dest"
    else
      echo "BREVO_FROM_NAME=${name}" >>"$dest"
    fi
  elif ! grep -qE '^BREVO_FROM_NAME=' "$dest"; then
    echo "BREVO_FROM_NAME=Chaslay" >>"$dest"
  fi

  if grep -qE '^BREVO_API_KEY=.+' "$dest"; then
    echo "Brevo API key: present"
  else
    echo "Brevo API key: MISSING (set BREVO_API_KEY or SENDINBLUE_API_KEY in $dest)"
  fi
  if grep -qE '^BREVO_FROM_EMAIL=.+' "$dest"; then
    echo "Brevo from email: present ($(grep -E '^BREVO_FROM_EMAIL=' "$dest" | cut -d= -f2-))"
  else
    echo "Brevo from email: MISSING"
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


echo "=== Legacy license volume probe (non-fatal) ==="
bash "$REPO_DIR/scripts/recover-chaslay-licenses.sh" || true

echo "=== Email provider check ==="
if grep -qE '^BREVO_API_KEY=.+' "$ENV_FILE" && grep -qE '^BREVO_FROM_EMAIL=.+' "$ENV_FILE"; then
  echo "Brevo ready for merchant invite emails"
else
  echo "WARNING: Brevo not fully configured — invite links will be copy-only until BREVO_API_KEY + BREVO_FROM_EMAIL are set"
fi

echo "=== Deploy complete ==="
echo "  Admin:  https://app.chaslay.com/"
echo "  API:    https://api.chaslay.com/health"
echo "  Shop:   https://shop.chaslay.com/"
echo "  Pay:    https://pay.chaslay.com/receipt/"
echo "  Secrets: $ENV_FILE"
