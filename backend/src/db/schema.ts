import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  integer,
  json,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// SUPERADMIN & AUTHENTICATION
// ============================================================================

export const superadmins = pgTable(
  "superadmins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }).default("superadmin").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("superadmins_email_idx").on(table.email),
  })
);

// ============================================================================
// MERCHANTS (TENANTS)
// ============================================================================

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    phone: varchar("phone", { length: 20 }),
    businessLicense: varchar("business_license", { length: 255 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    country: varchar("country", { length: 100 }),
    vatNumber: varchar("vat_number", { length: 50 }),
    vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("0"),
    // Channel-specific tax rates (%). Fall back to vatRate when null/0 unused.
    taxTakeawayRate: decimal("tax_takeaway_rate", { precision: 5, scale: 2 }).default("0"),
    taxDineInRate: decimal("tax_dine_in_rate", { precision: 5, scale: 2 }).default("0"),
    taxDeliveryRate: decimal("tax_delivery_rate", { precision: 5, scale: 2 }).default("0"),
    // Online shop: path slug + optional DNS subdomain (e.g. demo → demo.domain)
    slug: varchar("slug", { length: 100 }),
    subdomain: varchar("subdomain", { length: 63 }),
    /** Custom apex/domain for CMS website (e.g. cafe.ch) — DNS CNAME to platform */
    customDomain: varchar("custom_domain", { length: 255 }),
    shopEnabled: boolean("shop_enabled").default(false).notNull(),
    /** When true, shop root serves published CMS homepage instead of menu */
    cmsHomepageEnabled: boolean("cms_homepage_enabled").default(false).notNull(),
    // Online ordering channels
    pickupEnabled: boolean("pickup_enabled").default(true).notNull(),
    dineInEnabled: boolean("dine_in_enabled").default(true).notNull(),
    deliveryEnabled: boolean("delivery_enabled").default(true).notNull(),
    // Per-channel weekly hours (+ optional display for homepage banner):
    // { takeaway: { mon: [{ open, close }] }, delivery, dine_in, display }
    storeHours: json("store_hours").$type<Record<string, Record<string, Array<{ open: string; close: string }>>>>().default({}),
    shopLogoUrl: varchar("shop_logo_url", { length: 500 }),
    shopBannerUrl: varchar("shop_banner_url", { length: 500 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    pickupEtaMinutes: integer("pickup_eta_minutes").default(25),
    deliveryEtaMinutes: integer("delivery_eta_minutes").default(45),
    // Adyen credentials (merchant-level; shared by online shop + payment terminals)
    adyenMerchantAccount: varchar("adyen_merchant_account", { length: 255 }),
    adyenApiKey: text("adyen_api_key"),
    adyenClientId: varchar("adyen_client_id", { length: 255 }),
    /** Fixed CHF surcharge added to online card checkouts */
    onlineCardFeeFixed: decimal("online_card_fee_fixed", { precision: 10, scale: 2 }).default("0"),
    /** Percent surcharge on (subtotal+tax+delivery+tip) for online card checkouts */
    onlineCardFeePercent: decimal("online_card_fee_percent", { precision: 6, scale: 3 }).default("0"),
    // Online shop fidelity / loyalty program (customer account points)
    loyaltyEnabled: boolean("loyalty_enabled").default(false).notNull(),
    /** Points earned per 1.00 CHF of paid food subtotal (default 1) */
    loyaltyEarnPointsPerChf: decimal("loyalty_earn_points_per_chf", { precision: 8, scale: 3 }).default("1"),
    /** Points required to redeem 1.00 CHF discount (default 100) */
    loyaltyRedeemPointsPerChf: integer("loyalty_redeem_points_per_chf").default(100).notNull(),
    /** Earn lots expire after this many days (default 30) */
    loyaltyPointsExpiryDays: integer("loyalty_points_expiry_days").default(30).notNull(),
    panelLanguage: varchar("panel_language", { length: 10 }).default("en").notNull(), // en | fr | de
    /** Chaslay/FoodTruck Android POS sync key (X-Api-Key header) */
    syncApiKey: varchar("sync_api_key", { length: 64 }),
    // Restaurant floor / PAX
    floorPlanEnabled: boolean("floor_plan_enabled").default(false).notNull(),
    // When true: order & bill per person (Person 1…) at a table; kitchen tickets split by seat
    paxOrderingEnabled: boolean("pax_ordering_enabled").default(false).notNull(),
    status: varchar("status", { length: 50 }).default("active").notNull(), // active, suspended, trial, expired
    subscriptionPlan: varchar("subscription_plan", { length: 50 }).default("free"), // free, starter, professional, enterprise
    trialEndsAt: timestamp("trial_ends_at"),
    subscriptionEndsAt: timestamp("subscription_ends_at"),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("merchants_email_idx").on(table.email),
    statusIdx: index("merchants_status_idx").on(table.status),
    slugIdx: uniqueIndex("merchants_slug_idx").on(table.slug),
    subdomainIdx: uniqueIndex("merchants_subdomain_idx").on(table.subdomain),
    customDomainIdx: uniqueIndex("merchants_custom_domain_idx").on(table.customDomain),
    syncApiKeyIdx: uniqueIndex("merchants_sync_api_key_idx").on(table.syncApiKey),
  })
);

// ============================================================================
// DEVICES
// ============================================================================

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    deviceId: varchar("device_id", { length: 255 }).notNull().unique(), // POS-{MERCHANT_ID}-{UUID}-{TIMESTAMP}
    deviceName: varchar("device_name", { length: 255 }).notNull(),
    deviceType: varchar("device_type", { length: 50 }).notNull(), // mobile, tablet, terminal
    osVersion: varchar("os_version", { length: 50 }),
    appVersion: varchar("app_version", { length: 50 }),
    lastSync: timestamp("last_sync"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("devices_merchant_id_idx").on(table.merchantId),
    deviceIdIdx: uniqueIndex("devices_device_id_idx").on(table.deviceId),
  })
);

