#!/usr/bin/env bash
# Run on Hetzner: bash scripts/diagnose-receipts.sh
set -euo pipefail

REPO_DIR="${DEPLOY_PATH:-$HOME/FoodTruckPOS}"
cd "$REPO_DIR/backend"

echo "=== Docker services ==="
docker compose ps

echo ""
echo "=== Local health (inside server) ==="
curl -sf http://localhost:3000/health && echo "  api:3000 OK" || echo "  api:3000 FAIL"
curl -sf http://localhost:8080/health && echo "  receipts:8080 OK" || echo "  receipts:8080 FAIL"

echo ""
echo "=== Public HTTPS ==="
curl -sf https://api.chaslay.com/health && echo "  api.chaslay.com OK" || echo "  api.chaslay.com FAIL"
curl -sf https://pay.chaslay.com/health && echo "  pay.chaslay.com OK" || echo "  pay.chaslay.com FAIL (check Caddy TLS for pay.chaslay.com)"

echo ""
echo "=== Receipt publish test (needs API_KEY in backend/receipts.env) ==="
API_KEY=$(grep -E '^API_KEY=' receipts.env 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)
if [[ -z "$API_KEY" ]]; then
  echo "  Set API_KEY in backend/receipts.env"
else
  TEST_ID="diag-$(date +%s)"
  CODE=$(curl -sS -o /tmp/receipt-test.json -w "%{http_code}" \
    -X POST "https://api.chaslay.com/v1/receipts" \
    -H "Content-Type: application/json" \
    -H "X-Api-Key: $API_KEY" \
    -d "{\"id\":\"$TEST_ID\",\"transaction_number\":\"TEST\",\"total\":9.90,\"currency\":\"CHF\",\"payment_method\":\"CASH\",\"business_name\":\"Test\",\"created_at\":$(date +%s000),\"items\":[]}")
  echo "  POST api.chaslay.com/v1/receipts -> HTTP $CODE"
  cat /tmp/receipt-test.json
  echo ""
  curl -sf "https://pay.chaslay.com/receipts/$TEST_ID" >/dev/null && echo "  pay URL OK" || echo "  pay URL FAIL"
fi

echo ""
echo "=== Recent Caddy logs (TLS / pay.chaslay.com) ==="
docker compose logs caddy --tail 30

echo ""
echo "=== Recent receipts logs ==="
docker compose logs receipts --tail 20
