#!/usr/bin/env bash
# First-time Hetzner bootstrap. Run as root on a fresh VPS.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ihtxam/FoodTruckPOS.git}"
DEPLOY_PATH="${DEPLOY_PATH:-/root/FoodTruckPOS}"

apt-get update
apt-get install -y git docker.io docker-compose-plugin curl
systemctl enable --now docker

if [[ ! -d "$DEPLOY_PATH/.git" ]]; then
  git clone "$REPO_URL" "$DEPLOY_PATH"
fi

cd "$DEPLOY_PATH"
chmod +x scripts/deploy-hetzner.sh

SECRETS_DIR="${CHASLAY_SECRETS_DIR:-/root/chaslay-secrets}"
mkdir -p "$SECRETS_DIR"

[[ -f "$SECRETS_DIR/backend.env" ]] || cp backend/.env.example "$SECRETS_DIR/backend.env"
[[ -f "$SECRETS_DIR/receipts.env" ]] || cp backend/receipts.env.example "$SECRETS_DIR/receipts.env"
ln -sfn "$SECRETS_DIR/backend.env" backend/.env
ln -sfn "$SECRETS_DIR/receipts.env" backend/receipts.env

echo ""
echo "Edit secrets before going live (these files are NEVER overwritten by git deploy):"
echo "  nano $SECRETS_DIR/backend.env"
echo "  nano $SECRETS_DIR/receipts.env"
echo ""
echo "Set SUPERADMIN_PASSWORD once — it is copied to the database and kept after redeploys."
echo "Or after deploy: docker compose exec api npm run set-superadmin-password -- 'YourPassword123'"
echo ""
echo "Then run: bash $DEPLOY_PATH/scripts/deploy-hetzner.sh"