// ============================================================================
// LICENSING SYSTEM
// ============================================================================

export const licenses = pgTable(
  "licenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    licenseKey: varchar("license_key", { length: 255 }).notNull().unique(), // M123ABC-D456EFG-7K9M2P-2025
    licenseType: varchar("license_type", { length: 50 }).notNull(), // trial, yearly, custom
    trialDays: integer("trial_days").default(7),
    startsAt: timestamp("starts_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    renewalNotifiedAt: timestamp("renewal_notified_at"),
    status: varchar("status", { length: 50 }).default("active").notNull(), // active, expired, suspended
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("licenses_merchant_id_idx").on(table.merchantId),
    deviceIdIdx: index("licenses_device_id_idx").on(table.deviceId),
    licenseKeyIdx: uniqueIndex("licenses_license_key_idx").on(table.licenseKey),
    statusIdx: index("licenses_status_idx").on(table.status),
    expiresAtIdx: index("licenses_expires_at_idx").on(table.expiresAt),
  })
);

// ============================================================================
// LICENSE TRANSACTIONS
// ============================================================================

export const licenseTransactions = pgTable(
  "license_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    transactionType: varchar("transaction_type", { length: 50 }).notNull(), // purchase, renewal, upgrade
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    paymentStatus: varchar("payment_status", { length: 50 }).notNull(), // pending, completed, failed
    paymentMethod: varchar("payment_method", { length: 50 }), // card, bank_transfer
    paymentId: varchar("payment_id", { length: 255 }),
    invoiceNumber: varchar("invoice_number", { length: 255 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("license_transactions_merchant_id_idx").on(table.merchantId),
    paymentStatusIdx: index("license_transactions_payment_status_idx").on(table.paymentStatus),
  })
);

// ============================================================================
// VAT SETTINGS
// ============================================================================

export const vatSettings = pgTable(
  "vat_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    country: varchar("country", { length: 100 }).notNull(),
    vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull(),
    taxId: varchar("tax_id", { length: 255 }),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("vat_settings_merchant_id_idx").on(table.merchantId),
  })
);

