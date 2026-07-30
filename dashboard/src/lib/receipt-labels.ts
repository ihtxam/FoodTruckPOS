export type ReceiptLang = 'en' | 'fr' | 'de';

export type ReceiptLabels = {
  date: string;
  sale: string;
  channel: string;
  table: string;
  subtotal: string;
  discount: string;
  tax: string;
  rounding: string;
  total: string;
  payment: string;
  note: string;
  staff: string;
  scanDigitalReceipt: string;
  thankYou: string;
  kitchen: string;
  dineIn: string;
  takeaway: string;
  delivery: string;
  cash: string;
  card: string;
  terminal: string;
  express: string;
  pax: string;
  endOfDay: string;
  salesCount: string;
  revenue: string;
  productsSold: string;
  cancelled: string;
  refunds: string;
  covers: string;
  pickupTime: string;
  deliveryTime: string;
  asap: string;
  payLater: string;
};

const EN: ReceiptLabels = {
  date: 'Date',
  sale: 'Sale',
  channel: 'Channel',
  table: 'Table',
  subtotal: 'Subtotal',
  discount: 'Discount',
  tax: 'Tax',
  rounding: 'Rounding',
  total: 'TOTAL',
  payment: 'Payment',
  note: 'Note',
  staff: 'Staff',
  scanDigitalReceipt: 'Scan for digital receipt',
  thankYou: 'Thank you',
  kitchen: 'KITCHEN',
  dineIn: 'DINE-IN',
  takeaway: 'TAKEAWAY',
  delivery: 'DELIVERY',
  cash: 'Cash',
  card: 'Card',
  terminal: 'Terminal',
  express: 'Express',
  pax: 'PAX',
  endOfDay: 'END OF DAY REPORT',
  salesCount: 'Sales',
  revenue: 'Revenue',
  productsSold: 'Products sold',
  cancelled: 'Cancelled',
  refunds: 'Refunds',
  covers: 'Covers',
  pickupTime: 'Pickup:',
  deliveryTime: 'Delivery:',
  asap: 'ASAP',
  payLater: 'Pay later',
};

const FR: ReceiptLabels = {
  date: 'Date',
  sale: 'Vente',
  channel: 'Canal',
  table: 'Table',
  subtotal: 'Sous-total',
  discount: 'Remise',
  tax: 'TVA',
  rounding: 'Arrondi',
  total: 'TOTAL',
  payment: 'Paiement',
  note: 'Note',
  staff: 'Personnel',
  scanDigitalReceipt: 'Scannez pour le reùu digital',
  thankYou: 'Merci',
  kitchen: 'CUISINE',
  dineIn: 'SUR PLACE',
  takeaway: 'EMPORTER',
  delivery: 'LIVRAISON',
  cash: 'Espùces',
  card: 'Carte',
  terminal: 'Terminal',
  express: 'Express',
  pax: 'Couverts',
  endOfDay: 'RAPPORT DE FIN DE JOURNùE',
  salesCount: 'Ventes',
  revenue: 'Chiffre dùaffaires',
  productsSold: 'Produits vendus',
  cancelled: 'Annulùes',
  refunds: 'Remboursements',
  covers: 'Couverts',
  pickupTime: 'Retrait :',
  deliveryTime: 'Livraison :',
  asap: 'Dùs que possible',
  payLater: 'Payer plus tard',
};

const DE: ReceiptLabels = {
  date: 'Datum',
  sale: 'Verkauf',
  channel: 'Kanal',
  table: 'Tisch',
  subtotal: 'Zwischensumme',
  discount: 'Rabatt',
  tax: 'MwSt.',
  rounding: 'Rundung',
  total: 'TOTAL',
  payment: 'Zahlung',
  note: 'Notiz',
  staff: 'Personal',
  scanDigitalReceipt: 'Scannen fùr digitalen Beleg',
  thankYou: 'Danke',
  kitchen: 'KùCHE',
  dineIn: 'VOR ORT',
  takeaway: 'ZUM MITNEHMEN',
  delivery: 'LIEFERUNG',
  cash: 'Bar',
  card: 'Karte',
  terminal: 'Terminal',
  express: 'Express',
  pax: 'Gùste',
  endOfDay: 'TAGESABSCHLUSS',
  salesCount: 'Verkùufe',
  revenue: 'Umsatz',
  productsSold: 'Verkaufte Produkte',
  cancelled: 'Storniert',
  refunds: 'Rùckerstattungen',
  covers: 'Gedecke',
  pickupTime: 'Abholung:',
  deliveryTime: 'Lieferung:',
  asap: 'Sofort',
  payLater: 'Sp‰ter zahlen',
};

export function receiptLabels(lang: string | null | undefined): ReceiptLabels {
  const code = String(lang || 'en').toLowerCase().slice(0, 2);
  if (code === 'fr') return FR;
  if (code === 'de') return DE;
  return EN;
}

export function channelLabel(labels: ReceiptLabels, channel?: string | null): string {
  if (channel === 'dine_in') return labels.dineIn;
  if (channel === 'delivery') return labels.delivery;
  return labels.takeaway;
}

export function paymentLabel(labels: ReceiptLabels, method?: string | null): string {
  const m = String(method || '').toLowerCase();
  if (m === 'cash' || m === 'express') return m === 'express' ? labels.express : labels.cash;
  if (m === 'card') return labels.card;
  if (m === 'terminal') return labels.terminal;
  return String(method || '').toUpperCase();
}

export function lineWidthForPaper(mm?: number | null): number {
  return Number(mm) === 58 ? 32 : 48;
}
