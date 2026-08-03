# Install WebPOS as a Windows app (PWA)

The merchant dashboard is a Progressive Web App. On Windows this gives you a **Start Menu / desktop shortcut** that opens WebPOS in its own window (`display: standalone`), not a browser tab.

**PWA is the right first step.** Electron/Tauri would ship a full desktop runtime; a Chromium PWA reuses Edge/Chrome and is much lighter for “double-click the POS.”

## Requirements

- **HTTPS** on the deployed panel host (or `localhost` for testing)
- **Microsoft Edge** or **Google Chrome** (Chromium)
- Built dashboard (`npm run build`) so the service worker registers in production

## Install on Windows (Edge or Chrome)

1. Open the panel URL and sign in as a merchant (e.g. `https://your-panel.example/login`).
2. Go to WebPOS: **`/merchant/pos`** (or open the installed app later - `start_url` is already `/merchant/pos`).
3. Install:
   - **Edge**: menu (?) ? **Apps** ? **Install this site as an app**  
     or click the **install** icon in the address bar.
   - **Chrome**: menu (?) ? **Cast, save, and share** ? **Install page as app…**  
     or the install icon in the address bar.
4. Confirm the name (**ChaslayReborn WebPOS** / **WebPOS**).
5. Launch from the **Start Menu**, desktop shortcut, or taskbar pin.
6. Optional: in the app window menu, enable **Open as window** / fullscreen so it does not show browser chrome.

After install, double-clicking the app opens a frameless window at WebPOS. If the session expired, the app still loads and the panel redirects to login.

## What was added

| File | Role |
|------|------|
| `public/manifest.webmanifest` | Name, icons, `display: standalone`, `start_url: /merchant/pos` |
| `public/sw.js` | Thin offline shell (app shell cache; API still needs network) |
| `public/icons/*`, `favicon.png` | Install / Start Menu icons |
| `index.html` | Manifest + theme / apple meta tags |
| `src/main.tsx` | Registers `/sw.js` in production builds |

## Configure start URL

Default start is WebPOS (`/merchant/pos`). To start at login instead, change `start_url` (and optionally `id`) in `public/manifest.webmanifest` to `/login`, then rebuild and reinstall the app.

## Uninstall

Edge/Chrome ? `edge://apps` or `chrome://apps` ? remove **WebPOS**, or Windows **Settings ? Apps**.
