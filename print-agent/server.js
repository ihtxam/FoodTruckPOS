/**
 * ChaslayReborn Windows Print Agent
 * Exposes localhost HTTP API for WebPOS silent thermal printing (ESC/POS RAW).
 *
 * CLI:
 *   chaslay-print-agent.exe              Run the agent (foreground)
 *   chaslay-print-agent.exe --install    Install to LocalAppData + Windows Startup
 *   chaslay-print-agent.exe --uninstall  Remove Startup entry (keeps files)
 *   chaslay-print-agent.exe --help
 */
const cors = require("cors");
const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execFile, spawn } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(null);
    });
  });
}
const PORT = Number(process.env.PRINT_AGENT_PORT || 9101);
const VERSION = "1.2.0";
const APP_NAME = "ChaslayPrintAgent";
const EXE_NAME = "chaslay-print-agent.exe";
const RUN_VALUE_NAME = "ChaslayPrintAgent";

const isPkg = typeof process.pkg !== "undefined";

function runtimeDir() {
  if (isPkg) return path.dirname(process.execPath);
  return __dirname;
}

function installDir() {
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(base, APP_NAME);
}

function assetPath(filename) {
  // Prefer files next to the installed EXE (extracted at --install).
  const besideExe = path.join(runtimeDir(), filename);
  if (fs.existsSync(besideExe)) return besideExe;
  const besideSource = path.join(__dirname, filename);
  if (fs.existsSync(besideSource)) return besideSource;
  return besideExe;
}

function ensurePs1OnDisk() {
  const dest = path.join(runtimeDir(), "win-raw-print.ps1");
  if (fs.existsSync(dest)) return dest;
  try {
    const bundled = path.join(__dirname, "win-raw-print.ps1");
    if (fs.existsSync(bundled)) {
      fs.copyFileSync(bundled, dest);
      return dest;
    }
  } catch {
    /* ignore */
  }
  return dest;
}

function showMessage(title, body) {
  if (!isWindows()) {
    console.log(`${title}: ${body}`);
    return;
  }
  const safeTitle = String(title).replace(/'/g, "''");
  const safeBody = String(body).replace(/'/g, "''");
  const ps = `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${safeBody}','${safeTitle}')`;
  try {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
      { windowsHide: true }
    );
  } catch {
    console.log(`${title}: ${body}`);
  }
}

function isWindows() {
  return process.platform === "win32";
}

async function setStartup(enabled, exePath) {
  if (!isWindows()) return;
  const runKey = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
  if (enabled) {
    const quoted = `"${exePath}"`;
    await execFileAsync("reg", ["add", runKey, "/v", RUN_VALUE_NAME, "/t", "REG_SZ", "/d", quoted, "/f"], {
      windowsHide: true,
    });
  } else {
    await execFileAsync("reg", ["delete", runKey, "/v", RUN_VALUE_NAME, "/f"], {
      windowsHide: true,
    }).catch(() => {});
  }
}

async function doInstall() {
  if (!isWindows()) {
    throw new Error("Install is only supported on Windows.");
  }
  const dir = installDir();
  fs.mkdirSync(dir, { recursive: true });

  const targetExe = path.join(dir, EXE_NAME);
  const sourceExe = isPkg ? process.execPath : path.join(__dirname, "dist", EXE_NAME);
  if (isPkg) {
    if (path.resolve(process.execPath) !== path.resolve(targetExe)) {
      fs.copyFileSync(process.execPath, targetExe);
    }
  } else if (fs.existsSync(sourceExe)) {
    fs.copyFileSync(sourceExe, targetExe);
  } else {
    // Dev fallback: write a start.cmd that launches node server.js
    const cmd = `@echo off\r\ncd /d "${__dirname}"\r\nnode server.js\r\n`;
    fs.writeFileSync(path.join(dir, "start-agent.cmd"), cmd);
  }

  const ps1Src = path.join(__dirname, "win-raw-print.ps1");
  const ps1Dest = path.join(dir, "win-raw-print.ps1");
  if (fs.existsSync(ps1Src)) {
    fs.copyFileSync(ps1Src, ps1Dest);
  }

  const launchPath = fs.existsSync(targetExe) ? targetExe : path.join(dir, "start-agent.cmd");
  await setStartup(true, launchPath);

  // Start agent in background if not already listening
  const health = await checkHealth();
  if (!health?.ok) {
    const spawnArgs = launchPath.toLowerCase().endsWith(".exe") ? ["--run"] : [];
    const child = spawn(launchPath, spawnArgs, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      cwd: dir,
    });
    child.unref();
  }

  const msg =
    `Installed to:\n${dir}\n\n` +
    `The print agent will start automatically when you log in to Windows.\n` +
    `Listening on http://127.0.0.1:${PORT}`;
  console.log(msg);
  showMessage("Chaslay Print Agent", msg);
}