// ============================================================================
// PRODUCTS & CATEGORIES
// ============================================================================

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 7 }), // hex color
    sortOrder: integer("sort_order").default(0).notNull(),
    clientId: varchar("client_id", { length: 64 }), // offline sync id from POS device
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("categories_merchant_id_idx").on(table.merchantId),
    clientIdIdx: index("categories_client_id_idx").on(table.clientId),
  })
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: varchar("name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 100 }),
    barcode: varchar("barcode", { length: 255 }),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    cost: decimal("cost", { precision: 10, scale: 2 }),
    stock: integer("stock").default(0).notNull(),
    lowStockThreshold: integer("low_stock_threshold").default(5),
    isTaxable: boolean("is_taxable").default(true).notNull(),
    description: text("description"),
    imageUrl: varchar("image_url", { length: 500 }),
    // Offline-first retail POS extensions
    productType: varchar("product_type", { length: 50 }).default("standard").notNull(), // standard | open_price | weighed | combo | modifier
    isOpenPrice: boolean("is_open_price").default(false).notNull(),
    soldByWeight: boolean("sold_by_weight").default(false).notNull(),
    weightUnit: varchar("weight_unit", { length: 10 }).default("kg"), // kg | g | lb
    // [{ minQty: 10, price: 2.5 }, ...]
    bulkPricing: json("bulk_pricing").$type<Array<{ minQty: number; price: number }>>().default([]),
    // [{ id, name, price }] legacy flat extras (kept for POS sync; prefer modifier groups)
    extras: json("extras").$type<Array<{ id: string; name: string; price: number }>>().default([]),
    // Combo slots: [{ id, name, minPick, maxPick, options: [{ productId, extraPrice? }] }]
    // Legacy fixed components also supported: [{ productId, quantity, name? }]
    comboItems: json("combo_items")
      .$type<
        Array<{
          id?: string;
          name?: string;
          minPick?: number;
          maxPick?: number;
          options?: Array<{ productId: string; extraPrice?: number }>;
          productId?: string;
          quantity?: number;
        }>
      >()
      .default([]),
    // [{ id, name, price, saleStatus, isDefault, sortOrder }] size/spec variants
    specifications: json("specifications")
      .$type<
        Array<{
          id: string;
          name: string;
          price: number;
          saleStatus?: "in_stock" | "out_of_stock";
          isDefault?: boolean;
          sortOrder?: number;
        }>
      >()
      .default([]),
    buttonColor: varchar("button_color", { length: 20 }), // POS button color hex
    allowExtras: boolean("allow_extras").default(false).notNull(),
    /** If set (>0), customer can claim this product free by spending this many loyalty points */
    loyaltyRewardPoints: integer("loyalty_reward_points"),
    sortOrder: integer("sort_order").default(0).notNull(),
    clientId: varchar("client_id", { length: 64 }), // offline sync id from POS device
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("products_merchant_id_idx").on(table.merchantId),
    barcodeIdx: index("products_barcode_idx").on(table.barcode),
    clientIdIdx: index("products_client_id_idx").on(table.clientId),
    typeIdx: index("products_type_idx").on(table.productType),
    sortOrderIdx: index("products_sort_order_idx").on(table.merchantId, table.sortOrder),
  })
);

// ============================================================================
// MODIFIER GROUPS (extras / add-ons)
// ============================================================================

export const modifierGroups = pgTable(
  "modifier_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    // free | fixed | toppings_by_size
    pricingType: varchar("pricing_type", { length: 40 }).default("fixed").notNull(),
    // optional | required
    selectionType: varchar("selection_type", { length: 40 }).default("optional").notNull(),
    minSelectable: integer("min_selectable").default(0).notNull(),
    maxSelectable: integer("max_selectable").default(1).notNull(),
    defaultCollapsed: boolean("default_collapsed").default(false).notNull(),
    allowMultipleSameItem: boolean("allow_multiple_same_item").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("modifier_groups_merchant_id_idx").on(table.merchantId),
  })
);

export const modifierOptions = pgTable(
  "modifier_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).default("0").notNull(),
    // in_stock | out_of_stock
    saleStatus: varchar("sale_status", { length: 40 }).default("in_stock").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdIdx: index("modifier_options_group_id_idx").on(table.groupId),
  })
);

