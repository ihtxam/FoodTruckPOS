import { roundMoney2 } from '@/lib/money';
import { APP_NAME } from '@/lib/brand';
import { buildReceiptUrl, concatBytes, escposQrCode } from '@/lib/qr';
import {
  channelLabel,
  lineWidthForPaper,
  paymentLabel,
  receiptLabels,
  type ReceiptLang,
} from '@/lib/receipt-labels';

export type WebPosReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  seatNumber?: number | null;
  productId?: string | null;
  categoryId?: string | null;
};

export type PosPrintSettingsClient = {
  receiptHeader?: string;
  receiptFooter?: string;
  kitchenTicketHeader?: string;
  kitchenTicketFooter?: string;
  kitchenItemTextScale?: 1 | 2 | 3;
  kitchenHeaderTextScale?: 1 | 2 | 3;
  kitchenBoldText?: boolean;
  receiptShowVatTable?: boolean;
  receiptShowStaffLine?: boolean;
  receiptShowQrCode?: boolean;
  paperWidthMm?: 58 | 80;
  receiptLanguage?: 'en' | 'fr' | 'de' | 'panel';
  receiptLogoUrl?: string | null;
  autoPrintReceipt?: boolean;
  autoPrintKitchen?: boolean;
  printers?: Array<{
    id: string;
    name: string;
    enabled?: boolean;
    paperWidthMm?: 58 | 80;
    printReceipts?: boolean;
    printKitchenTickets?: boolean;
    printEndOfDayReports?: boolean;
    printAllProducts?: boolean;
    linkedCategoryIds?: string[];
    linkedProductIds?: string[];
  }>;
};

