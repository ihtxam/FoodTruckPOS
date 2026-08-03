# Chaslay Print Agent (Windows)

Local HTTP service (`http://127.0.0.1:9101`) used by WebPOS for silent ESC/POS RAW printing.

## Install once (recommended)

1. Download **Chaslay Print Agent** from the merchant dashboard:
   - **Settings ? Receipts & printers ? Download Print Agent**
   - Or open: `https://api.chaslay.com/downloads/chaslay-print-agent-setup.exe`
2. Run the setup EXE once.
3. It installs to `%LOCALAPPDATA%\ChaslayPrintAgent\`, registers **Windows Startup**, and starts the agent.
4. Reboot or log out/in — the agent starts automatically (no `start.bat` each time).

### Manual CLI

```bat
chaslay-print-agent-setup.exe
REM or:
chaslay-print-agent.exe --install
chaslay-print-agent.exe --uninstall
```

## Dev (Node)

```bat
cd print-agent
npm install
npm start
REM or double-click start.bat
```

## Build the installer EXE

Requires Node.js 18+ on Windows.

```powershell
cd print-agent
powershell -ExecutionPolicy Bypass -File .\build-installer.ps1
```

Outputs:

| File | Purpose |
|------|---------|
| `dist/chaslay-print-agent.exe` | Runtime agent |
| `dist/chaslay-print-agent-setup.exe` | Same binary; double-click installs + auto-start |
| `backend/public/downloads/chaslay-print-agent-setup.exe` | Served by API at `/downloads/...` |

### How packaging works

- Uses [`pkg`](https://github.com/vercel/pkg) to bundle Node + `server.js` into a single Windows x64 EXE.
- `win-raw-print.ps1` is embedded and extracted next to the installed EXE.
- `--install` copies files to `%LOCALAPPDATA%\ChaslayPrintAgent` and adds a `HKCU\...\Run` startup entry.
- Setup filename containing `setup` triggers install-on-launch automatically.

## Limitations

- **Windows only** (RAW Win32 print API).
- EXE is **unsigned** unless you codesign it (SmartScreen may warn).
- Binds to `127.0.0.1` only — not exposed on the LAN.
- Not a Windows Service by default (per-user Startup is enough for WebPOS on the cashier PC). To run as a service, wrap the installed EXE with NSSM or Task Scheduler (SYSTEM).

## API

- `GET /health`
- `GET /printers`
- `POST /print` `{ printerName?, dataBase64 }`
- `POST /drawer` `{ printerName? }`
