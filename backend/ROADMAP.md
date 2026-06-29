# Chaslay platform roadmap

Inspired by [OrderPin](https://www.orderpin.co/) — B2B2B: **platform ? agencies ? merchants**.

## Roles (target architecture)

| Role | Who | Can do |
|------|-----|--------|
| **Superadmin** (Chaslay) | You | Create agencies, global settings, all tenants |
| **Agency** | Reseller / integrator | Create merchants, billing, white-label (future) |
| **Merchant** | Local shop owner | Menu, orders, hours, delivery zones, staff |
| **POS / KDS / Kiosk** | Devices | Sell, kitchen display, self-order (future modules) |

## What exists today

- **Superadmin** at https://admin.chaslay.com (platform password)
- **Merchant portal** at same URL (email + password)
- Merchant: menu CRUD, online orders, opening hours, delivery zones (JSON)
- POS: basic selling offline-first; pulls menu from server when online
- Online shop: `shop.chaslay.com/{slug}`

## Next phases

1. **Agency accounts** — superadmin creates agencies; agencies create merchants
2. **Menu sync POS ? cloud** — edits in web panel push to tablets
3. **Table plan & floor layout** — web only, POS reads layout
4. **KDS / CDS / Kiosk** — separate device apps on same API
5. **Payments** — Stripe for online; agency billing

## Create merchant login

```bash
docker compose exec api npm run create-merchant-user -- \
  --tenantSlug=demo \
  --email=owner@shop.com \
  --password=ChangeMe123 \
  --name="Shop Owner"
```

Or in superadmin ? Manage tenant ? **Merchant logins**.
