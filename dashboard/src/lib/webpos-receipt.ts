import { roundMoney2 } from '@/lib/money';
import { buildReceiptUrl, concatBytes, escposQrCode } from '@/lib/qr';

export type WebPosReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  seatNumber?: number | null;
};

export type WebPosReceipt = {
  businessName: string;
  address?: string;
  phone?: string;
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
  /** Digital receipt / QR target URL */
  receiptUrl?: string;
  includeQr?: boolean;
};

export function generateWebPosReceiptText(tx: WebPosReceipt): string {
  const date = new Date(tx.completedAt);
  const dateStr = `${date.toLocaleDateString('de-CH')} ${date.toLocaleTimeString('de-CH')}`;
  let r = '';
  r += '='.repeat(32) + '\n';
  r += (tx.businessName || 'ManuPOS').toUpperCase() + '\n';
  if (tx.address) r += tx.address + '\n';
  if (tx.phone) r += `Tel: ${tx.phone}\n`;
  r += '='.repeat(32) + '\n';
  r += `Date: ${dateStr}\n`;
  r += `Sale: ${tx.id}\n`;
  if (tx.channel) r += `Channel: ${tx.channel}\n`;
  if (tx.tableLabel) {
    r += `Table: ${tx.tableLabel}`;
    if (tx.guestCount) r += ` · ${tx.guestCount} PAX`;
    r += '\n';
  }
  r += '-'.repeat(32) + '\n';

  const hasSeats = tx.items.some((i) => i.seatNumber != null);
  if (hasSeats) {
    const bySeat = new Map<number | 'shared', WebPosReceiptItem[]>();
    for (const item of tx.items) {
      const key = item.seatNumber != null ? item.seatNumber : 'shared';
      const list = bySeat.get(key) || [];
      list.push(item);
      bySeat.set(key, list);
    }
    const keys = Array.from(bySeat.keys()).sort((a, b) => {
      if (a === 'shared') return 1;
      if (b === 'shared') return -1;
      return Number(a) - Number(b);
    });
    for (const key of keys) {
      r += `\n${key === 'shared' ? 'SHARED' : `Person-${key}`}\n`;
      for (const item of bySeat.get(key) || []) {
        r += `${item.name}\n`;
        r += `  ${item.quantity} x ${item.unitPrice.toFixed(2)} = ${item.lineTotal.toFixed(2)}\n`;
      }
    }
  } else {
    for (const item of tx.items) {
      r += `${item.name}\n`;
      r += `  ${item.quantity} x ${item.unitPrice.toFixed(2)} = ${item.lineTotal.toFixed(2)}\n`;
    }
  }

  r += '-'.repeat(32) + '\n';
  r += `Subtotal:  CHF ${tx.subtotal.toFixed(2)}\n`;
  if (tx.discount > 0) r += `Discount:  -CHF ${tx.discount.toFixed(2)}\n`;
  r += `Tax (${tx.taxRate}%): CHF ${tx.taxAmount.toFixed(2)}\n`;
  if (tx.rounding) {
    r += `Rounding:  ${tx.rounding > 0 ? '+' : ''}CHF ${roundMoney2(tx.rounding).toFixed(2)}\n`;
  }
  r += '='.repeat(32) + '\n';
  r += `TOTAL:     CHF ${tx.total.toFixed(2)}\n`;
  r += '='.repeat(32) + '\n';
  r += `Payment: ${tx.paymentMethod.toUpperCase()}\n`;
  if (tx.notes) r += `Notes: ${tx.notes}\n`;
  const qrUrl = tx.receiptUrl || (tx.includeQr !== false ? buildReceiptUrl(tx.id) : undefined);
  if (qrUrl) {
    r += '-'.repeat(32) + '\n';
    r += 'Scan for digital receipt:\n';
    r += qrUrl + '\n';
  }
  r += '\nMerci / Danke / Thank you\n\n\n';
  return r;
}

/** Minimal ESC/POS: init + text + optional QR + feed + partial cut */
export function textToEscPos(text: string, qrData?: string): Uint8Array {
  const encoder = new TextEncoder();
  const body = encoder.encode(text);
  const init = new Uint8Array([0x1b, 0x40]); // ESC @
  const alignCenter = new Uint8Array([0x1b, 0x61, 0x01]);
  const alignLeft = new Uint8Array([0x1b, 0x61, 0x00]);
  const feed = new Uint8Array([0x1b, 0x64, 0x04]); // feed 4 lines
  const cut = new Uint8Array([0x1d, 0x56, 0x41, 0x10]); // GS V A n — partial cut
  const parts: Uint8Array[] = [init, alignLeft, body];
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