export const productModifierGroups = pgTable(
  "product_modifier_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("product_modifier_groups_product_id_idx").on(table.productId),
    groupIdIdx: index("product_modifier_groups_group_id_idx").on(table.groupId),
    uniqueLink: uniqueIndex("product_modifier_groups_unique").on(table.productId, table.groupId),
  })
);

// ============================================================================
// CUSTOMERS
// ============================================================================

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    passwordHash: varchar("password_hash", { length: 255 }), // null = guest-only profile
    defaultAddress: text("default_address"),
    defaultZip: varchar("default_zip", { length: 20 }),
    defaultCity: varchar("default_city", { length: 100 }),
    loyaltyPoints: integer("loyalty_points").default(0),
    totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("customers_merchant_id_idx").on(table.merchantId),
    emailIdx: index("customers_email_idx").on(table.email),
  })
);

// ============================================================================
// ORDERS
// ============================================================================

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    orderType: varchar("order_type", { length: 50 }).notNull(), // pos, web_shop
    // takeaway | dine_in | delivery — drives channel tax rate
    fulfillmentChannel: varchar("fulfillment_channel", { length: 50 }).default("takeaway"),
    // web_shop lifecycle: pending_approval → accepted|preparing → ready → out_for_delivery? → completed | cancelled
    // legacy: pending (treated as pending_approval), completed, cancelled
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0"),
    tipAmount: decimal("tip_amount", { precision: 10, scale: 2 }).default("0"),
    /** Online card surcharge charged to the customer */
    cardFee: decimal("card_fee", { precision: 10, scale: 2 }).default("0"),
    /** CHF discount applied from redeeming loyalty points as money */
    pointsDiscount: decimal("points_discount", { precision: 10, scale: 2 }).default("0"),
    pointsEarned: integer("points_earned").default(0),
    pointsRedeemed: integer("points_redeemed").default(0),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }), // cash, card, terminal, loyalty, online
    paymentStatus: varchar("payment_status", { length: 50 }), // pending, awaiting_payment, completed, failed
    adyenReference: varchar("adyen_reference", { length: 255 }),
    notes: text("notes"),
    shippingAddress: text("shipping_address"),
    deliveryZoneId: uuid("delivery_zone_id"),
    scheduledFor: timestamp("scheduled_for"), // null = ASAP
    customerName: varchar("customer_name", { length: 255 }),
    customerPhone: varchar("customer_phone", { length: 40 }),
    customerEmail: varchar("customer_email", { length: 255 }),
    // Dine-in table service
    tableId: uuid("table_id"),
    tableLabel: varchar("table_label", { length: 50 }),
    guestCount: integer("guest_count"), // PAX / covers for this check
    // Split billing: equal /N or per-seat payments
    billSplits: json("bill_splits")
      .$type<
        Array<{
          id: string;
          label: string; // "Person 1" | "Split 1/4" | "All"
          seatNumber?: number | null;
          amount: number;
          paymentMethod?: string;
          paymentStatus: string;
          paidAt?: string | null;
        }>
      >()
      .default([]),
    clientId: varchar("client_id", { length: 64 }), // offline POS transaction id
    deviceId: varchar("device_id", { length: 255 }),
    syncedAt: timestamp("synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    merchantIdIdx: index("orders_merchant_id_idx").on(table.merchantId),
    orderNumberIdx: uniqueIndex("orders_order_number_idx").on(table.orderNumber),
    statusIdx: index("orders_status_idx").on(table.status),
    createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
    clientIdIdx: index("orders_client_id_idx").on(table.clientId),
    tableIdIdx: index("orders_table_id_idx").on(table.tableId),
  })
);

// ============================================================================
// ORDER ITEMS
// ============================================================================

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: varchar("product_name", { length: 255 }),
    quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(), // supports weighed qty
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
    weightKg: decimal("weight_kg", { precision: 12, scale: 3 }),
    selectedExtras: json("selected_extras").$type<Array<{ id: string; name: string; price: number }>>().default([]),
    // Combo meal picks: [{ slotId, slotName, productId, productName, extraPrice, selectedExtras }]
    comboSelections: json("combo_selections")
      .$type<
        Array<{
          slotId: string;
          slotName: string;
          productId: string;
          productName: string;
          extraPrice: number;
          selectedExtras?: Array<{ id: string; name: string; price: number }>;
        }>
      >()
      .default([]),
    isOpenPrice: boolean("is_open_price").default(false).notNull(),
    // 1-based seat / person index when pax ordering is on (kitchen: "Person 1")
    seatNumber: integer("seat_number"),
  },
  (table) => ({
    orderIdIdx: index("order_items_order_id_idx").on(table.orderId),
  })
);

