import { roundMoney2 } from '@/lib/money';
import { APP_NAME } from '@/lib/brand';
import { buildReceiptUrl, concatBytes, escposQrCode } from '@/lib/qr';
import { escposCp850Encode, ESC_CODEPAGE_CP850 } from '@/lib/escpos-encode';
import { localDateTimeToIso } from '@/lib/shop-hours';
import {
  channelLabel,
  lineWidthForPaper,
  paymentLabel,
  receiptLabels,
  type ReceiptLang,
} from '@/lib/receipt-labels';

/** Where the kitchen ticket was printed from */
export type KitchenOrderSource = 'WEBPOS' | 'ONLINE' | 'POSAPP' | 'WAITERAPP';

/**
 * Short daily kitchen / shout number, e.g. display `#47`, unique orderNumber `WP-250731-047`.
 */
export function nextWebPosTicketNumber(merchantId?: string | null): {
  display: string;
  orderNumber: string;
} {
  const now = new Date();
  const dayKey = now
    .toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' })
    .replace(/-/g, '');
  const storageKey = `webpos_ticket_seq_${merchantId || 'local'}_${dayKey}`;
  let n = 0;
  try {
    n = Number(localStorage.getItem(storageKey) || '0') || 0;
  } catch {
    n = 0;
  }
  n += 1;
  try {
    localStorage.setItem(storageKey, String(n));
  } catch {
    /* ignore quota */
  }
  const padded = String(n).padStart(3, '0');
  // Suffix avoids unique collisions when two tabs race the same counter.
  const suffix = Math.random().toString(36).slice(2, 5);
  return {
    display: `#${n}`,
    orderNumber: `WP-${dayKey.slice(2)}-${padded}-${suffix}`,
  };
}

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
  /** Short ticket number shown on kitchen/receipt, e.g. #47 */
  orderDisplay?: string | null;
  /** Full order number stored in backend */
  orderNumber?: string | null;
  completedAt: number;
  channel?: string;
  paymentMethod: string;
  /** Delivery customer (printed on delivery receipts) */
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  items: WebPosReceiptItem[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  taxRate: number;
  rounding: number;
  tipAmount?: number;
  total: number;
  tableLabel?: string | null;
  guestCount?: number | null;
  vatIncludedInPrice?: boolean;
  splitLabel?: string | null;
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

function centerLine(text: string, width: number): string {
  const t = text.slice(0, width);
  const pad = Math.max(0, Math.floor((width - t.length) / 2));
  return ' '.repeat(pad) + t;
}

function resolveScheduledDate(scheduledFor?: string | number | null): Date | null {
  if (scheduledFor == null || scheduledFor === '') return null;
  if (typeof scheduledFor === 'number') {
    const d = new Date(scheduledFor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const raw = String(scheduledFor).trim();
  const iso = localDateTimeToIso(raw);
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatKitchenWhen(scheduledFor?: string | number | null): string | null {
  const d = resolveScheduledDate(scheduledFor);
  if (!d) return null;
  const time = d.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  });
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
  const dayKey = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
  if (dayKey === todayKey) return time;
  const dayLabel = d.toLocaleDateString('de-CH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Zurich',
  });
  return `${dayLabel} ${time}`;
}

function resolveLang(tx: WebPosReceipt, panelLang?: string): ReceiptLang {
  const code = String(tx.language || panelLang || 'en').toLowerCase().slice(0, 2);
  if (code === 'fr' || code === 'de') return code;
  return 'en';
}

function vatTableRow(type: string, net: string, tva: string, brut: string, width: number): string {
  const typeWidth = width <= 32 ? 10 : 14;
  const numWidth = width <= 32 ? 5 : 6;
  return (
    type.slice(0, typeWidth).padEnd(typeWidth) +
    net.padStart(numWidth) +
    tva.padStart(numWidth) +
    brut.padStart(numWidth)
  );
}

function formatVatSection(
  tx: WebPosReceipt,
  L: ReturnType<typeof receiptLabels>,
  width: number
): string | null {
  if (tx.showVat === false || tx.taxAmount <= 0 || tx.taxRate <= 0) return null;
  const net = roundMoney2(tx.subtotal);
  const tva = roundMoney2(tx.taxAmount);
  const brut = roundMoney2(net + tva);
  const rateLabel = `${L.tva}: ${tx.taxRate}%`;

  if (tx.vatIncludedInPrice !== false) {
    let r = L.vatIncludedNote.slice(0, width) + '\n';
    r += vatTableRow(L.type, L.net, L.tva, L.brut, width) + '\n';
    r += vatTableRow(rateLabel, net.toFixed(2), tva.toFixed(2), brut.toFixed(2), width);
    return r;
  }

  const text = `${L.tva} ${tx.taxRate}% ${L.net} ${net.toFixed(2)} ${L.tva} ${tva.toFixed(2)} ${L.total} ${brut.toFixed(2)}`;
  return text.slice(0, width);
}

function formatReceiptMetaFooter(
  tx: WebPosReceipt,
  L: ReturnType<typeof receiptLabels>,
  locale: string,
  width: number
): string {
  const date = new Date(tx.completedAt);
  const dateStr = `${date.toLocaleDateString(locale, { timeZone: 'Europe/Zurich' })} ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })}`;
  const orderRef = (tx.orderDisplay || tx.orderNumber || tx.id.slice(-8)).trim();
  const channel = tx.channel ? channelLabel(L, tx.channel) : '';
  const user = tx.showStaff !== false && tx.staffName?.trim() ? tx.staffName.trim() : '';
  const parts = [dateStr, orderRef, channel, user].filter(Boolean);
  return centerLine(parts.join(' | '), width);
}

export function generateWebPosReceiptText(tx: WebPosReceipt, panelLang?: string): string {
  const width = lineWidthForPaper(tx.paperWidthMm);
  const lang = resolveLang(tx, panelLang);
  const L = receiptLabels(lang);
  const locale = lang === 'fr' ? 'fr-CH' : lang === 'de' ? 'de-CH' : 'en-CH';
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
  if (tx.tableLabel) {
    r += `${L.table} ${tx.tableLabel}`;
    if (tx.guestCount) r += ` · ${tx.guestCount} ${L.pax}`;
    r += '\n';
  }
  if (tx.channel === 'delivery') {
    if (tx.customerName?.trim()) r += `${L.customer}: ${tx.customerName.trim()}\n`;
    if (tx.customerPhone?.trim()) r += `Tel: ${tx.customerPhone.trim()}\n`;
    if (tx.shippingAddress?.trim()) {
      r += `${L.deliveryAddress}:\n`;
      for (const line of tx.shippingAddress.trim().split(/\r?\n/)) {
        const chunk = line.trim();
        if (!chunk) continue;
        for (let i = 0; i < chunk.length; i += width) {
          r += chunk.slice(i, i + width) + '\n';
        }
      }
    }
  }
  if (tx.splitLabel) r += `${tx.splitLabel}\n`;
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
  if (tx.discount > 0) {
    r += padLine(`${L.discount}:`, `-CHF ${tx.discount.toFixed(2)}`, width) + '\n';
  }
  const vatSection = formatVatSection(tx, L, width);
  if (vatSection) {
    r += vatSection + '\n';
  }
  const tip = roundMoney2(tx.tipAmount || 0);
  if (tip > 0) {
    r += padLine(`${L.tip}:`, `CHF ${tip.toFixed(2)}`, width) + '\n';
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

  r += formatReceiptMetaFooter(tx, L, locale, width) + '\n';
  const footer = (tx.footer || L.thankYou).trim();
  r += footer + '\n\n\n';
  return r;
}

export type KitchenTicketOpts = {
  channel?: string;
  items: WebPosReceiptItem[];
  language?: string;
  paperWidthMm?: 58 | 80;
  /** Short shout number printed under KITCHEN, e.g. #47 */
  orderNumber?: string | null;
  /** When the order was placed */
  orderedAt?: number;
  /** Pickup / delivery scheduled time (ISO, datetime-local, or epoch). Null/omit = ASAP */
  scheduledFor?: string | number | null;
  /** Staff or customer name at footer */
  userName?: string | null;
  /** Origin of the order / print */
  orderSource?: KitchenOrderSource | string | null;
  itemTextScale?: 1 | 2 | 3;
  headerTextScale?: 1 | 2 | 3;
  boldText?: boolean;
};

/** e.g. "TAKEAWAY : ASAP" or "TAKEAWAY : 17:00" */
function formatChannelWhen(
  L: ReturnType<typeof receiptLabels>,
  channel: string | undefined,
  scheduledFor?: string | number | null
): string {
  const ch = channelLabel(L, channel);
  const when = formatKitchenWhen(scheduledFor);
  return `${ch} : ${when || L.asap}`;
}

function kitchenItemCount(items: WebPosReceiptItem[]): number {
  return items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
}

type KitchenLine = {
  kind: 'center' | 'header' | 'item' | 'normal';
  text: string;
};

function buildKitchenTicketLines(opts: KitchenTicketOpts): {
  width: number;
  L: ReturnType<typeof receiptLabels>;
  lines: KitchenLine[];
} {
  const width = lineWidthForPaper(opts.paperWidthMm);
  const L = receiptLabels(opts.language);
  const thin = '-'.repeat(width);
  const orderedAt = new Date(opts.orderedAt || Date.now());
  const timeStr = orderedAt.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  });
  const totalQty = kitchenItemCount(opts.items);
  const user = (opts.userName || '').trim() || '—';
  const source = String(opts.orderSource || 'WEBPOS').trim().toUpperCase() || 'WEBPOS';
  const ticketNo = (opts.orderNumber || '—').trim();

  const lines: KitchenLine[] = [
    { kind: 'center', text: `${centerLine(L.kitchen, width)}\n` },
    { kind: 'center', text: `${centerLine(ticketNo, width)}\n` },
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
  lines.push({ kind: 'normal', text: `${user}, ${timeStr} · ${source}\n` });
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

function escAlign(mode: 0 | 1 | 2): Uint8Array {
  return new Uint8Array([0x1b, 0x61, mode]);
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
  const parts: Uint8Array[] = [new Uint8Array([0x1b, 0x40]), ESC_CODEPAGE_CP850];

  for (const line of lines) {
    if (line.kind === 'center') {
      parts.push(
        escAlign(1),
        escKitchenSize(headerScale),
        escBold(bold || headerScale > 1),
        escposCp850Encode(line.text.trimStart())
      );
    } else if (line.kind === 'header') {
      parts.push(
        escAlign(0),
        escKitchenSize(headerScale),
        escBold(bold || headerScale > 1),
        escposCp850Encode(line.text)
      );
    } else if (line.kind === 'item') {
      parts.push(
        escAlign(0),
        escKitchenSize(itemScale),
        escBold(bold || itemScale > 1),
        escposCp850Encode(line.text)
      );
    } else {
      parts.push(escAlign(0), escKitchenSize(1), escBold(false), escposCp850Encode(line.text));
    }
  }

  parts.push(
    escAlign(0),
    escKitchenSize(1),
    escBold(false),
    new Uint8Array([0x1b, 0x64, 0x04]),
    new Uint8Array([0x1d, 0x56, 0x41, 0x10])
  );
  return concatBytes(...parts);
}

export type EodVatRow = {
  label: string;
  net: number;
  tva: number;
  brut: number;
};

export type EodReportPrint = {
  label: string;
  periodFrom?: string;
  periodTo?: string;
  salesCount: number;
  revenue: number;
  subtotal?: number;
  taxTotal: number;
  netTotal?: number;
  tipsTotal?: number;
  grandTotal?: number;
  refundTotal: number;
  cancelledCount: number;
  cancelledTotal: number;
  cashTotal: number;
  cardTotal: number;
  terminalTotal: number;
  coversServed?: number | null;
  vatRows?: EodVatRow[];
  productsSold: Array<{ name: string; quantity: number; total: number }>;
  paymentRows: Array<{ method: string; count: number; total: number; percent?: number }>;
  orderTypeRows?: Array<{ label: string; count: number; total: number; percent?: number }>;
  channelRows?: Array<{ channel: string; count: number; total: number }>;
  businessName?: string;
  language?: string;
  /** Default 80mm to match Android LINE_WIDTH_80 */
  paperWidthMm?: 58 | 80;
  header?: string;
  footer?: string;
};

function vatCols(
  type: string,
  net: string,
  tva: string,
  brut: string,
  width: number
): string {
  const compact = width <= 32;
  if (compact) {
    const t = type.slice(0, 8).padEnd(8);
    return `${t}${net.padStart(7)}${tva.padStart(7)}${brut.padStart(7)}`.slice(0, width);
  }
  const t = type.slice(0, 14).padEnd(14);
  const n = net.padStart(10);
  const v = tva.padStart(10);
  const b = brut.padStart(10);
  return `${t}${n}${v}${b}`.slice(0, width);
}

/** Android-parity 80mm EOD layout. Plain text only (no ESC/POS bold). */
export function generateEodReportText(report: EodReportPrint): string {
  const width = lineWidthForPaper(report.paperWidthMm ?? 80);
  const L = receiptLabels(report.language);
  const sep = '='.repeat(Math.min(width, 32));
  const thin = '-'.repeat(Math.min(width, 32));
  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;
  const two = (n: number) => Number(n || 0).toFixed(2);
  const tips = Number(report.tipsTotal || 0);
  const brut = Number(report.revenue || 0);
  const grand = Number(report.grandTotal != null ? report.grandTotal : brut + tips);
  const period =
    report.periodFrom && report.periodTo
      ? `${report.periodFrom} to ${report.periodTo}`
      : report.label;

  let r = '';
  r += sep + '\n';
  if (report.businessName) {
    r += centerLine(report.businessName.toUpperCase().slice(0, width), width) + '\n';
  }
  r += sep + '\n';
  r += '\n';
  r += centerLine(L.endOfDay, width) + '\n';
  r += '\n';
  r += centerLine(L.reportPeriod, width) + '\n';
  r += centerLine(period.slice(0, width), width) + '\n';
  r += '\n';
  r += thin + '\n';
  r += centerLine(L.salesSummary, width) + '\n';
  r += thin + '\n';
  r += padLine(L.subtotal, money(report.subtotal ?? brut), width) + '\n';
  r += '\n';
  r += centerLine(L.tva, width) + '\n';
  r += vatCols(L.type, L.net, L.tva, L.brut, width) + '\n';
  const vatRows = report.vatRows?.length
    ? report.vatRows
    : [
        {
          label: 'Total',
          net: Number(report.netTotal ?? brut - report.taxTotal),
          tva: report.taxTotal,
          brut,
        },
      ];
  for (const row of vatRows) {
    r += vatCols(row.label, two(row.net), two(row.tva), two(row.brut), width) + '\n';
  }
  if (report.vatRows?.length) {
    r +=
      vatCols(
        'Total',
        two(report.netTotal ?? brut - report.taxTotal),
        two(report.taxTotal),
        two(brut),
        width
      ) + '\n';
  }
  r += thin + '\n';
  r += padLine(L.total, money(brut), width) + '\n';
  if (tips > 0) {
    r += padLine(L.tipsNotTaxable, money(tips), width) + '\n';
    r += padLine(L.grandTotal, money(grand), width) + '\n';
  }
  r += padLine(L.orders, String(report.salesCount), width) + '\n';
  if (report.coversServed) {
    r += padLine(L.guestsServed, String(report.coversServed), width) + '\n';
  }
  r += '\n';
  r += thin + '\n';
  r += centerLine(L.paymentMethods, width) + '\n';
  r += thin + '\n';
  for (const p of report.paymentRows) {
    const pct =
      p.percent != null ? `${p.percent.toFixed(1)}%` : `${p.count}`;
    r +=
      padLine(
        `${paymentLabel(L, p.method)} ${pct}`,
        money(p.total),
        width
      ) + '\n';
  }
  r += thin + '\n';
  r +=
    padLine(
      L.total,
      money(report.paymentRows.reduce((s, p) => s + p.total, 0)),
      width
    ) + '\n';
  r += '\n';

  const orderTypes =
    report.orderTypeRows ||
    (report.channelRows || []).map((c) => ({
      label: channelLabel(L, c.channel),
      count: c.count,
      total: c.total,
      percent: undefined as number | undefined,
    }));
  if (orderTypes.length) {
    r += thin + '\n';
    r += centerLine(L.orderTypes, width) + '\n';
    r += thin + '\n';
    for (const o of orderTypes) {
      const meta = o.percent != null ? `${o.percent.toFixed(1)}%` : String(o.count);
      r += padLine(`${o.label} ${o.count} ${meta}`, money(o.total), width) + '\n';
    }
    r += thin + '\n';
    r +=
      padLine(
        L.total,
        money(orderTypes.reduce((s, o) => s + o.total, 0)),
        width
      ) + '\n';
  }

  if (report.productsSold.length) {
    r += '\n';
    r += thin + '\n';
    r += centerLine(L.productsSold, width) + '\n';
    r += thin + '\n';
    const qtySum = report.productsSold.reduce((s, p) => s + p.quantity, 0);
    r += padLine(L.totalQty, String(Math.round(qtySum * 1000) / 1000), width) + '\n';
    const nameWidth = width <= 32 ? 22 : 30;
    for (const p of report.productsSold.slice(0, 60)) {
      const name = p.name.slice(0, nameWidth).padEnd(Math.min(nameWidth, width - 6));
      r += (name + String(p.quantity).padStart(6)).slice(0, width) + '\n';
    }
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
  const body = escposCp850Encode(text);
  const init = new Uint8Array([0x1b, 0x40]);
  const alignCenter = new Uint8Array([0x1b, 0x61, 0x01]);
  const alignLeft = new Uint8Array([0x1b, 0x61, 0x00]);
  const feed = new Uint8Array([0x1b, 0x64, 0x04]);
  const cut = new Uint8Array([0x1d, 0x56, 0x41, 0x10]);
  const parts: Uint8Array[] = [init, ESC_CODEPAGE_CP850];
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

/** Minimal order shape for reprinting from POS order history */
export type PosOrderForReceipt = {
  id: string;
  orderNumber: string;
  clientId?: string | null;
  channel?: string | null;
  paymentMethod?: string | null;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  tipAmount?: number;
  roundingAmount?: number;
  total: number;
  tableLabel?: string | null;
  guestCount?: number | null;
  staffName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  completedAt?: string | null;
  createdAt: string;
  splitCheckNumber?: number | null;
  items: Array<{ name?: string | null; quantity: number; totalPrice: number; unitPrice?: number }>;
};

export function posOrderToWebPosReceipt(
  order: PosOrderForReceipt,
  ctx: {
    businessName: string;
    address?: string;
    phone?: string;
    vatNumber?: string;
    taxRate?: number;
    vatIncludedInPrice?: boolean;
    printSettings?: PosPrintSettingsClient | null;
    panelLang?: string;
    splitLabel?: string | null;
  }
): WebPosReceipt {
  const subtotal = Number(order.subtotal ?? 0);
  const taxAmount = Number(order.taxAmount ?? 0);
  const inferredRate =
    subtotal > 0 && taxAmount > 0 ? roundMoney2((taxAmount / subtotal) * 100) : 8.1;
  const lang = resolveReceiptLanguage(ctx.printSettings, ctx.panelLang);
  const paperWidthMm = ctx.printSettings?.paperWidthMm || 80;
  const completedAt = order.completedAt
    ? new Date(order.completedAt).getTime()
    : new Date(order.createdAt).getTime();
  const splitLabel =
    ctx.splitLabel ??
    (order.splitCheckNumber != null
      ? `Split ${order.splitCheckNumber}`
      : null);
  return {
    businessName: ctx.businessName,
    address: ctx.address,
    phone: ctx.phone,
    vatNumber: ctx.vatNumber,
    id: order.clientId || order.id,
    orderNumber: order.orderNumber,
    completedAt,
    channel: order.channel || undefined,
    paymentMethod: order.paymentMethod || 'cash',
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    shippingAddress: order.shippingAddress,
    tableLabel: order.tableLabel,
    guestCount: order.guestCount,
    items: order.items.map((i) => ({
      name: i.name || 'Item',
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice ?? (i.quantity ? i.totalPrice / i.quantity : i.totalPrice)),
      lineTotal: Number(i.totalPrice),
    })),
    subtotal,
    discount: Number(order.discountAmount ?? 0),
    taxAmount,
    taxRate: ctx.taxRate ?? inferredRate,
    rounding: Number(order.roundingAmount ?? 0),
    tipAmount: Number(order.tipAmount ?? 0),
    total: Number(order.total),
    vatIncludedInPrice: ctx.vatIncludedInPrice === true,
    splitLabel,
    receiptUrl: order.clientId ? buildReceiptUrl(order.clientId) : undefined,
    includeQr: ctx.printSettings?.receiptShowQrCode !== false,
    staffName: order.staffName,
    language: lang,
    paperWidthMm,
    header: ctx.printSettings?.receiptHeader,
    footer: ctx.printSettings?.receiptFooter,
    showVat: ctx.printSettings?.receiptShowVatTable !== false,
    showStaff: ctx.printSettings?.receiptShowStaffLine !== false,
  };
}
