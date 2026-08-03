# Public downloads

Served by the API at `GET /downloads/<filename>` and proxied on `app.chaslay.com` / `api.chaslay.com` (Caddy → API, **not** the SPA).

## Print agent (Windows EXE)

`*.exe` files are **gitignored** (~40MB). They must be built and present on the server at:

`backend/public/downloads/chaslay-print-agent-setup.exe`

### Build on Windows (local)

```powershell
cd print-agent
powershell -ExecutionPolicy Bypass -File .\build-installer.ps1
```

That writes a real PE (`MZ` header) into this folder.

### Build on Hetzner (deploy)

`scripts/deploy-hetzner.sh` cross-compiles with `pkg` in a `node:20-bookworm` container and copies into this directory (bind-mounted into the API container).

Skip with `SKIP_PRINT_AGENT_BUILD=1` if you already uploaded a binary.

### Manual upload

```bash
# After local build:
scp backend/public/downloads/chaslay-print-agent-setup.exe \
  root@YOUR_HOST:/root/FoodTruckPOS/backend/public/downloads/
# Restart or recreate API so the mount is fresh (usually not required for bind mounts):
docker compose --env-file .env.production up -d api caddy
```

### Verify

```bash
curl -sI https://app.chaslay.com/downloads/chaslay-print-agent-setup.exe
# Expect: 200, Content-Type: application/octet-stream, Content-Length ~40MB
# First bytes must be MZ (4D 5A), not <!doctype or {"error"

curl -sL https://app.chaslay.com/downloads/chaslay-print-agent-setup.exe | head -c 2 | xxd
# 00000000: 4d5a  MZ
```

Public URLs:

- `https://app.chaslay.com/downloads/chaslay-print-agent-setup.exe`
- `https://api.chaslay.com/downloads/chaslay-print-agent-setup.exe`
