export type PosChannel = 'takeaway' | 'dine_in' | 'delivery';

export type PosTab = 'tables' | 'register' | 'orders' | 'bookings';

export type PosView = PosTab | 'checkout' | 'success';

export type KeypadMode = 'qty' | 'percent' | 'price';

export type PosPaymentMethod = 'cash' | 'card' | 'terminal' | 'pay_later' | 'gift_card';

export type GiftCardLineMeta = {
  op: 'sell' | 'reload';
  cardNumber: string;
  cardId?: string;
  mediaType: 'physical' | 'e_card';
  amount: number;
};

export type CartLine = {
  lineId: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxable: boolean;
  categoryId?: string | null;
  selectedExtras: import('@/lib/shop-cart').ShopSelectedExtra[];
  comboSelections: import('@/lib/shop-cart').ShopComboSelection[];
  isOpenPrice?: boolean;
  courseNumber?: number;
  lineDiscountPercent?: number;
  sentToKitchen?: boolean;
  /** Gift card sell/reload — credited after successful payment */
  giftCard?: GiftCardLineMeta;
};

export type Category = { id: string; name: string; color?: string | null };

export type Product = {
  id: string;
  name: string;
  price: number | string;
  categoryId?: string | null;
  isTaxable?: boolean;
  isOpenPrice?: boolean;
  stock?: number;
  productType?: string;
  sku?: string | null;
  barcode?: string | null;
  allowExtras?: boolean;
  extras?: Array<{ id: string; name: string; price: number; isDefault?: boolean }>;
  modifierGroups?: import('@/components/shop/ShopProductModifiersModal').ShopModifierGroup[];
  comboSlots?: import('@/components/shop/ShopComboWizard').ComboSlot[];
};

export type PostSuccessTarget = 'register' | 'tables';

/** In-memory open cart draft for a table / tab / channel (session only). */
export type OpenCartDraft = {
  cart: CartLine[];
  channel: PosChannel | null;
  tableId: string | null;
  tableLabel: string | null;
  tabNumber: string | null;
  orderNote: string;
  activeCourse: number;
  orderSent: boolean;
  coursesBulkSent: boolean;
  selectedLineId: string | null;
  keypadBuffer: string;
};

export function openCartDraftKey(opts: {
  tableId?: string | null;
  tabNumber?: string | null;
  channel?: PosChannel | null;
}): string {
  if (opts.tableId) return `table:${opts.tableId}`;
  if (opts.tabNumber) return `tab:${opts.tabNumber}`;
  if (opts.channel === 'delivery') return 'channel:delivery';
  return 'channel:takeaway';
}
