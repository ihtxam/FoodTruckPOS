# Public downloads

Place built installers here. They are served by the API at:

`GET /downloads/<filename>`

## Print agent

Build from the repo:

```powershell
cd print-agent
powershell -ExecutionPolicy Bypass -File .\build-installer.ps1
```

That copies:

- `chaslay-print-agent-setup.exe` ? download from dashboard / WebPOS PCs
- `chaslay-print-agent.exe`
- `chaslay-print-agent.json` (version metadata)

Public URL (production): `https://api.chaslay.com/downloads/chaslay-print-agent-setup.exe`
