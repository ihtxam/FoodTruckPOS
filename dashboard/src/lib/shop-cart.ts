export type ShopChannel = 'takeaway' | 'dine_in' | 'delivery';

export interface ShopSelectedExtra {
  id: string;
  name: string;
  price: number;
  groupId?: string;
  groupTitle?: string;
}

export interface ShopComboSelection {
  slotId: string;
  slotName: string;
  productId: string;
  productName: string;
  image?: string | null;
  extraPrice: number;
  selectedExtras: ShopSelectedExtra[];
}

export interface ShopCartItem {
  /** Unique cart line (same product can appear twice with different extras). */
  lineId: string;
  /** Product id */
  id: string;
  name: string;
  /** Unit price including selected extras */
  price: number;
  /** Product base price without extras */
  basePrice: number;
  quantity: number;
  description?: string;
  image?: string;
  selectedExtras?: ShopSelectedExtra[];
  comboSelections?: ShopComboSelection[];
}

export interface ShopCheckoutDraft {
  channel: ShopChannel;
  items: ShopCartItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  zipCode: string;
  city: string;
  notes: string;
  tipAmount: number;
  scheduledFor: string; // '' = ASAP, else datetime-local value
  paymentMethod: 'cash' | 'card';
  authMode: 'guest' | 'login' | 'register';
  lat?: number;
  lng?: number;
}

const PREFIX = 'manupos_shop_cart_v1:';

export function cartStorageKey(shopKey: string) {
  return `${PREFIX}${shopKey}`;
}

function normalizeCartItem(item: Partial<ShopCartItem> & { id: string; name: string; price: number; quantity: number }): ShopCartItem {
  const selectedExtras = Array.isArray(item.selectedExtras) ? item.selectedExtras : [];
  const comboSelections = Array.isArray(item.comboSelections) ? item.comboSelections : [];
  const basePrice = typeof item.basePrice === 'number' ? item.basePrice : item.price;
  return {
    lineId: item.lineId || `${item.id}-${lineSignature(selectedExtras, comboSelections)}`,
    id: item.id,
    name: item.name,
    price: item.price,
    basePrice,
    quantity: item.quantity,
    description: item.description,
    image: item.image,
    selectedExtras,
    comboSelections,
  };
}

export function loadCart(shopKey: string): ShopCheckoutDraft | null {
  try {
    const raw = localStorage.getItem(cartStorageKey(shopKey));
    if (!raw) return null;
    const draft = JSON.parse(raw) as ShopCheckoutDraft;
    return {
      ...draft,
      items: (draft.items || []).map((i) => normalizeCartItem(i)),
    };
  } catch {
    return null;
  }
}

export function saveCart(shopKey: string, draft: ShopCheckoutDraft) {
  localStorage.setItem(cartStorageKey(shopKey), JSON.stringify(draft));
}

export function clearCart(shopKey: string) {
  localStorage.removeItem(cartStorageKey(shopKey));
}

export function emptyDraft(channel: ShopChannel = 'takeaway'): ShopCheckoutDraft {
  return {
    channel,
    items: [],
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    address: '',
    zipCode: '',
    city: '',
    notes: '',
    tipAmount: 0,
    scheduledFor: '',
    paymentMethod: 'cash',
    authMode: 'guest',
  };
}

export function cartSubtotal(items: ShopCartItem[]) {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}

export function extrasSignature(extras?: ShopSelectedExtra[]) {
  return (extras || [])
    .map((e) => e.id)
    .sort()
    .join(',');
}

export function comboSignature(combo?: ShopComboSelection[]) {
  return (combo || [])
    .map(
      (c) =>
        `${c.slotId}:${c.productId}:${extrasSignature(c.selectedExtras)}`
    )
    .sort()
    .join('|');
}

export function lineSignature(extras?: ShopSelectedExtra[], combo?: ShopComboSelection[]) {
  const e = extrasSignature(extras);
  const c = comboSignature(combo);
  return [e || 'plain', c || ''].filter(Boolean).join('~') || 'plain';
}

export function newCartLineId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const RESERVED_SUBDOMAINS = new Set(['admin', 'api', 'pay', 'www', 'app', 'panel', 'shop']);

function publicDomain() {
  return (import.meta.env.VITE_PUBLIC_DOMAIN || 'manupos.webprintmedia.swiss').toLowerCase();
}

function subdomainLabel() {
  const host = window.location.hostname.toLowerCase();
  const main = publicDomain();
  if (host === main || !host.endsWith(`.${main}`)) return '';
  return host.slice(0, -(main.length + 1));
}

/**
 * Resolve public shop key:
 * - /shop/:slug or shop.domain/:slug → param slug
 * - {slug}.domain → subdomain label (not reserved)
 */
export function resolveShopKey(paramSlug?: string) {
  if (paramSlug) return paramSlug;
  const label = subdomainLabel();
  if (label && !RESERVED_SUBDOMAINS.has(label)) return label;
  if (label === 'shop') {
    const seg = window.location.pathname.split('/').filter(Boolean)[0];
    if (seg && !['checkout', 'order', 'api', 'assets'].includes(seg)) return seg;
  }
  return '';
}

/** Frontend path prefix for a shop (Chaslay shop hub vs /shop/:slug vs subdomain root). */
export function shopBasePath(shopKey: string) {
  const label = subdomainLabel();
  if (label && !RESERVED_SUBDOMAINS.has(label)) return ''; // {slug}.domain → /
  if (label === 'shop') return `/${shopKey}`; // shop.domain/{slug}
  return `/shop/${shopKey}`;
}

const CUSTOMER_TOKEN_PREFIX = 'manupos_shop_customer:';

export function loadCustomerToken(shopKey: string) {
  return localStorage.getItem(`${CUSTOMER_TOKEN_PREFIX}${shopKey}`) || '';
}

export function saveCustomerToken(shopKey: string, token: string) {
  localStorage.setItem(`${CUSTOMER_TOKEN_PREFIX}${shopKey}`, token);
}

export function clearCustomerToken(shopKey: string) {
  localStorage.removeItem(`${CUSTOMER_TOKEN_PREFIX}${shopKey}`);
}