export type WebPosReceipt = {
  businessName: string;
  address?: string;
  phone?: string;
  vatNumber?: string;
  id: string;
  completedAt: number;
  channel?: string;
  paymentMethod: string;
  items: WebPosReceiptItem[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  taxRate: number;
  rounding: number;
  total: number;
  tableLabel?: string | null;
  guestCount?: number | null;
  notes?: string;
  receiptUrl?: string;
  includeQr?: boolean;
  staffName?: string | null;
  language?: ReceiptLang | string;
  paperWidthMm?: 58 | 80;
  header?: string;
  footer?: string;
  showVat?: boolean;
  showStaff?: boolean;
};

function padLine(left: string, right: string, width: number): string {
  const gap = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(gap) + right;
}

function resolveLang(tx: WebPosReceipt, panelLang?: string): ReceiptLang {
  const code = String(tx.language || panelLang || 'en').toLowerCase().slice(0, 2);
  if (code === 'fr' || code === 'de') return code;
  return 'en';
}

export function generateWebPosReceiptText(tx: WebPosReceipt, panelLang?: string): string {
  const width = lineWidthForPaper(tx.paperWidthMm);
  const L = receiptLabels(resolveLang(tx, panelLang));
  const date = new Date(tx.completedAt);
  const locale = resolveLang(tx, panelLang) === 'fr' ? 'fr-CH' : resolveLang(tx, panelLang) === 'de' ? 'de-CH' : 'en-CH';
  const dateStr = `${date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale)}`;
  const sep = '='.repeat(width);
  const thin = '-'.repeat(width);

  let r = '';
  r += sep + '\n';
  if (tx.header?.trim()) {
    for (const line of tx.header.trim().split(/\r?\n/)) r += line.slice(0, width) + '\n';
  } else {
    r += (tx.businessName || APP_NAME).toUpperCase().slice(0, width) + '\n';
    if (tx.address) r += tx.address.slice(0, width) + '\n';
    if (tx.phone) r += `Tel: ${tx.phone}`.slice(0, width) + '\n';
    if (tx.vatNumber) r += `VAT: ${tx.vatNumber}`.slice(0, width) + '\n';
  }
  r += sep + '\n';
  r += `${L.date}: ${dateStr}\n`;
  r += `${L.sale}: ${tx.id}\n`;
  if (tx.channel) r += `${L.channel}: ${channelLabel(L, tx.channel)}\n`;
  if (tx.tableLabel) {
    r += `${L.table} ${tx.tableLabel}`;
    if (tx.guestCount) r += ` · ${tx.guestCount} ${L.pax}`;
    r += '\n';
  }
  if (tx.showStaff !== false && tx.staffName) r += `${L.staff} ${tx.staffName}\n`;
  r += thin + '\n';

  for (const item of tx.items) {
    r += item.name.slice(0, width) + '\n';
    r +=
      padLine(
        `  ${item.quantity} x ${item.unitPrice.toFixed(2)}`,
        item.lineTotal.toFixed(2),
        width
      ) + '\n';
  }

  r += thin + '\n';
  r += padLine(`${L.subtotal}:`, `CHF ${tx.subtotal.toFixed(2)}`, width) + '\n';
  if (tx.discount > 0) {
    r += padLine(`${L.discount}:`, `-CHF ${tx.discount.toFixed(2)}`, width) + '\n';
  }
  if (tx.showVat !== false) {
    r += padLine(`${L.tax} (${tx.taxRate}%):`, `CHF ${tx.taxAmount.toFixed(2)}`, width) + '\n';
  }
  if (tx.rounding) {
    r +=
      padLine(
        `${L.rounding}:`,
        `${tx.rounding > 0 ? '+' : ''}CHF ${roundMoney2(tx.rounding).toFixed(2)}`,
        width
      ) + '\n';
  }
  r += sep + '\n';
  r += padLine(`${L.total}:`, `CHF ${tx.total.toFixed(2)}`, width) + '\n';
  r += sep + '\n';
  r += `${L.payment}: ${paymentLabel(L, tx.paymentMethod)}\n`;
  if (tx.notes) r += `${L.note} ${tx.notes}\n`;

  const qrUrl = tx.receiptUrl || (tx.includeQr !== false ? buildReceiptUrl(tx.id) : undefined);
  if (qrUrl && tx.includeQr !== false) {
    r += thin + '\n';
    r += L.scanDigitalReceipt + '\n';
    r += qrUrl + '\n';
  }

  const footer = (tx.footer || L.thankYou).trim();
  r += '\n' + footer + '\n\n\n';
  return r;
}

export type KitchenTicketOpts = {
  channel?: string;
  items: WebPosReceiptItem[];
  language?: string;
  paperWidthMm?: 58 | 80;
  /** Order / sale reference printed under KITCHEN */
  orderNumber?: string | null;
  /** When the order was placed */
  orderedAt?: number;
  /** Pickup / delivery scheduled time (ISO or epoch). Null/omit = ASAP */
  scheduledFor?: string | number | null;
  /** Staff or customer name at footer */
  userName?: string | null;
  itemTextScale?: 1 | 2 | 3;
  headerTextScale?: 1 | 2 | 3;
  boldText?: boolean;
};

/** e.g. "TAKEAWAY : ASAP" or "TAKEAWAY : Fri 31.07., 14:30" */
function formatChannelWhen(
  L: ReturnType<typeof receiptLabels>,
  channel: string | undefined,
  scheduledFor?: string | number | null
): string {
  const ch = channelLabel(L, channel);
  if (scheduledFor == null || scheduledFor === '') return `${ch} : ${L.asap}`;
  const d = new Date(scheduledFor);
  if (Number.isNaN(d.getTime())) return `${ch} : ${L.asap}`;
  const when = d.toLocaleString('de-CH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${ch} : ${when}`;
}

function kitchenItemCount(items: WebPosReceiptItem[]): number {
  return items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
}

function buildKitchenTicketLines(opts: KitchenTicketOpts): {
  width: number;
  L: ReturnType<typeof receiptLabels>;
  lines: Array<{ kind: 'header' | 'item' | 'normal'; text: string }>;
} {
  const width = lineWidthForPaper(opts.paperWidthMm);
  const L = receiptLabels(opts.language);
  const thin = '-'.repeat(width);
  const orderedAt = new Date(opts.orderedAt || Date.now());
  const timeStr = orderedAt.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const totalQty = kitchenItemCount(opts.items);
  const user = (opts.userName || '').trim() || '—';

  const lines: Array<{ kind: 'header' | 'item' | 'normal'; text: string }> = [
    { kind: 'header', text: 'KITCHEN\n' },
    { kind: 'header', text: `${(opts.orderNumber || '—').slice(0, width)}\n` },
    { kind: 'header', text: `${formatChannelWhen(L, opts.channel, opts.scheduledFor)}\n` },
    { kind: 'normal', text: `${thin}\n` },
  ];

  for (const item of opts.items) {
    lines.push({
      kind: 'item',
      text: `${item.quantity}x ${item.name}`.slice(0, width) + '\n',
    });
  }

  lines.push({ kind: 'normal', text: `${thin}\n` });
  lines.push({
    kind: 'normal',
    text: padLine(L.totalItems, String(totalQty), width) + '\n',
  });
  lines.push({ kind: 'normal', text: `${thin}\n` });
  lines.push({ kind: 'normal', text: `${user}, ${timeStr}\n` });
  lines.push({ kind: 'normal', text: '\n\n\n' });

  return { width, L, lines };
}

/** Plain-text kitchen ticket (fallback / preview). */
export function generateKitchenTicketText(opts: KitchenTicketOpts): string {
  return buildKitchenTicketLines(opts)
    .lines.map((l) => l.text)
    .join('');
}

function escKitchenSize(scale: 1 | 2 | 3): Uint8Array {
  // GS ! n — 0 normal, 0x01 double height, 0x11 double width+height
  const n = scale === 3 ? 0x11 : scale === 2 ? 0x01 : 0x00;
  return new Uint8Array([0x1d, 0x21, n]);
}

function escBold(on: boolean): Uint8Array {
  return new Uint8Array([0x1b, 0x45, on ? 1 : 0]);
}

/** Kitchen ticket as ESC/POS with bold + enlarged text (default scale 2 ≈ 12pt tall). */
export function generateKitchenTicketEscPos(opts: KitchenTicketOpts): Uint8Array {
  const { lines } = buildKitchenTicketLines(opts);
  const headerScale = (opts.headerTextScale === 1 || opts.headerTextScale === 3
    ? opts.headerTextScale
    : 2) as 1 | 2 | 3;
  const itemScale = (opts.itemTextScale === 1 || opts.itemTextScale === 3
    ? opts.itemTextScale
    : 2) as 1 | 2 | 3;
  const bold = opts.boldText !== false;
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [
    new Uint8Array([0x1b, 0x40]),
    new Uint8Array([0x1b, 0x61, 0x00]),
  ];

  for (const line of lines) {
    if (line.kind === 'header') {
      parts.push(escKitchenSize(headerScale), escBold(bold || headerScale > 1), enc.encode(line.text));
    } else if (line.kind === 'item') {
      parts.push(escKitchenSize(itemScale), escBold(bold || itemScale > 1), enc.encode(line.text));
    } else {
      parts.push(escKitchenSize(1), escBold(false), enc.encode(line.text));
    }
  }

  parts.push(
    escKitchenSize(1),
    escBold(false),
    new Uint8Array([0x1b, 0x64, 0x04]),
    new Uint8Array([0x1d, 0x56, 0x41, 0x10])
  );
  return concatBytes(...parts);
}

export type EodReportPrint = {
  label: string;
  salesCount: number;
  revenue: number;
  taxTotal: number;
  refundTotal: number;
  cancelledCount: number;
  cancelledTotal: number;
  cashTotal: number;
  cardTotal: number;
  terminalTotal: number;
  coversServed?: number | null;
  productsSold: Array<{ name: string; quantity: number; total: number }>;
  paymentRows: Array<{ method: string; count: number; total: number }>;
  businessName?: string;
  language?: string;
  paperWidthMm?: 58 | 80;
  header?: string;
  footer?: string;
};

export function generateEodReportText(report: EodReportPrint): string {
  const width = lineWidthForPaper(report.paperWidthMm);
  const L = receiptLabels(report.language);
  const sep = '='.repeat(width);
  const thin = '-'.repeat(width);
  let r = '';
  r += sep + '\n';
  r += L.endOfDay + '\n';
  if (report.businessName) r += report.businessName.toUpperCase().slice(0, width) + '\n';
  if (report.header?.trim()) r += report.header.trim() + '\n';
  r += report.label + '\n';
  r += sep + '\n';
  r += padLine(`${L.salesCount}:`, String(report.salesCount), width) + '\n';
  r += padLine(`${L.revenue}:`, `CHF ${report.revenue.toFixed(2)}`, width) + '\n';
  r += padLine(`${L.tax}:`, `CHF ${report.taxTotal.toFixed(2)}`, width) + '\n';
  r += padLine(`${L.refunds}:`, `CHF ${report.refundTotal.toFixed(2)}`, width) + '\n';
  r += padLine(`${L.cancelled}:`, `${report.cancelledCount} / CHF ${report.cancelledTotal.toFixed(2)}`, width) + '\n';
  if (report.coversServed) r += padLine(`${L.covers}:`, String(report.coversServed), width) + '\n';
  r += thin + '\n';
  r += `${L.payment}\n`;
  for (const p of report.paymentRows) {
    r +=
      padLine(
        `  ${paymentLabel(L, p.method)} (${p.count})`,
        `CHF ${p.total.toFixed(2)}`,
        width
      ) + '\n';
  }
  r += thin + '\n';
  r += `${L.productsSold}\n`;
  for (const p of report.productsSold.slice(0, 40)) {
    r += padLine(`  ${p.quantity}x ${p.name}`.slice(0, width - 10), p.total.toFixed(2), width) + '\n';
  }
  if (report.footer?.trim()) {
    r += thin + '\n';
    r += report.footer.trim() + '\n';
  }
  r += '\n\n\n';
  return r;
}

/** Minimal ESC/POS: init + optional logo + text + optional QR + feed + partial cut */
export function textToEscPos(
  text: string,
  qrData?: string,
  logoBytes?: Uint8Array | null
): Uint8Array {
  const encoder = new TextEncoder();
  const body = encoder.encode(text);
  const init = new Uint8Array([0x1b, 0x40]);
  const alignCenter = new Uint8Array([0x1b, 0x61, 0x01]);
  const alignLeft = new Uint8Array([0x1b, 0x61, 0x00]);
  const feed = new Uint8Array([0x1b, 0x64, 0x04]);
  const cut = new Uint8Array([0x1d, 0x56, 0x41, 0x10]);
  const parts: Uint8Array[] = [init];
  if (logoBytes?.length) {
    parts.push(alignCenter, logoBytes, alignLeft);
  }
  parts.push(alignLeft, body);
  if (qrData) {
    parts.push(alignCenter, escposQrCode(qrData, 5), alignLeft);
  }
  parts.push(feed, cut);
  return concatBytes(...parts);
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/** Load image URL → ESC/POS GS v 0 raster (monochrome). */
export async function logoUrlToEscPos(
  url: string,
  maxWidthDots = 384
): Promise<Uint8Array | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('logo load failed'));
      el.src = url;
    });
    const scale = Math.min(1, maxWidthDots / img.width);
    const w = Math.max(8, Math.floor(img.width * scale));
    const h = Math.max(8, Math.floor(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const bytesPerRow = Math.ceil(w / 8);
    const raster = new Uint8Array(bytesPerRow * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
        if (lum < 160) {
          raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
        }
      }
    }
    const header = new Uint8Array([
      0x1d,
      0x76,
      0x30,
      0x00,
      bytesPerRow & 0xff,
      (bytesPerRow >> 8) & 0xff,
      h & 0xff,
      (h >> 8) & 0xff,
    ]);
    return concatBytes(header, raster);
  } catch {
    return null;
  }
}

