export type Permission =
  | 'USE_POS'
  | 'USE_WEBPOS'
  | 'PROCESS_PAYMENTS'
  | 'APPLY_DISCOUNTS'
  | 'OPEN_CASH_DRAWER'
  | 'SEND_KITCHEN'
  | 'MANAGE_TABLES'
  | 'TAKEAWAY_ORDERS'
  | 'DELIVERY_ORDERS'
  | 'VIEW_ORDER_HISTORY'
  | 'CANCEL_ORDERS'
  | 'REFUND_ORDERS'
  | 'VIEW_REPORTS'
  | 'MANAGE_PRODUCTS'
  | 'MANAGE_CUSTOMERS'
  | 'MANAGE_OFFERS'
  | 'MANAGE_ONLINE_SHOP'
  | 'MANAGE_SETTINGS'
  | 'ACCESS_PANEL'
  | 'MANAGE_STAFF'
  | 'MANAGE_ROLES'
  | 'MANAGE_BILLING'
  | 'END_OF_DAY';

export const ALL_PERMISSIONS: Permission[] = [
  'USE_POS',
  'USE_WEBPOS',
  'PROCESS_PAYMENTS',
  'APPLY_DISCOUNTS',
  'OPEN_CASH_DRAWER',
  'SEND_KITCHEN',
  'MANAGE_TABLES',
  'TAKEAWAY_ORDERS',
  'DELIVERY_ORDERS',
  'VIEW_ORDER_HISTORY',
  'CANCEL_ORDERS',
  'REFUND_ORDERS',
  'VIEW_REPORTS',
  'MANAGE_PRODUCTS',
  'MANAGE_CUSTOMERS',
  'MANAGE_OFFERS',
  'MANAGE_ONLINE_SHOP',
  'MANAGE_SETTINGS',
  'ACCESS_PANEL',
  'MANAGE_STAFF',
  'MANAGE_ROLES',
  'MANAGE_BILLING',
  'END_OF_DAY',
];

export const PANEL_ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  '/merchant': ['VIEW_REPORTS', 'ACCESS_PANEL'],
  '/merchant/orders': ['VIEW_ORDER_HISTORY'],
  '/merchant/pos': ['USE_WEBPOS'],
  '/merchant/reports': ['VIEW_REPORTS', 'END_OF_DAY'],
  '/merchant/products': ['MANAGE_PRODUCTS'],
  '/merchant/modifiers': ['MANAGE_PRODUCTS'],
  '/merchant/categories': ['MANAGE_PRODUCTS'],
  '/merchant/customers': ['MANAGE_CUSTOMERS'],
  '/merchant/loyalty': ['MANAGE_CUSTOMERS'],
  '/merchant/offers': ['MANAGE_OFFERS'],
  '/merchant/newsletter': ['MANAGE_ONLINE_SHOP'],
  '/merchant/online-shop': ['MANAGE_ONLINE_SHOP'],
  '/merchant/website': ['MANAGE_ONLINE_SHOP'],
  '/merchant/floor-plan': ['MANAGE_TABLES'],
  '/merchant/reservations': ['MANAGE_ONLINE_SHOP'],
  '/merchant/billing': ['MANAGE_BILLING'],
  '/merchant/settings': ['MANAGE_SETTINGS'],
  '/merchant/users': ['MANAGE_STAFF'],
};

export function canAccessRoute(
  path: string,
  permissions: Permission[] | undefined,
  isOwner: boolean
): boolean {
  if (isOwner) return true;
  const required = PANEL_ROUTE_PERMISSIONS[path];
  if (!required?.length) return true;
  if (!permissions?.length) return false;
  return required.some((p) => permissions.includes(p));
}

export function hasPermission(
  permissions: Permission[] | undefined,
  required: Permission,
  isOwner = false
): boolean {
  if (isOwner) return true;
  return !!permissions?.includes(required);
}

export type WebPosStaffSession = {
  id: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
};

const WEBPOS_STAFF_KEY = 'webpos_staff_session';

export function loadWebPosStaffSession(): WebPosStaffSession | null {
  try {
    const raw = sessionStorage.getItem(WEBPOS_STAFF_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WebPosStaffSession;
  } catch {
    return null;
  }
}

export function saveWebPosStaffSession(session: WebPosStaffSession | null) {
  if (!session) {
    sessionStorage.removeItem(WEBPOS_STAFF_KEY);
    return;
  }
  sessionStorage.setItem(WEBPOS_STAFF_KEY, JSON.stringify(session));
}

export function clearWebPosStaffSession() {
  sessionStorage.removeItem(WEBPOS_STAFF_KEY);
}