// ============================================================================
// FLOOR PLANS & DINING TABLES
// ============================================================================

export const floorPlans = pgTable(
  "floor_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    canvasWidth: integer("canvas_width").default(1000).notNull(),
    canvasHeight: integer("canvas_height").default(700).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("floor_plans_merchant_id_idx").on(table.merchantId),
  })
);

export const diningTables = pgTable(
  "dining_tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    floorPlanId: uuid("floor_plan_id")
      .notNull()
      .references(() => floorPlans.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 50 }).notNull(), // T1, Bar-2, …
    capacity: integer("capacity").default(2).notNull(), // max PAX
    shape: varchar("shape", { length: 20 }).default("rect").notNull(), // rect | round
    posX: integer("pos_x").default(40).notNull(),
    posY: integer("pos_y").default(40).notNull(),
    width: integer("width").default(100).notNull(),
    height: integer("height").default(80).notNull(),
    rotation: integer("rotation").default(0).notNull(),
    // available | occupied | reserved | dirty
    status: varchar("status", { length: 30 }).default("available").notNull(),
    currentOrderId: uuid("current_order_id"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("dining_tables_merchant_id_idx").on(table.merchantId),
    floorPlanIdIdx: index("dining_tables_floor_plan_id_idx").on(table.floorPlanId),
  })
);

// ============================================================================
// CHASLAY ANDROID FLOOR SYNC (waiter ↔ main POS coordination)
// ============================================================================

export const chaslayFloorDevices = pgTable(
  "chaslay_floor_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    deviceId: varchar("device_id", { length: 255 }).notNull(),
    deviceName: varchar("device_name", { length: 255 }),
    role: varchar("role", { length: 30 }).default("STANDARD").notNull(), // MAIN_POS | WAITER | STANDARD
    lanHost: varchar("lan_host", { length: 255 }),
    appVersion: varchar("app_version", { length: 50 }),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantDeviceIdx: uniqueIndex("chaslay_floor_devices_merchant_device_idx").on(
      table.merchantId,
      table.deviceId
    ),
  })
);

export const chaslayFloorTableOrders = pgTable(
  "chaslay_floor_table_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    localOrderId: varchar("local_order_id", { length: 255 }).notNull(),
    tableId: integer("table_id").default(0).notNull(),
    tableName: varchar("table_name", { length: 255 }).default("").notNull(),
    status: varchar("status", { length: 50 }).default("OPEN").notNull(),
    serviceType: varchar("service_type", { length: 50 }).default("DINE_IN").notNull(),
    userId: integer("user_id").default(0).notNull(),
    userName: varchar("user_name", { length: 255 }).default("").notNull(),
    cartJson: json("cart_json").$type<Record<string, unknown>>().default({}),
    sourceDeviceId: varchar("source_device_id", { length: 255 }).default("").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantLocalOrderIdx: uniqueIndex("chaslay_floor_orders_merchant_local_idx").on(
      table.merchantId,
      table.localOrderId
    ),
    merchantUpdatedIdx: index("chaslay_floor_orders_merchant_updated_idx").on(
      table.merchantId,
      table.updatedAt
    ),
  })
);

export const chaslayFloorPrintJobs = pgTable(
  "chaslay_floor_print_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    jobType: varchar("job_type", { length: 30 }).notNull(), // KITCHEN | RECEIPT
    status: varchar("status", { length: 30 }).default("PENDING").notNull(), // PENDING | PROCESSING | DONE | FAILED
    payload: json("payload").$type<Record<string, unknown>>().default({}),
    sourceDeviceId: varchar("source_device_id", { length: 255 }).default("").notNull(),
    targetRole: varchar("target_role", { length: 30 }).default("MAIN_POS").notNull(),
    orderId: varchar("order_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
  },
  (table) => ({
    merchantStatusIdx: index("chaslay_floor_print_jobs_merchant_status_idx").on(
      table.merchantId,
      table.status,
      table.createdAt
    ),
  })
);