async function doUninstall() {
  await setStartup(false);
  const msg =
    "Removed Windows Startup entry.\n" +
    `Files remain in ${installDir()} — delete that folder manually if desired.`;
  console.log(msg);
  showMessage("Chaslay Print Agent", msg);
}

function printHelp() {
  console.log(`ChaslayReborn Print Agent v${VERSION}
Usage:
  --install      Install permanently and register Windows Startup
  --uninstall    Remove Startup registration
  --help         Show this help
  (no flags)     Run the local print HTTP server on port ${PORT}
`);
}

async function runCli() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  if (args.includes("--install")) {
    try {
      await doInstall();
      process.exit(0);
    } catch (e) {
      console.error(e);
      showMessage("Chaslay Print Agent", e.message || String(e));
      process.exit(1);
    }
  }
  if (args.includes("--uninstall")) {
    try {
      await doUninstall();
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  }

  // When the downloaded setup EXE is double-clicked (pkg build named *-setup*), install then exit.
  const base = path.basename(isPkg ? process.execPath : process.argv[1] || "", ".exe").toLowerCase();
  if (isPkg && base.includes("setup") && !args.includes("--run")) {
    try {
      await doInstall();
      process.exit(0);
    } catch (e) {
      console.error(e);
      showMessage("Chaslay Print Agent", e.message || String(e));
      process.exit(1);
    }
  }
}

async function runPowerShell(scriptPath, args) {
  const psArgs = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    ...args,
  ];
  const { stdout, stderr } = await execFileAsync("powershell.exe", psArgs, {
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (stderr && stderr.trim()) {
    console.warn("[print-agent]", stderr.trim());
  }
  return stdout.trim();
}

async function listPrinters() {
  if (!isWindows()) {
    return [];
  }
  const ps = `
$items = Get-CimInstance -ClassName Win32_Printer | ForEach-Object {
  [PSCustomObject]@{
    name = $_.Name
    isDefault = [bool]$_.Default
    status = [string]$_.PrinterStatus
  }
}
$items | ConvertTo-Json -Compress
`;
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
    { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }
  );
  const raw = stdout.trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function printRaw({ printerName, dataBase64 }) {
  if (!isWindows()) {
    throw new Error("ChaslayReborn Print Agent supports Windows only.");
  }
  if (!dataBase64) {
    throw new Error("dataBase64 is required.");
  }

  const bytes = Buffer.from(dataBase64, "base64");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manupos-print-"));
  const tmpFile = path.join(tmpDir, "receipt.bin");
  fs.writeFileSync(tmpFile, bytes);

  try {
    const scriptPath = ensurePs1OnDisk();
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`win-raw-print.ps1 not found at ${scriptPath}`);
    }
    const args = ["-FilePath", tmpFile];
    if (printerName && String(printerName).trim()) {
      args.push("-PrinterName", String(printerName).trim());
    }
    const usedPrinter = await runPowerShell(scriptPath, args);
    return usedPrinter || printerName || "default";
  } finally {
    try {
      fs.unlinkSync(tmpFile);
      fs.rmdirSync(tmpDir);
    } catch {
      /* ignore cleanup errors */
    }
  }
}

function startServer() {
  const app = express();

  app.use(
    cors({
      origin: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      version: VERSION,
      port: PORT,
      platform: process.platform,
      windows: isWindows(),
      installDir: installDir(),
      features: ["print", "printers", "drawer", "install"],
    });
  });

  app.get("/printers", async (_req, res) => {
    try {
      const printers = await listPrinters();
      res.json({ printers });
    } catch (error) {
      console.error("[print-agent] list printers failed:", error);
      res.status(500).json({ error: error.message || "Failed to list printers" });
    }
  });

  app.post("/print", async (req, res) => {
    try {
      const usedPrinter = await printRaw(req.body || {});
      res.json({ ok: true, printer: usedPrinter });
    } catch (error) {
      console.error("[print-agent] print failed:", error);
      res.status(500).json({ error: error.message || "Print failed" });
    }
  });

  /** ESC/POS cash drawer kick (pin 2, on-time 25 × 2ms, off-time 250 × 2ms) */
  app.post("/drawer", async (req, res) => {
    try {
      const drawerBytes = Buffer.from([0x1b, 0x40, 0x1b, 0x70, 0x00, 0x19, 0xfa]);
      const usedPrinter = await printRaw({
        printerName: req.body?.printerName,
        dataBase64: drawerBytes.toString("base64"),
      });
      res.json({ ok: true, printer: usedPrinter });
    } catch (error) {
      console.error("[print-agent] drawer failed:", error);
      res.status(500).json({ error: error.message || "Drawer failed" });
    }
  });

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`ChaslayReborn Print Agent v${VERSION} listening on http://127.0.0.1:${PORT}`);
    if (!isWindows()) {
      console.warn("Warning: RAW thermal printing is only supported on Windows.");
    }
  });
}

(async () => {
  await runCli();
  // If CLI installed/uninstalled it already exited. Otherwise start the server.
  startServer();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
