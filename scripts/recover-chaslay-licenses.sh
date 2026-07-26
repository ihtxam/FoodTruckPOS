#!/usr/bin/env bash
# Probe for legacy Chaslay Postgres volume and print tenants / activation codes.
# Does not modify production DB unless IMPORT=1.
set -euo pipefail

echo "=== Docker volumes ==="
docker volume ls

CANDIDATES=$(docker volume ls -q | rg -i 'postgres|backend|foodtruck|chaslay' || true)
echo "Candidates:"
echo "$CANDIDATES"

for vol in $CANDIDATES; do
  echo ""
  echo "=== Probing volume: $vol ==="
  docker run --rm -v "$vol:/var/lib/postgresql/data:ro" postgres:16-alpine \
    sh -c 'ls -la /var/lib/postgresql/data 2>/dev/null | head -20' || true
done

# If an old stack DB is still reachable as a stopped container's volume, try SQL dump of license tables
OLD_VOL=$(docker volume ls -q | rg -i '^backend_postgres' | head -1 || true)
if [[ -z "$OLD_VOL" ]]; then
  OLD_VOL=$(docker volume ls -q | rg -i 'postgres' | rg -iv 'foodtruckpos_postgres' | head -1 || true)
fi

if [[ -z "$OLD_VOL" ]]; then
  echo "No legacy postgres volume found. Old merchants must be recreated in Superadmin."
  exit 0
fi

echo "Using legacy volume: $OLD_VOL"
# Start ephemeral postgres against that data directory (may fail if already in use / wrong major)
CID=$(docker run -d -e POSTGRES_HOST_AUTH_METHOD=trust -v "$OLD_VOL:/var/lib/postgresql/data" postgres:16-alpine)
sleep 5
cleanup() { docker rm -f "$CID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "=== Legacy tenants ==="
docker exec "$CID" psql -U postgres -d foodtruckpos -c \
  "SELECT id, slug, name, api_key IS NOT NULL AS has_key FROM tenants ORDER BY created_at NULLS LAST;" 2>/dev/null \
  || docker exec "$CID" psql -U foodtruck -d foodtruckpos -c \
  "SELECT id, slug, name FROM tenants;" 2>/dev/null \
  || echo "(could not query tenants)"

echo "=== Legacy devices ==="
docker exec "$CID" psql -U postgres -d foodtruckpos -c \
  "SELECT tenant_id, device_id, status, to_timestamp(expires_at/1000) AS expires FROM devices ORDER BY activated_at DESC NULLS LAST LIMIT 50;" 2>/dev/null \
  || echo "(could not query devices)"

echo "=== Legacy activation codes (unused) ==="
docker exec "$CID" psql -U postgres -d foodtruckpos -c \
  "SELECT tenant_id, label, bound_device_id, valid_days, used_at IS NOT NULL AS used FROM activation_codes ORDER BY created_at DESC LIMIT 50;" 2>/dev/null \
  || echo "(could not query activation_codes — codes are hashed, recreate from device IDs)"

echo "Done. Recreate merchants in ManuPOS Superadmin, then Issue license → For POS device ID."
