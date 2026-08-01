export type PosChannel = 'takeaway' | 'dine_in' | 'delivery';

export type PosTab = 'tables' | 'register' | 'orders' | 'bookings';

export type PosView = PosTab | 'checkout' | 'success';

export type KeypadMode = 'qty' | 'percent' | 'price';

export type PosPaymentMethod = 'cash' | 'card' | 'terminal' | 'pay_later';

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
};

export type Category = { id: string; name: string };

export type Product = {
  id: string;
  name: string;
  price: number | string;
  categoryId?: string | null;
  isTaxable?: boolean;
  isOpenPrice?: boolean;
  stock?: number;
  productType?: string;
  allowExtras?: boolean;
  extras?: Array<{ id: string; name: string; price: number; isDefault?: boolean }>;
  modifierGroups?: import('@/components/shop/ShopProductModifiersModal').ShopModifierGroup[];
  comboSlots?: import('@/components/shop/ShopComboWizard').ComboSlot[];
};

export type PostSuccessTarget = 'register' | 'tables';
