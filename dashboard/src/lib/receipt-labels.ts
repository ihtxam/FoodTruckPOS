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
  reportPeriod: string;
  salesSummary: string;
  salesCount: string;
  revenue: string;
  productsSold: string;
  cancelled: string;
  refunds: string;
  covers: string;
  tipsNotTaxable: string;
  grandTotal: string;
  orders: string;
  guestsServed: string;
  paymentMethods: string;
  orderTypes: string;
  tva: string;
  type: string;
  net: string;
  brut: string;
  totalQty: string;
  pickupTime: string;
  deliveryTime: string;
  asap: string;
  payLater: string;
  totalItems: string;
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
  endOfDay: 'END OF DAY',
  reportPeriod: 'Report Period',
  salesSummary: 'SALES SUMMARY',
  salesCount: 'Sales',
  revenue: 'Revenue',
  productsSold: 'PRODUCTS SOLD',
  cancelled: 'Cancelled',
  refunds: 'Refunds',
  covers: 'Covers',
  tipsNotTaxable: 'Tips (not taxable)',
  grandTotal: 'GRAND TOTAL',
  orders: 'Orders',
  guestsServed: 'Guests served',
  paymentMethods: 'PAYMENT METHODS',
  orderTypes: 'ORDER TYPES',
  tva: 'TVA',
  type: 'Type',
  net: 'Net',
  brut: 'Brut',
  totalQty: 'Total qty',
  pickupTime: 'Pickup:',
  deliveryTime: 'Delivery:',
  asap: 'ASAP',
  payLater: 'Pay later',
  totalItems: 'Items',
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
  scanDigitalReceipt: 'Scannez pour le recu digital',
  thankYou: 'Merci',
  kitchen: 'CUISINE',
  dineIn: 'SUR PLACE',
  takeaway: 'EMPORTER',
  delivery: 'LIVRAISON',
  cash: 'Especes',
  card: 'Carte',
  terminal: 'Terminal',
  express: 'Express',
  pax: 'Couverts',
  endOfDay: 'FIN DE JOURNEE',
  reportPeriod: 'Periode du rapport',
  salesSummary: 'RESUME DES VENTES',
  salesCount: 'Ventes',
  revenue: "Chiffre d'affaires",
  productsSold: 'PRODUITS VENDUS',
  cancelled: 'Annulees',
  refunds: 'Remboursements',
  covers: 'Couverts',
  tipsNotTaxable: 'Pourboires (non taxables)',
  grandTotal: 'TOTAL GENERAL',
  orders: 'Commandes',
  guestsServed: 'Couverts servis',
  paymentMethods: 'MODES DE PAIEMENT',
  orderTypes: 'TYPES DE COMMANDE',
  tva: 'TVA',
  type: 'Type',
  net: 'Net',
  brut: 'Brut',
  totalQty: 'Qte totale',
  pickupTime: 'Retrait :',
  deliveryTime: 'Livraison :',
  asap: 'Des que possible',
  payLater: 'Payer plus tard',
  totalItems: 'Articles',
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
  scanDigitalReceipt: 'Scannen fuer digitalen Beleg',
  thankYou: 'Danke',
  kitchen: 'KUECHE',
  dineIn: 'VOR ORT',
  takeaway: 'ZUM MITNEHMEN',
  delivery: 'LIEFERUNG',
  cash: 'Bar',
  card: 'Karte',
  terminal: 'Terminal',
  express: 'Express',
  pax: 'Gaeste',
  endOfDay: 'TAGESABSCHLUSS',
  reportPeriod: 'Berichtszeitraum',
  salesSummary: 'VERKAUFSUEBERSICHT',
  salesCount: 'Verkaeufe',
  revenue: 'Umsatz',
  productsSold: 'VERKAUFTE PRODUKTE',
  cancelled: 'Storniert',
  refunds: 'Rueckerstattungen',
  covers: 'Gedecke',
  tipsNotTaxable: 'Trinkgeld (nicht steuerpflichtig)',
  grandTotal: 'GESAMTSUMME',
  orders: 'Bestellungen',
  guestsServed: 'Gaeste bedient',
  paymentMethods: 'ZAHLUNGSARTEN',
  orderTypes: 'BESTELLARTEN',
  tva: 'MwSt.',
  type: 'Typ',
  net: 'Netto',
  brut: 'Brutto',
  totalQty: 'Menge gesamt',
  pickupTime: 'Abholung:',
  deliveryTime: 'Lieferung:',
  asap: 'Sofort',
  payLater: 'Spaeter zahlen',
  totalItems: 'Artikel',
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
