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

[[ -f backend/.env ]] || cp backend/.env.example backend/.env
[[ -f server/chaslay-receipts/.env ]] || cp server/chaslay-receipts/.env.example server/chaslay-receipts/.env

echo ""
echo "Edit secrets before going live:"
echo "  nano $DEPLOY_PATH/backend/.env"
echo "  nano $DEPLOY_PATH/server/chaslay-receipts/.env"
echo ""
echo "Then run: bash $DEPLOY_PATH/scripts/deploy-hetzner.sh"