// ============================================================================
// PAYMENT TERMINALS (ADYEN)
// ============================================================================

export const paymentTerminals = pgTable(
  "payment_terminals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    terminalId: varchar("terminal_id", { length: 255 }).notNull().unique(), // Adyen terminal ID
    terminalName: varchar("terminal_name", { length: 255 }).notNull(),
    serialNumber: varchar("serial_number", { length: 255 }),
    // Optional per-terminal Adyen overrides (falls back to merchant credentials)
    adyenMerchantAccount: varchar("adyen_merchant_account", { length: 255 }),
    adyenApiKey: text("adyen_api_key"),
    adyenClientId: varchar("adyen_client_id", { length: 255 }),
    status: varchar("status", { length: 50 }).default("active").notNull(), // active, inactive, error
    lastHeartbeat: timestamp("last_heartbeat"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("payment_terminals_merchant_id_idx").on(table.merchantId),
    terminalIdIdx: uniqueIndex("payment_terminals_terminal_id_idx").on(table.terminalId),
  })
);

// ============================================================================
// RFID CARD READERS (gift / loyalty)
// ============================================================================

export const rfidReaders = pgTable(
  "rfid_readers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    readerUid: varchar("reader_uid", { length: 255 }).notNull(), // hardware / HID identifier
    connectionType: varchar("connection_type", { length: 50 }).default("hid").notNull(), // hid | usb | ble
    status: varchar("status", { length: 50 }).default("active").notNull(),
    lastSeenAt: timestamp("last_seen_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("rfid_readers_merchant_id_idx").on(table.merchantId),
    readerUidIdx: uniqueIndex("rfid_readers_reader_uid_idx").on(table.readerUid),
  })
);

// ============================================================================
// DELIVERY ZONES (drawn polygons on map)
// ============================================================================

export type DeliveryPolygon = Array<[number, number]>; // [lng, lat] ring (closed or open)

export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    // GeoJSON-style ring: [[lng, lat], ...]
    polygon: json("polygon").$type<DeliveryPolygon>().notNull().default([]),
    // Optional ZIP fallback list
    zipCodes: json("zip_codes").$type<string[]>().default([]),
    minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }).default("0").notNull(),
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0").notNull(),
    estimatedMinutes: integer("estimated_minutes").default(45),
    color: varchar("color", { length: 20 }).default("#0d9488"),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("delivery_zones_merchant_id_idx").on(table.merchantId),
  })
);

// ============================================================================
// PAYMENT TRANSACTIONS
// ============================================================================

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    terminalId: uuid("terminal_id").references(() => paymentTerminals.id, { onDelete: "set null" }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // card, cash, terminal
    adyenReference: varchar("adyen_reference", { length: 255 }),
    status: varchar("status", { length: 50 }).notNull(), // pending, authorized, captured, failed, refunded
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    merchantIdIdx: index("payment_transactions_merchant_id_idx").on(table.merchantId),
    orderIdIdx: index("payment_transactions_order_id_idx").on(table.orderId),
    statusIdx: index("payment_transactions_status_idx").on(table.status),
  })
);

// ============================================================================
// LOYALTY CARDS (RFID)
// ============================================================================

export const loyaltyCards = pgTable(
  "loyalty_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    cardNumber: varchar("card_number", { length: 255 }).notNull().unique(), // RFID card ID
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    cardType: varchar("card_type", { length: 50 }).notNull(), // loyalty, gift_card
    balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
    pointsBalance: integer("points_balance").default(0),
    status: varchar("status", { length: 50 }).default("active").notNull(), // active, suspended, expired
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("loyalty_cards_merchant_id_idx").on(table.merchantId),
    cardNumberIdx: uniqueIndex("loyalty_cards_card_number_idx").on(table.cardNumber),
    statusIdx: index("loyalty_cards_status_idx").on(table.status),
  })
);

// ============================================================================
// LOYALTY TRANSACTIONS
// ============================================================================

