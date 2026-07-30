/**
 * ChaslayReborn Windows Print Agent
 * Exposes localhost HTTP API for WebPOS silent thermal printing (ESC/POS RAW).
 */
const cors = require("cors");
const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.PRINT_AGENT_PORT || 9101);
const app = express();

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json({ limit: "2mb" }));

function isWindows() {
  return process.platform === "win32";
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
    const scriptPath = path.join(__dirname, "win-raw-print.ps1");
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

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    version: "1.1.0",
    port: PORT,
    platform: process.platform,
    windows: isWindows(),
    features: ["print", "printers", "drawer"],
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
  console.log(`ChaslayReborn Print Agent listening on http://127.0.0.1:${PORT}`);
  if (!isWindows()) {
    console.warn("Warning: RAW thermal printing is only supported on Windows.");
  }
});
