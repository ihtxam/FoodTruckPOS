# FoodTruck POS API (Node.js)

Backend for **license activation**, **menu sync**, and **online orders**. Designed for a **Hetzner VPS** with Docker Compose.

## What this gives you

| Endpoint | Used by | Auth |
|----------|---------|------|
| `POST /v1/license/activate` | Android POS | Public |
| `POST /v1/license/validate` | Android POS | Public |
| `GET /v1/sync/bootstrap` | POS (future) | `X-Api-Key` |
| `GET /v1/sync/menu?since=` | POS (future) | `X-Api-Key` |
| `GET /v1/orders/menu` | Online shop | Public |
| `POST /v1/orders` | Online shop | Public |
| `GET /v1/orders/incoming` | POS (future) | `X-Api-Key` |
| `POST /v1/orders/:id/ack` | POS (future) | `X-Api-Key` |

License routes match the Android app (`LicenseApi.kt`).

## Deploy on Hetzner VPS

### 1. Server prep

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git docker.io docker-compose-plugin
sudo usermod -aG docker $USER
# log out and back in
```

### 2. Clone and configure

```bash
git clone https://github.com/ihtxam/FoodTruckPOS.git
cd FoodTruckPOS/backend
cp .env.example .env
nano .env   # set strong POSTGRES_PASSWORD, API_KEY, LICENSE_SECRET
```

Edit `Caddyfile` — replace `api.example.com` with your domain (e.g. `api.yourdomain.com`).

Point DNS **A record** ? your VPS IP.

### 3. Start stack

```bash
docker compose up -d --build
docker compose exec api npm run migrate
docker compose exec api npm run seed
```

### 4. Generate activation code for a device

After the merchant opens the POS activation screen, copy the **Device ID**, then:

```bash
docker compose exec api npm run generate-code -- --deviceId=PASTE-DEVICE-UUID --days=365 --label="Merchant Name"
```

Give the printed code to the merchant.

### 5. Point Android app to your server

In `app/build.gradle.kts`:

```kotlin
buildConfigField("String", "LICENSE_API_BASE_URL", "\"https://api.yourdomain.com/\"")
```

Rebuild and install the APK.

## Local development

```bash
cd backend
cp .env.example .env
# Use localhost postgres or: docker compose up -d postgres
npm install
npm run migrate
npm run seed
npm run dev
```

Health check: `http://localhost:3000/health`

## Online shop (next step)

Use `GET /v1/orders/menu` for the public menu and `POST /v1/orders` to place orders. A small Next.js or static shop can live on the same VPS behind Caddy at `order.yourdomain.com`.

POS will pull new orders via `GET /v1/orders/incoming` (with `X-Api-Key`) — wire this in the Android app next.

## Security checklist

- Change all secrets in `.env`
- Keep Postgres off the public internet (Docker internal network only)
- Use HTTPS via Caddy
- Later: rate-limit public order endpoint, add shop API key, Stripe webhooks

## Backup

```bash
docker compose exec postgres pg_dump -U foodtruck foodtruckpos > backup.sql
```

Enable Hetzner VPS snapshots weekly.
