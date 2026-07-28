# Chaslay POS ? deploy checklist

Server IP: **116.202.26.15**

| Domain | Purpose |
|--------|---------|
| `api.chaslay.com` | POS license, menu sync, order API, `/v1/receipts` |
| `pay.chaslay.com` | Digital receipt pages (`/receipts/{id}`) |
| `shop.chaslay.com/{clientName}` | Customer online shop per merchant |
| `app.chaslay.com` | Merchant back office + superadmin |

---

## 1. DNS (you)

Point these **A records** to `116.202.26.15`:

- `api.chaslay.com`
- `pay.chaslay.com`
- `shop.chaslay.com`
- `app.chaslay.com`

---

## 2. First-time server setup (Hetzner)

```bash
ssh root@116.202.26.15
git clone https://github.com/ihtxam/FoodTruckPOS.git
cd FoodTruckPOS
cp backend/.env.example backend/.env
cp backend/receipts.env.example backend/receipts.env
nano backend/.env
nano backend/receipts.env
bash scripts/deploy-hetzner.sh
```

### WinSCP ? where files live on the server

After `git clone`, everything is under **`/root/FoodTruckPOS/`**:

| What | Path on server |
|------|----------------|
| Main API secrets | `/root/chaslay-secrets/backend.env` (symlinked from `backend/.env`) |
| Receipts + SMTP | `/root/chaslay-secrets/receipts.env` |
| Receipts code | `/root/FoodTruckPOS/backend/receipts/` |
| Docker stack | `/root/FoodTruckPOS/backend/docker-compose.yml` |
| Deploy script | `/root/FoodTruckPOS/scripts/deploy-hetzner.sh` |

There is **no** separate `server/` folder anymore ? receipts live inside `backend/`.

If you only uploaded `backend/` before, run on the server (SSH):

```bash
cd /root/FoodTruckPOS && git pull
```

Or re-clone: `git clone https://github.com/ihtxam/FoodTruckPOS.git`

Then create `backend/receipts.env` from `backend/receipts.env.example` and run:

```bash
bash /root/FoodTruckPOS/scripts/deploy-hetzner.sh
```

**Do not commit `.env` files to GitHub** ? they contain passwords. Keep secrets on the server only, or use [GitHub Actions secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions) for deploy keys (not app config).

---

## 3. Auto-deploy on every push to `main`

A GitHub Actions workflow (`.github/workflows/deploy-hetzner.yml`) SSHs into your VPS and runs `scripts/deploy-hetzner.sh`.

### One-time GitHub setup

Repo ? **Settings ? Secrets and variables ? Actions** ? add:

| Secret | Example |
|--------|---------|
| `HETZNER_HOST` | `116.202.26.15` |
| `HETZNER_USER` | `root` |
| `HETZNER_SSH_KEY` | Private key (PEM) that can SSH to the server |
| `HETZNER_DEPLOY_PATH` | `/root/FoodTruckPOS` (optional) |
| `HETZNER_SSH_PORT` | `22` (optional) |

On the server, add the matching **public key** to `~/.ssh/authorized_keys`.

After that, every `git push` to `main` rebuilds Docker and runs migrations automatically.

Manual deploy anytime:

```bash
ssh root@116.202.26.15 'bash /root/FoodTruckPOS/scripts/deploy-hetzner.sh'
```

---

## 4. Deploy / update backend manually

```bash
ssh root@116.202.26.15
cd ChaslayPOS   # or git clone https://github.com/ihtxam/ChaslayPOS.git
git pull
cd backend
# NEVER run: cp .env.example .env  (that wipes your secrets)
# Secrets live at /root/chaslay-secrets/backend.env ? see scripts/deploy-hetzner.sh
nano /root/chaslay-secrets/backend.env   # only if you need to change secrets
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
| `SUPERADMIN_PASSWORD` | Set once in `/root/chaslay-secrets/backend.env`; stored in Postgres and survives redeploys |

`Caddyfile` is already set for `api.chaslay.com`, `shop.chaslay.com`, `app.chaslay.com`.

**Superadmin panel:** https://app.chaslay.com (password saved in database after first login)

**Reset superadmin password anytime:**

```bash
cd /root/FoodTruckPOS/backend
docker compose exec api npm run set-superadmin-password -- 'YourNewPassword123'
```

After changing `.env`, restart: `docker compose up -d --build`

---

## Merchant portal (shop owners)

Merchants log in at **https://app.chaslay.com** with email + password.

**Create a merchant login** (superadmin ? Manage tenant ? Merchant portal login), or:

```bash
docker compose exec api npm run create-merchant-user -- \
  --tenantSlug=demo \
  --email=owner@shop.com \
  --password=ChangeMe123 \
  --name="Shop Owner"
```

Merchants can manage:
- Menu (categories & products) ? syncs to POS when online
- Online orders & status
- Opening hours, delivery zones, order settings

See `backend/ROADMAP.md` for the OrderPin-style agency roadmap (KDS, kiosk, table plan, etc.).

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
- Full admin UI at `app.chaslay.com`
- POS menu push to server
- Waiter / kiosk apps

## Custom domain (merchant shop)

Shop **slug** is enough: `https://shop.chaslay.com/{slug}` (also `/shop/{slug}` on admin).

Shop **subdomain** (`https://{sub}.chaslay.com`) is optional — it is **not** required for custom domains.

### DNS for a custom domain

Create a **CNAME** at your DNS provider:

| Field | Value |
|-------|--------|
| **Type** | `CNAME` |
| **Host / Name** | `www` (or `order`, `shop`, … — the hostname customers will use) |
| **Target / Value / Points to** | `shop.chaslay.com` |

Then in Merchant → Settings (or Website CMS), enter the full hostname, e.g. `www.mycafe.ch`.

TLS certificates are issued automatically via on-demand TLS once DNS points at the platform and the domain is saved on the merchant.