export function printersForRole(
  settings: PosPrintSettingsClient | null | undefined,
  role: 'receipt' | 'kitchen' | 'eod'
): Array<{ name: string; paperWidthMm: 58 | 80 }> {
  const list = (settings?.printers || []).filter((p) => p.enabled !== false && p.name);
  const matched = list.filter((p) => {
    if (role === 'receipt') return !!p.printReceipts;
    if (role === 'kitchen') return !!p.printKitchenTickets;
    return !!p.printEndOfDayReports;
  });
  if (matched.length) {
    return matched.map((p) => ({
      name: p.name,
      paperWidthMm: (p.paperWidthMm === 58 ? 58 : 80) as 58 | 80,
    }));
  }
  // Fallback: default paper width, caller supplies Windows printer name from localStorage
  return [];
}

export function filterKitchenItems(
  items: WebPosReceiptItem[],
  printer: NonNullable<PosPrintSettingsClient['printers']>[number]
): WebPosReceiptItem[] {
  if (printer.printAllProducts !== false) return items;
  const cats = new Set(printer.linkedCategoryIds || []);
  const prods = new Set(printer.linkedProductIds || []);
  if (!cats.size && !prods.size) return items;
  return items.filter(
    (i) => (i.productId && prods.has(i.productId)) || (i.categoryId && cats.has(i.categoryId))
  );
}

export function resolveReceiptLanguage(
  settings: PosPrintSettingsClient | null | undefined,
  panelLanguage?: string | null
): ReceiptLang {
  const mode = settings?.receiptLanguage || 'panel';
  if (mode === 'en' || mode === 'fr' || mode === 'de') return mode;
  const p = String(panelLanguage || 'en').toLowerCase().slice(0, 2);
  if (p === 'fr' || p === 'de') return p;
  return 'en';
}
