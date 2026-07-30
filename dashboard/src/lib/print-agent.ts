/**
 * ChaslayReborn Windows Print Agent (localhost).
 * Electron desktop also exposes window.manuposDesktop (legacy API name).
 */

export const PRINT_AGENT_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PRINT_AGENT_URL) ||
  'http://127.0.0.1:9101';

export type AgentPrinter = {
  name: string;
  isDefault?: boolean;
  status?: string;
};

declare global {
  interface Window {
    manuposDesktop?: {
      listPrinters: () => Promise<AgentPrinter[]>;
      printEscPos: (payload: { printerName?: string; dataBase64: string; text?: string }) => Promise<{ ok: boolean; error?: string }>;
      getAgentStatus: () => Promise<{ running: boolean; port: number }>;
    };
  }
}

async function agentFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${PRINT_AGENT_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Print agent HTTP ${res.status}`);
  }
  return res.json();
}

export async function isPrintAgentAvailable(): Promise<boolean> {
  if (window.manuposDesktop) {
    try {
      const s = await window.manuposDesktop.getAgentStatus();
      return !!s.running;
    } catch {
      return true; // desktop bridge present
    }
  }
  try {
    const data = await agentFetch('/health');
    return !!data.ok;
  } catch {
    return false;
  }
}

export async function listAgentPrinters(): Promise<AgentPrinter[]> {
  if (window.manuposDesktop?.listPrinters) {
    return window.manuposDesktop.listPrinters();
  }
  const data = await agentFetch('/printers');
  return data.printers || [];
}

export async function printViaAgent(opts: {
  printerName?: string;
  dataBase64: string;
  text?: string;
}): Promise<void> {
  if (window.manuposDesktop?.printEscPos) {
    const res = await window.manuposDesktop.printEscPos(opts);
    if (!res.ok) throw new Error(res.error || 'Desktop print failed');
    return;
  }
  await agentFetch('/print', {
    method: 'POST',
    body: JSON.stringify({
      printerName: opts.printerName || undefined,
      dataBase64: opts.dataBase64,
      text: opts.text,
    }),
  });
}

/** ESC/POS initialize + cash drawer kick (pin 2): 1B 40 1B 70 00 19 FA */
const DRAWER_KICK_BASE64 = 'G0AbcAAZ+g==';

/**
 * Open cash drawer via print agent.
 * Prefers POST /drawer; falls back to POST /print with kick bytes for older agents.
 */
export async function openCashDrawerViaAgent(opts?: { printerName?: string }): Promise<void> {
  const printerName = opts?.printerName || undefined;
  try {
    await agentFetch('/drawer', {
      method: 'POST',
      body: JSON.stringify({ printerName }),
    });
    return;
  } catch (e: any) {
    const msg = String(e?.message || '');
    // Older print-agent builds have /print but not /drawer.
    if (!/HTTP 404|Cannot POST \/drawer|Not Found/i.test(msg)) {
      throw e;
    }
  }
  await printViaAgent({
    printerName,
    dataBase64: DRAWER_KICK_BASE64,
  });
}

export function browserPrintText(text: string, qrImageSrc?: string) {
  const w = window.open('', '_blank', 'width=400,height=700');
  if (!w) throw new Error('Popup blocked — allow popups to print');
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const qrHtml = qrImageSrc
    ? `<div style="text-align:center;margin-top:8px"><img src="${qrImageSrc}" width="160" height="160" alt="QR receipt"/><div style="font:11px monospace;margin-top:4px">Scan for digital receipt</div></div>`
    : '';
  w.document.write(
    `<pre style="font:12px/1.3 monospace;white-space:pre-wrap;padding:12px;margin:0">${safe}</pre>${qrHtml}`
  );
  w.document.close();
  w.focus();
  // Give QR image a moment to load before print dialog
  setTimeout(() => w.print(), qrImageSrc ? 400 : 50);
}
