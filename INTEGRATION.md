# ManuPOS panel integrated into FoodTruckPOS

## What changed
- **Kept:** `app/` Android POS (Kotlin)
- **Replaced:** legacy `backend/public/admin` + `shop.html` with ManuPOS **backend + dashboard + online shop**
- **Added:** `/v1/*` Chaslay Android API compatibility (license, sync, orders, receipts)

## Deploy
1. Copy `.env.production.example` → `.env.production` and set secrets
2. For Chaslay domains use `deploy/Caddyfile.chaslay`
3. `docker compose up -d --build`
4. `docker compose run --rm migrate`

## Android app
Set in `app/build.gradle.kts`:
- `LICENSE_API_BASE_URL` → your API host (e.g. `https://api.chaslay.com/`)
- `SYNC_API_KEY` → merchant **sync API key** from ManuPOS superadmin (Merchants detail)

## Superadmin panel
- `https://admin.yourdomain.com` or main domain `/superadmin`
- Create merchants + device license keys there

## License activation
Use license keys generated in ManuPOS superadmin as Android activation codes.