export const loyaltyTransactions = pgTable(
  "loyalty_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => loyaltyCards.id, { onDelete: "cascade" }),
    transactionType: varchar("transaction_type", { length: 50 }).notNull(), // purchase, reload, redemption, points_earned
    amount: decimal("amount", { precision: 10, scale: 2 }),
    points: integer("points"),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("loyalty_transactions_merchant_id_idx").on(table.merchantId),
    cardIdIdx: index("loyalty_transactions_card_id_idx").on(table.cardId),
  })
);

// ============================================================================
// SHOP LOYALTY POINT LOTS (FIFO expiry for customer accounts)
// ============================================================================

export const loyaltyPointLots = pgTable(
  "loyalty_point_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    pointsGranted: integer("points_granted").notNull(),
    pointsRemaining: integer("points_remaining").notNull(),
    earnedAt: timestamp("earned_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    source: varchar("source", { length: 40 }).default("earn").notNull(), // earn | adjustment | bonus
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("loyalty_point_lots_customer_idx").on(table.customerId),
    merchantIdx: index("loyalty_point_lots_merchant_idx").on(table.merchantId),
    expiresIdx: index("loyalty_point_lots_expires_idx").on(table.expiresAt),
  })
);

export const loyaltyPointEvents = pgTable(
  "loyalty_point_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 40 }).notNull(), // earn | redeem_cash | redeem_product | expire | adjust
    points: integer("points").notNull(),
    meta: json("meta").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("loyalty_point_events_customer_idx").on(table.customerId),
    merchantIdx: index("loyalty_point_events_merchant_idx").on(table.merchantId),
  })
);

// ============================================================================
// DAILY REPORTS
// ============================================================================

export const dailyReports = pgTable(
  "daily_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    reportDate: varchar("report_date", { length: 10 }).notNull(), // YYYY-MM-DD
    totalOrders: integer("total_orders").default(0),
    totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0"),
    totalTax: decimal("total_tax", { precision: 10, scale: 2 }).default("0"),
    totalDiscount: decimal("total_discount", { precision: 10, scale: 2 }).default("0"),
    paymentBreakdown: json("payment_breakdown"), // {cash: 100, card: 200, terminal: 150}
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("daily_reports_merchant_id_idx").on(table.merchantId),
    reportDateIdx: index("daily_reports_report_date_idx").on(table.reportDate),
  })
);


// ============================================================================
// CMS PAGES (merchant website / homepage builder)
// ============================================================================

/** ChaiBuilder SDK block JSON (`_id`, `_type`, optional `_parent`, …) */
export type CmsBlock = {
  _id: string;
  _type: string;
  _parent?: string | null;
  [key: string]: unknown;
};

export type CmsTheme = Record<string, unknown>;

