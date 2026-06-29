#!/bin/bash
# Run on Hetzner: bash SERVER_SETUP.sh
set -e
cd ~/FoodTruckPOS
git pull
cd backend

echo "=== Rebuild and start ==="
docker compose up -d --build
sleep 12

echo "=== Migrate database ==="
docker compose exec api npm run migrate

echo "=== Seed demo tenant (safe to re-run) ==="
docker compose exec api npm run seed || true

echo "=== Health check ==="
curl -s http://localhost:3000/health
echo ""

echo "=== CSS check (must start with :root) ==="
curl -s http://localhost:3000/admin/admin.css | head -1

echo ""
echo "=== Create merchant login (edit email/password if needed) ==="
docker compose exec api npm run create-merchant-user -- \
  --tenantSlug=demo \
  --email=owner@shop.com \
  --password=ChangeMe123 \
  --name="Shop Owner" || true

echo ""
echo "Done."
echo "  Admin:  https://admin.chaslay.com/"
echo "  Shop:   https://shop.chaslay.com/demo"
echo "  Health: https://api.chaslay.com/health"
echo ""
echo "Login:"
echo "  Merchant: owner@shop.com / ChangeMe123"
echo "  Platform admin: SUPERADMIN_PASSWORD from .env"
