# Unified settings (WebPOS + Android POS)

OrderPin-style model: **one merchant panel** for products, terminals, and business settings. WebPOS already uses that panel. Android POS opens the **same web Settings** in a WebView when online, and keeps **local Room/SQLite** as the offline source of truth.

## Online vs offline

| Mode | Behavior |
|------|----------|
| **Online** | Settings ? General ? **Open online settings** launches a WebView to `https://app.chaslay.com/pos-embed` ? `/merchant/settings?embed=1` with a dashboard JWT from cloud login. |
| **Offline** | Existing local Settings screens (printers, payments, floor devices, appearance, etc.) stay available. Ordering, payments, and printing are unchanged. |

After the first successful internet login + sync, the device can take orders offline from the cached catalog.

## Auth bridge

1. `POST /v1/auth/login` (POS cloud login) returns:
   - `syncApiKey` — catalog/terminal sync (existing)
   - `dashboardToken` — merchant panel JWT
   - `dashboardUser` — panel user JSON
   - `dashboardUrl` — panel origin (from `MERCHANT_DASHBOARD_URL`)
2. Android stores these in `SyncPreferences`.
3. `OnlineSettingsActivity` loads `/pos-embed#token=…&user=…`.
4. Dashboard `PosEmbedPage` writes `localStorage` and redirects to Settings (embed chrome hidden).

Re-login with panel email refreshes the JWT if it expired.

## Sync (reconnect)

Existing paths (unchanged, still the offline-safe model):

- `MainActivity` ? `SyncService.syncAll()` on launch
- `OrderSyncWorker` every 15 minutes when networked
- Manual menu sync in Menu hub
- Opening online settings forces `syncAll(force = true)` first

Local SQLite/Room remains authoritative while offline. On connect, menu/terminals/staff/orders merge from the backend.

## What is cloud-synced vs local-only

### Cloud-synced (merchant panel ? POS via sync APIs)

- Products, categories, modifiers (menu pull/push)
- Business info (optional toggle: name, phone, VAT, hours)
- Payment config / checkout flags from panel (`posCheckoutSettings`)
- Terminals registry (push/pull)
- Staff accounts (when staff sync enabled)
- Online incoming orders
- Receipt/print layout used by **WebPOS** (`posPrintSettings` on panel)

### Local-only on Android POS (device / lane specific)

- Bluetooth / USB / network printer pairing and `printer_configs`
- Floor LAN role / main POS URL / waiter device mode
- Local PIN users that were never cloud-provisioned
- Appearance / POS theme on device
- Scale USB binding
- License activation state on device
- Crash logs / diagnostics
- Held orders and open tables while offline (until sync)

Changing products or tax rates in the **online** panel updates the cloud; Android picks them up on the next successful sync. Device printer hardware setup stays in local Settings.

## Files

| Area | Path |
|------|------|
| Android WebView | `app/.../ui/settings/OnlineSettingsActivity.kt` |
| Settings entry | `SettingsScreen.kt` / `SettingsViewModel.openOnlineSettings()` |
| SSO page | `dashboard/src/pages/PosEmbedPage.tsx` |
| Login JWT | `backend/.../chaslay-compat.service.ts` ? `posLogin` |

## Test plan

1. Log in on Android with panel email (internet required once).
2. Settings ? General ? Open online settings ? panel Settings loads signed-in.
3. Turn on airplane mode ? button shows offline message; local Settings still work; place a cash order.
4. Go online again ? wait for sync / reopen app ? menu matches panel.
