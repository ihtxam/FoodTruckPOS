/**
 * SaaS edition feature catalog — capability gates (not staff RBAC).
 * Keep in sync with dashboard/src/lib/edition-features.ts
 */

export type EditionFeatureKey =
  | "pos_tables"
  | "pos_courses"
  | "pos_shifts"
  | "pos_kitchen"
  | "pos_express"
  | "pos_retail"
  | "pos_cash_drawer"
  | "pos_tips"
  | "pos_gift_cards"
  | "channel_takeaway"
  | "channel_delivery"
  | "channel_online_orders"
  | "online_shop"
  | "online_payments"
  | "gift_cards"
  | "loyalty"
  | "offers"
  | "reports"
  | "staff_roles"
  | "reservations"
  | "website_cms";

export type EditionFeatureGroup = {
  id: string;
  label: string;
  features: Array<{ key: EditionFeatureKey; label: string }>;
};

export const EDITION_FEATURE_GROUPS: EditionFeatureGroup[] = [
  {
    id: "pos",
    label: "POS",
    features: [
      { key: "pos_tables", label: "Tables / floor plan" },
      { key: "pos_courses", label: "Courses" },
      { key: "pos_shifts", label: "Shift management" },
      { key: "pos_kitchen", label: "Kitchen tickets" },
      { key: "pos_express", label: "Express checkout" },
      { key: "pos_retail", label: "Retail mode" },
      { key: "pos_cash_drawer", label: "Cash drawer" },
      { key: "pos_tips", label: "Tips" },
      { key: "pos_gift_cards", label: "Gift cards at POS" },
    ],
  },
  {
    id: "channels",
    label: "Channels",
    features: [
      { key: "channel_takeaway", label: "Takeaway" },
      { key: "channel_delivery", label: "Delivery" },
      { key: "channel_online_orders", label: "Online orders" },
    ],
  },
  {
    id: "commerce",
    label: "Commerce",
    features: [
      { key: "online_shop", label: "Online shop" },
      { key: "online_payments", label: "Online payments" },
      { key: "gift_cards", label: "Gift cards module" },
      { key: "loyalty", label: "Loyalty / membership" },
      { key: "offers", label: "Offers / promotions" },
    ],
  },
  {
    id: "ops",
    label: "Operations",
    features: [
      { key: "reports", label: "Reports / end of day" },
      { key: "staff_roles", label: "Staff & roles" },
      { key: "reservations", label: "Reservations" },
      { key: "website_cms", label: "Website / CMS" },
    ],
  },
];

export const ALL_EDITION_FEATURES: EditionFeatureKey[] = EDITION_FEATURE_GROUPS.flatMap((g) =>
  g.features.map((f) => f.key)
);

/** Merchant panel routes gated by edition features */
export const EDITION_ROUTE_FEATURES: Record<string, EditionFeatureKey[]> = {
  "/merchant/floor-plan": ["pos_tables"],
  "/merchant/loyalty": ["loyalty", "gift_cards"],
  "/merchant/offers": ["offers"],
  "/merchant/newsletter": ["online_shop"],
  "/merchant/online-shop": ["online_shop"],
  "/merchant/website": ["website_cms"],
  "/merchant/reservations": ["reservations"],
  "/merchant/reports": ["reports"],
  "/merchant/users": ["staff_roles"],
};

export function normalizeEditionFeatures(input: unknown): EditionFeatureKey[] {
  if (!Array.isArray(input)) return [...ALL_EDITION_FEATURES];
  const allowed = new Set<string>(ALL_EDITION_FEATURES);
  const out: EditionFeatureKey[] = [];
  for (const raw of input) {
    const key = String(raw || "").trim();
    if (allowed.has(key) && !out.includes(key as EditionFeatureKey)) {
      out.push(key as EditionFeatureKey);
    }
  }
  return out;
}

export function hasEditionFeature(
  features: EditionFeatureKey[] | null | undefined,
  required: EditionFeatureKey
): boolean {
  // null/undefined = legacy full access
  if (features == null) return true;
  return features.includes(required);
}

export function hasAnyEditionFeature(
  features: EditionFeatureKey[] | null | undefined,
  required: EditionFeatureKey[]
): boolean {
  if (features == null) return true;
  if (!required.length) return true;
  return required.some((k) => features.includes(k));
}

export function canAccessEditionRoute(
  path: string,
  features: EditionFeatureKey[] | null | undefined
): boolean {
  const required = EDITION_ROUTE_FEATURES[path];
  if (!required?.length) return true;
  return hasAnyEditionFeature(features, required);
}

/** Defaults applied when assigning a retail-oriented edition */
export function retailDefaultsFromFeatures(features: EditionFeatureKey[]) {
  const hasTables = features.includes("pos_tables");
  return {
    floorPlanEnabled: hasTables,
    coursesEnabled: features.includes("pos_courses"),
    reservationsEnabled: features.includes("reservations"),
    shopEnabled: features.includes("online_shop"),
    pickupEnabled: features.includes("channel_takeaway"),
    deliveryEnabled: features.includes("channel_delivery"),
    loyaltyEnabled: features.includes("loyalty"),
    webposGiftCardEnabled: features.includes("pos_gift_cards") || features.includes("gift_cards"),
    posMode: features.includes("pos_retail") && !hasTables ? ("retail" as const) : ("restaurant" as const),
  };
}
