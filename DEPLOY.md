# FoodTruck POS — what you need to do

This is your checklist while the code side is prepared. You can do these steps over the next few days.

## 1. Hetzner VPS (one-time)

- [ ] Create a VPS (CX22 or CPX21 is enough to start)
- [ ] Note the **public IP address**
- [ ] SSH in: `ssh root@YOUR_VPS_IP`
- [ ] Install Docker (see `backend/README.md`)

## 2. Domain & DNS

- [ ] Buy/use a domain (e.g. `yourbrand.com`)
- [ ] Add DNS **A record**: `api.yourbrand.com` ? VPS IP
- [ ] Optional later: `order.yourbrand.com` for online shop

## 3. Deploy the backend

```bash
git clone https://github.com/ihtxam/FoodTruckPOS.git
cd FoodTruckPOS/backend
cp .env.example .env
nano .env          # set strong passwords (see below)
nano Caddyfile     # replace api.example.com with api.yourbrand.com
docker compose up -d --build
docker compose exec api npm run migrate
docker compose exec api npm run seed
```

**Set in `.env` (important):**

| Variable | What to set |
|----------|-------------|
| `POSTGRES_PASSWORD` | Long random password |
| `API_KEY` | Long random string (same value goes in Android app) |
| `LICENSE_SECRET` | Long random string (min 32 chars) |

Test: open `https://api.yourbrand.com/health` — should return `{"ok":true,...}`

## 4. Android app configuration

After backend is live, tell me (or edit yourself) in `app/build.gradle.kts`:

```kotlin
buildConfigField("String", "LICENSE_API_BASE_URL", "\"https://api.yourbrand.com/\"")
buildConfigField("String", "SYNC_API_KEY", "\"YOUR_API_KEY_FROM_ENV\"")
```

Then rebuild/install the APK.

## 5. License codes for merchants

When a device shows **Device ID** on the activation screen:

```bash
docker compose exec api npm run generate-code -- --deviceId=PASTE-UUID --days=365 --label="Shop Name"
```

Send the printed code to the merchant.

## 6. Menu on server (for sync & online shop)

For now, demo menu is seeded automatically. Later you can:

- Edit menu in **Admin** (web panel — coming next), or
- Edit in POS and push to server (coming next)

POS will **pull menu in the background** when online (does not block selling).

## 7. Online shop (next phase)

Not required on day one. When ready:

- Deploy a simple shop page on `order.yourbrand.com`
- It uses `GET /v1/orders/menu` and `POST /v1/orders`
- Orders appear in POS **Ongoing Orders**

## 8. Optional later

- [ ] Stripe for online payment
- [ ] Hetzner weekly snapshots + DB backup
- [ ] Waiter app / Kiosk app (same API)

---

## What is already done in code

| Item | Status |
|------|--------|
| Node API on Hetzner (Docker) | ? in `backend/` |
| License activate/validate | ? matches Android app |
| Menu sync API | ? |
| Online orders API | ? |
| POS background sync (menu + online orders) | ? |
| POS stays offline-first | ? sync runs in background only |

---

## If something fails

1. **Activation fails** ? check domain, HTTPS, and `LICENSE_API_BASE_URL`
2. **Sync does nothing** ? set `SYNC_API_KEY` in app + `.env` (must match)
3. **No online orders in POS** ? confirm order created via API and POS has internet

Sleep well — when you're back, send your **domain name** and we can plug it into the app and walk through the first deploy together.
