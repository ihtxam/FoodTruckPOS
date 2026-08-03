/**
 * Minimal helpers for receipt QR codes (browser + ESC/POS).
 */

/** Build a public digital-receipt URL for a sale id */
export function buildReceiptUrl(saleId: string, origin?: string): string {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/$/,
    ''
  );
  return `${base}/receipt/${encodeURIComponent(saleId)}`;
}

/** External PNG QR (works in browser print without npm dep) */
export function qrImageUrl(data: string, size = 180): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    data
  )}`;
}

/**
 * ESC/POS QR code (Function 165/167/169/180 - common on Epson-compatible thermals).
 * Returns raw bytes: store QR data + print.
 */
export function escposQrCode(data: string, moduleSize = 4): Uint8Array {
  const encoder = new TextEncoder();
  const payload = encoder.encode(data);
  const storeLen = payload.length + 3;
  const pL = storeLen & 0xff;
  const pH = (storeLen >> 8) & 0xff;
  const cn = 0x31; // QR
  const model = [0x1d, 0x28, 0x6b, 0x04, 0x00, cn, 0x41, 0x32, 0x00]; // model 2
  const sizeCmd = [0x1d, 0x28, 0x6b, 0x03, 0x00, cn, 0x43, Math.max(1, Math.min(16, moduleSize))];
  const errorLevel = [0x1d, 0x28, 0x6b, 0x03, 0x00, cn, 0x45, 0x31]; // M
  const storeHeader = [0x1d, 0x28, 0x6b, pL, pH, cn, 0x50, 0x30];
  const print = [0x1d, 0x28, 0x6b, 0x03, 0x00, cn, 0x51, 0x30];

  const out = new Uint8Array(
    model.length +
      sizeCmd.length +
      errorLevel.length +
      storeHeader.length +
      payload.length +
      print.length
  );
  let o = 0;
  out.set(model, o);
  o += model.length;
  out.set(sizeCmd, o);
  o += sizeCmd.length;
  out.set(errorLevel, o);
  o += errorLevel.length;
  out.set(storeHeader, o);
  o += storeHeader.length;
  out.set(payload, o);
  o += payload.length;
  out.set(print, o);
  return out;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