export const cmsPages = pgTable(
  "cms_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    isHomepage: boolean("is_homepage").notNull().default(false),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    templateKey: varchar("template_key", { length: 40 }),
    /** ChaiBuilder blocks array */
    blocks: json("blocks").$type<CmsBlock[]>().notNull().default([]),
    /** ChaiBuilder theme values */
    theme: json("theme").$type<CmsTheme | null>(),
    seoTitle: varchar("seo_title", { length: 200 }),
    seoDescription: text("seo_description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    merchantSlugUq: uniqueIndex("cms_pages_merchant_slug_uq").on(table.merchantId, table.slug),
    merchantHomepageIdx: index("cms_pages_merchant_homepage_idx").on(table.merchantId, table.isHomepage),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const cmsPagesRelations = relations(cmsPages, ({ one }) => ({
  merchant: one(merchants, {
    fields: [cmsPages.merchantId],
    references: [merchants.id],
  }),
}));

export const merchantsRelations = relations(merchants, ({ many }) => ({
  devices: many(devices),
  licenses: many(licenses),
  licenseTransactions: many(licenseTransactions),
  vatSettings: many(vatSettings),
  categories: many(categories),
  products: many(products),
  customers: many(customers),
  orders: many(orders),
  paymentTerminals: many(paymentTerminals),
  paymentTransactions: many(paymentTransactions),
  loyaltyCards: many(loyaltyCards),
  loyaltyTransactions: many(loyaltyTransactions),
  loyaltyPointLots: many(loyaltyPointLots),
  loyaltyPointEvents: many(loyaltyPointEvents),
  dailyReports: many(dailyReports),
  rfidReaders: many(rfidReaders),
  deliveryZones: many(deliveryZones),
  modifierGroups: many(modifierGroups),
  floorPlans: many(floorPlans),
  diningTables: many(diningTables),
  cmsPages: many(cmsPages),
}));

export const floorPlansRelations = relations(floorPlans, ({ one, many }) => ({
  merchant: one(merchants, { fields: [floorPlans.merchantId], references: [merchants.id] }),
  tables: many(diningTables),
}));

export const diningTablesRelations = relations(diningTables, ({ one }) => ({
  merchant: one(merchants, { fields: [diningTables.merchantId], references: [merchants.id] }),
  floorPlan: one(floorPlans, { fields: [diningTables.floorPlanId], references: [floorPlans.id] }),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  merchant: one(merchants, { fields: [devices.merchantId], references: [merchants.id] }),
  licenses: many(licenses),
}));

export const licensesRelations = relations(licenses, ({ one }) => ({
  merchant: one(merchants, { fields: [licenses.merchantId], references: [merchants.id] }),
  device: one(devices, { fields: [licenses.deviceId], references: [devices.id] }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  merchant: one(merchants, { fields: [products.merchantId], references: [merchants.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  orderItems: many(orderItems),
  modifierLinks: many(productModifierGroups),
}));

export const modifierGroupsRelations = relations(modifierGroups, ({ one, many }) => ({
  merchant: one(merchants, { fields: [modifierGroups.merchantId], references: [merchants.id] }),
  options: many(modifierOptions),
  productLinks: many(productModifierGroups),
}));

export const modifierOptionsRelations = relations(modifierOptions, ({ one }) => ({
  group: one(modifierGroups, { fields: [modifierOptions.groupId], references: [modifierGroups.id] }),
}));

export const productModifierGroupsRelations = relations(productModifierGroups, ({ one }) => ({
  product: one(products, { fields: [productModifierGroups.productId], references: [products.id] }),
  group: one(modifierGroups, { fields: [productModifierGroups.groupId], references: [modifierGroups.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  merchant: one(merchants, { fields: [orders.merchantId], references: [merchants.id] }),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  items: many(orderItems),
  paymentTransactions: many(paymentTransactions),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const loyaltyCardsRelations = relations(loyaltyCards, ({ one, many }) => ({
  merchant: one(merchants, { fields: [loyaltyCards.merchantId], references: [merchants.id] }),
  customer: one(customers, { fields: [loyaltyCards.customerId], references: [customers.id] }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyPointLotsRelations = relations(loyaltyPointLots, ({ one }) => ({
  merchant: one(merchants, { fields: [loyaltyPointLots.merchantId], references: [merchants.id] }),
  customer: one(customers, { fields: [loyaltyPointLots.customerId], references: [customers.id] }),
  order: one(orders, { fields: [loyaltyPointLots.orderId], references: [orders.id] }),
}));

export const loyaltyPointEventsRelations = relations(loyaltyPointEvents, ({ one }) => ({
  merchant: one(merchants, { fields: [loyaltyPointEvents.merchantId], references: [merchants.id] }),
  customer: one(customers, { fields: [loyaltyPointEvents.customerId], references: [customers.id] }),
  order: one(orders, { fields: [loyaltyPointEvents.orderId], references: [orders.id] }),
  product: one(products, { fields: [loyaltyPointEvents.productId], references: [products.id] }),
}));

export const rfidReadersRelations = relations(rfidReaders, ({ one }) => ({
  merchant: one(merchants, { fields: [rfidReaders.merchantId], references: [merchants.id] }),
}));

export const deliveryZonesRelations = relations(deliveryZones, ({ one }) => ({
  merchant: one(merchants, { fields: [deliveryZones.merchantId], references: [merchants.id] }),
}));

export const paymentTerminalsRelations = relations(paymentTerminals, ({ one }) => ({
  merchant: one(merchants, { fields: [paymentTerminals.merchantId], references: [merchants.id] }),
}));
