/** POS + panel permissions (aligned with Android PosPermission + panel extras). */
export const PERMISSIONS = [
  "USE_POS",
  "USE_WEBPOS",
  "PROCESS_PAYMENTS",
  "APPLY_DISCOUNTS",
  "OPEN_CASH_DRAWER",
  "SEND_KITCHEN",
  "MANAGE_TABLES",
  "TAKEAWAY_ORDERS",
  "DELIVERY_ORDERS",
  "VIEW_ORDER_HISTORY",
  "CANCEL_ORDERS",
  "REFUND_ORDERS",
  "VIEW_REPORTS",
  "MANAGE_PRODUCTS",
  "MANAGE_CUSTOMERS",
  "MANAGE_OFFERS",
  "MANAGE_ONLINE_SHOP",
  "MANAGE_SETTINGS",
  "ACCESS_PANEL",
  "MANAGE_STAFF",
  "MANAGE_ROLES",
  "MANAGE_BILLING",
  "END_OF_DAY",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function parsePermissions(raw?: string | null): Permission[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Permission => (PERMISSIONS as readonly string[]).includes(s));
}

export function encodePermissions(perms: Permission[]): string {
  return [...new Set(perms)].join(",");
}

export function hasPermission(granted: Permission[] | undefined, required: Permission): boolean {
  if (!granted) return false;
  return granted.includes(required);
}

export function hasAnyPermission(granted: Permission[] | undefined, required: Permission[]): boolean {
  if (!granted?.length) return false;
  return required.some((p) => granted.includes(p));
}

/** Merchant owner (login via merchants table) implicitly has all permissions. */
export const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

export type DefaultRoleTemplate = {
  name: string;
  permissions: Permission[];
  isSystem: boolean;
  sortOrder: number;
};

export const DEFAULT_ROLE_TEMPLATES: DefaultRoleTemplate[] = [
  {
    name: "Manager",
    isSystem: true,
    sortOrder: 10,
    permissions: [
      "ACCESS_PANEL",
      "USE_WEBPOS",
      "USE_POS",
      "PROCESS_PAYMENTS",
      "APPLY_DISCOUNTS",
      "OPEN_CASH_DRAWER",
      "SEND_KITCHEN",
      "MANAGE_TABLES",
      "TAKEAWAY_ORDERS",
      "DELIVERY_ORDERS",
      "VIEW_ORDER_HISTORY",
      "CANCEL_ORDERS",
      "REFUND_ORDERS",
      "VIEW_REPORTS",
      "MANAGE_PRODUCTS",
      "MANAGE_CUSTOMERS",
      "MANAGE_OFFERS",
      "MANAGE_ONLINE_SHOP",
      "MANAGE_SETTINGS",
      "MANAGE_STAFF",
      "END_OF_DAY",
    ],
  },
  {
    name: "Waiter",
    isSystem: true,
    sortOrder: 20,
    permissions: [
      "USE_WEBPOS",
      "USE_POS",
      "PROCESS_PAYMENTS",
      "APPLY_DISCOUNTS",
      "OPEN_CASH_DRAWER",
      "SEND_KITCHEN",
      "MANAGE_TABLES",
      "TAKEAWAY_ORDERS",
      "VIEW_ORDER_HISTORY",
      "CANCEL_ORDERS",
    ],
  },
  {
    name: "Delivery",
    isSystem: true,
    sortOrder: 30,
    permissions: ["USE_POS", "DELIVERY_ORDERS", "VIEW_ORDER_HISTORY", "SEND_KITCHEN", "PROCESS_PAYMENTS"],
  },
  {
    name: "User",
    isSystem: true,
    sortOrder: 40,
    permissions: ["USE_WEBPOS", "USE_POS", "PROCESS_PAYMENTS", "TAKEAWAY_ORDERS", "VIEW_ORDER_HISTORY"],
  },
  {
    name: "Cashier",
    isSystem: true,
    sortOrder: 50,
    permissions: [
      "USE_WEBPOS",
      "USE_POS",
      "PROCESS_PAYMENTS",
      "TAKEAWAY_ORDERS",
      "VIEW_ORDER_HISTORY",
      "OPEN_CASH_DRAWER",
      "APPLY_DISCOUNTS",
    ],
  },
];

/** Panel sidebar route ? required permission (any match grants access). */
export const PANEL_ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  "/merchant": ["VIEW_REPORTS", "ACCESS_PANEL"],
  "/merchant/orders": ["VIEW_ORDER_HISTORY"],
  "/merchant/pos": ["USE_WEBPOS"],
  "/merchant/products": ["MANAGE_PRODUCTS"],
  "/merchant/modifiers": ["MANAGE_PRODUCTS"],
  "/merchant/categories": ["MANAGE_PRODUCTS"],
  "/merchant/customers": ["MANAGE_CUSTOMERS"],
  "/merchant/loyalty": ["MANAGE_CUSTOMERS"],
  "/merchant/offers": ["MANAGE_OFFERS"],
  "/merchant/newsletter": ["MANAGE_ONLINE_SHOP"],
  "/merchant/online-shop": ["MANAGE_ONLINE_SHOP"],
  "/merchant/website": ["MANAGE_ONLINE_SHOP"],
  "/merchant/floor-plan": ["MANAGE_TABLES"],
  "/merchant/reservations": ["MANAGE_ONLINE_SHOP"],
  "/merchant/billing": ["MANAGE_BILLING"],
  "/merchant/settings": ["MANAGE_SETTINGS"],
  "/merchant/users": ["MANAGE_STAFF"],
};
