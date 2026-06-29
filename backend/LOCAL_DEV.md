# Local development (test before deploying to Hetzner)

Run the API on your PC first. When it works locally, push to GitHub and `git pull` on the server.

## Option A — Docker (easiest, matches production)

From `FoodTruckPOS/backend`:

```powershell
cd C:\Users\Hussain\Downloads\FoodTruckPOS\backend
copy .env.example .env
# Edit .env: set POSTGRES_PASSWORD, API_KEY, LICENSE_SECRET, SUPERADMIN_PASSWORD
```

**If port 3000 is already used** (e.g. another project like Offers), use port **3080**:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
docker compose exec api npm run migrate
docker compose exec api npm run seed
```

Open: **http://localhost:3080/admin/**

If port 3000 is free, you can use the default instead:

```powershell
docker compose up -d --build
```

Open: **http://localhost:3000/admin/**

| URL | What |
|-----|------|
| http://localhost:3080/admin/ | Admin panel (use 3080 if 3000 is busy) |
| http://localhost:3080/health | API health |
| http://localhost:3080/admin/admin.css | Must start with `:root {` — not HTML |

**Platform admin login:** Platform admin tab ? password from `SUPERADMIN_PASSWORD` in `.env`

**Create merchant login:**

```powershell
docker compose exec api npm run create-merchant-user -- --tenantSlug=demo --email=owner@test.com --password=ChangeMe123 --name="Test Owner"
```

Then Merchant login with that email/password.

---

## Option B — Node only (postgres in Docker)

```powershell
cd backend
docker compose up -d postgres
copy .env.example .env
# Set DATABASE_URL to postgres://foodtruck:YOUR_PASSWORD@localhost:5432/foodtruckpos
# Expose postgres in docker-compose ports if needed, or use docker network host
npm install
npm run migrate
npm run seed
npm run dev
```

Open http://localhost:3000/admin/

---

## CSS / JS not loading?

1. Hard refresh: **Ctrl+F5**
2. Check http://localhost:3000/admin/admin.css — first line should be `:root {`
3. If you see HTML instead, restart: `docker compose up -d --build`

---

## Deploy to server after local test

```bash
git add -A && git commit -m "..." && git push
# On VPS:
cd ~/FoodTruckPOS && git pull && cd backend && docker compose up -d --build
docker compose exec api npm run migrate
```

Production URLs:

- https://admin.chaslay.com/ (same panel as local `/admin/`)
- https://shop.chaslay.com/demo
