# Chaslay POS — deploy checklist

Server IP: **116.202.26.15**

| Domain | Purpose |
|--------|---------|
| `api.chaslay.com` | POS license, menu sync, order API |
| `shop.chaslay.com/{clientName}` | Customer online shop per merchant |
| `admin.chaslay.com` | Merchant back office (placeholder for now) |

---

## 1. DNS (you)

Point these **A records** to `116.202.26.15`:

- `api.chaslay.com`
- `shop.chaslay.com`
- `admin.chaslay.com`

---

## 2. Deploy / update backend on Hetzner

```bash
ssh root@116.202.26.15
cd FoodTruckPOS   # or git clone https://github.com/ihtxam/FoodTruckPOS.git
git pull
cd backend
cp .env.example .env   # skip if .env already exists
nano .env              # set secrets (see below)
docker compose up -d --build
docker compose exec api npm run migrate
docker compose exec api npm run seed
```

**`.env` secrets:**

| Variable | Notes |
|----------|--------|
| `POSTGRES_PASSWORD` | Long random password |
| `API_KEY` | Global fallback key; also assigned to `demo` tenant on seed |
| `LICENSE_SECRET` | Min 32 chars |

`Caddyfile` is already set for `api.chaslay.com`, `shop.chaslay.com`, `admin.chaslay.com`.

**Health check:** https://api.chaslay.com/health

---

## 3. Create a merchant (client)

Each merchant gets a URL slug and their own POS API key:

```bash
docker compose exec api npm run create-tenant -- --slug=acme-burger --name="Acme Burger"
```

This prints:

- **POS API key** ? put in Android `SYNC_API_KEY`
- **Shop URL** ? `https://shop.chaslay.com/acme-burger`

Demo tenant (after seed): https://shop.chaslay.com/demo

---

## 4. Android app config

In `app/build.gradle.kts` (per merchant build):

```kotlin
buildConfigField("String", "LICENSE_API_BASE_URL", "\"https://api.chaslay.com/\"")
buildConfigField("String", "TENANT_SLUG", "\"acme-burger\"")
buildConfigField("String", "SYNC_API_KEY", "\"PASTE_TENANT_API_KEY_FROM_CREATE-TENANT\"")
```

- `TENANT_SLUG` must match the merchant slug (license + sync scope).
- `SYNC_API_KEY` is the **per-tenant** key from `create-tenant`, not necessarily the global `API_KEY`.

Rebuild and install the APK.

---

## 5. License activation code

When the POS shows a **Device ID**:

```bash
docker compose exec api npm run generate-code -- --tenantSlug=acme-burger --deviceId=PASTE-UUID --days=365 --label="Acme Burger"
```

Send the printed code to the merchant.

---

## 6. How online shops work

- Public menu: `GET /v1/shop/{clientName}/menu`
- Place order: `POST /v1/shop/{clientName}/orders`
- Storefront page: `https://shop.chaslay.com/{clientName}`

Orders appear in POS **Ongoing Orders** when the tablet is online and `SYNC_API_KEY` is set.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Activation fails | Check HTTPS, `LICENSE_API_BASE_URL`, and `TENANT_SLUG` matches merchant |
| Sync does nothing | Set tenant `SYNC_API_KEY` in app (from `create-tenant`) |
| Shop 404 | Run `create-tenant` or `seed`; slug must be lowercase `a-z`, `0-9`, hyphens |
| SSL not ready | Wait for DNS propagation; Caddy issues certs automatically |

---

## Optional later

- Stripe for online payment
- Full admin UI at `admin.chaslay.com`
- POS menu push to server
- Waiter / kiosk apps
