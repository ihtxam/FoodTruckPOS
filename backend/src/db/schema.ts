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
import type { PosPrintSettings } from "../lib/pos-print-settings";

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
    /** When true, menu prices are gross (TVA included); when false, tax is added on top at checkout. */
    taxIncludedInPrice: boolean("tax_included_in_price").default(false).notNull(),
    // Online shop: path slug + optional DNS subdomain (e.g. demo → demo.domain)
    slug: varchar("slug", { length: 100 }),
    subdomain: varchar("subdomain", { length: 63 }),
    /** Custom apex/domain for CMS website (e.g. cafe.ch) — DNS CNAME to platform */
    customDomain: varchar("custom_domain", { length: 255 }),
    shopEnabled: boolean("shop_enabled").default(false).notNull(),
    /**
     * Soft close for online ordering (shop stays browsable).
     * When false, visitors see “not accepting orders… please call us”.
     */
    acceptingOrders: boolean("accepting_orders").default(true).notNull(),
    /**
     * Soft close for online reservations (module can stay enabled).
     * When false, visitors see “not accepting reservations… please call us”.
     */
    acceptingReservations: boolean("accepting_reservations").default(true).notNull(),
    /** When true, shop root serves published CMS homepage instead of menu */
    cmsHomepageEnabled: boolean("cms_homepage_enabled").default(false).notNull(),
    // Online ordering channels
    pickupEnabled: boolean("pickup_enabled").default(true).notNull(),
    dineInEnabled: boolean("dine_in_enabled").default(true).notNull(),
    deliveryEnabled: boolean("delivery_enabled").default(true).notNull(),
    /**
     * Where customers choose pickup / delivery / dine-in:
     * checkout | popup_start | menu
     */
    channelSelectMode: varchar("channel_select_mode", { length: 20 }).default("checkout").notNull(),
    /** Show product photos on the public menu */
    menuShowProductImages: boolean("menu_show_product_images").default(true).notNull(),
    /** Show category banner images on the public menu */
    menuShowCategoryBanners: boolean("menu_show_category_banners").default(true).notNull(),
    /**
     * Allow customers to schedule / program orders for later.
     * When false, orders can only be placed during opening hours (ASAP only).
     */
    scheduledOrdersEnabled: boolean("scheduled_orders_enabled").default(true).notNull(),
    // Per-channel weekly hours (+ optional display for homepage banner):
    // { takeaway: { mon: [{ open, close }] }, delivery, dine_in, display }
    storeHours: json("store_hours").$type<Record<string, Record<string, Array<{ open: string; close: string }>>>>().default({}),
    shopLogoUrl: varchar("shop_logo_url", { length: 500 }),
    shopBannerUrl: varchar("shop_banner_url", { length: 500 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    pickupEtaMinutes: integer("pickup_eta_minutes").default(25),
    deliveryEtaMinutes: integer("delivery_eta_minutes").default(45),
    /**
     * Fixed CHF amount added to each menu item base price for delivery orders
     * (e.g. 2 → delivery item prices = takeaway + 2.00).
     */
    deliveryMenuMarkup: decimal("delivery_menu_markup", { precision: 10, scale: 2 }).default("0"),
    // Adyen credentials (merchant-level; shared by online shop + payment terminals)
    adyenMerchantAccount: varchar("adyen_merchant_account", { length: 255 }),
    adyenApiKey: text("adyen_api_key"),
    adyenClientId: varchar("adyen_client_id", { length: 255 }),
    /** Adyen Terminal API: test vs live environment */
    adyenLiveEnvironment: boolean("adyen_live_environment").default(false).notNull(),
    /** Adyen cloud device region: EU | US | AU | APSE */
    adyenLiveRegion: varchar("adyen_live_region", { length: 10 }).default("EU").notNull(),
    /** Use legacy Terminal API sync URL instead of Cloud Device API */
    adyenUseLegacyEndpoint: boolean("adyen_use_legacy_endpoint").default(false).notNull(),
    /** WebPOS payment method toggles (merchant panel counter sales) */
    webposExpressEnabled: boolean("webpos_express_enabled").default(true).notNull(),
    webposCashEnabled: boolean("webpos_cash_enabled").default(true).notNull(),
    webposCardEnabled: boolean("webpos_card_enabled").default(true).notNull(),
    webposTerminalEnabled: boolean("webpos_terminal_enabled").default(true).notNull(),
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
    /** Default language for online shop + CMS homepage (null = fall back to panelLanguage) */
    shopLanguage: varchar("shop_language", { length: 10 }), // en | fr | de
    /** Chaslay/FoodTruck Android POS sync key (X-Api-Key header) */
    syncApiKey: varchar("sync_api_key", { length: 64 }),
    // Restaurant floor / PAX
    floorPlanEnabled: boolean("floor_plan_enabled").default(false).notNull(),
    // When true: order & bill per person (Person 1…) at a table; kitchen tickets split by seat
    paxOrderingEnabled: boolean("pax_ordering_enabled").default(false).notNull(),
    /**
     * Dine-in course firing (starter/main/…). Off by default — many venues only need
     * send-to-kitchen / kitchen message without multi-course workflow.
     */
    coursesEnabled: boolean("courses_enabled").default(false).notNull(),
    /** Online / phone restaurant table reservations */
    reservationsEnabled: boolean("reservations_enabled").default(false).notNull(),
    /**
     * Reservation module settings:
     * {
     *   dineInHoursMode: 'same_as_takeaway' | 'custom',
     *   slotIntervalMinutes, seatingDurationMinutes, bufferMinutes,
     *   minPartySize, maxPartySize, minHoursBefore, maxDaysAhead,
     *   autoAccept, sendConfirmationEmail, sendStatusEmails,
     *   maxCoversPerSlot, policiesText
     * }
     */
    reservationSettings: json("reservation_settings").$type<ReservationSettings | null>(),
    /**
     * Holiday / vacation mode (programmable in advance):
     * {
     *   manualActive?: boolean,
     *   popupImageUrl?: string | null,
     *   message?: string | null,
     *   periods?: Array<{ id, startDate, endDate, title? }>  // YYYY-MM-DD inclusive (Europe/Zurich)
     * }
     */
    vacationSettings: json("vacation_settings").$type<VacationSettings | null>(),
    /**
     * Merchant SMTP for newsletters / marketing (optional; falls back to platform Brevo).
     * { enabled, host, port, secure, user, password, fromEmail, fromName }
     */
    emailSmtpSettings: json("email_smtp_settings").$type<MerchantSmtpSettings | null>(),
    /**
     * Marketing automation:
     * { reorderReminderEnabled, reorderReminderDays, reorderReminderSubject, reorderReminderBody }
     */
    marketingSettings: json("marketing_settings").$type<MarketingSettings | null>(),
    /**
     * POS / WebPOS receipt + kitchen + printer profiles:
     * { receiptHeader, receiptFooter, kitchenTicketHeader/Footer, paperWidthMm,
     *   receiptLanguage, receiptShowVatTable/StaffLine/QrCode, receiptLogoUrl,
     *   autoPrintReceipt, autoPrintKitchen, printers: PosPrinterProfile[] }
     */
    posPrintSettings: json("pos_print_settings").$type<PosPrintSettings | null>(),
    /**
     * Shared WebPOS / Android checkout behaviour:
     * tips, discount presets, rounding, quick-cash denominations, split bills.
     */
    posCheckoutSettings: json("pos_checkout_settings").$type<Record<string, unknown> | null>(),
    status: varchar("status", { length: 50 }).default("active").notNull(), // active, suspended, trial, expired
    subscriptionPlan: varchar("subscription_plan", { length: 50 }).default("free"), // free, starter, professional, enterprise
    trialEndsAt: timestamp("trial_ends_at"),
    subscriptionEndsAt: timestamp("subscription_ends_at"),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    /** Set when merchant chooses a password (invite accepted or admin set one) */
    passwordSetAt: timestamp("password_set_at"),
    /** SHA-256 of one-time invite / password-setup token */
    inviteTokenHash: varchar("invite_token_hash", { length: 64 }),
    inviteTokenExpiresAt: timestamp("invite_token_expires_at"),
    inviteSentAt: timestamp("invite_sent_at"),
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
    inviteTokenIdx: index("merchants_invite_token_hash_idx").on(table.inviteTokenHash),
  })
);

// ============================================================================
// MERCHANT STAFF & ROLES (panel + POS / WebPOS)
// ============================================================================

export const merchantRoles = pgTable(
  "merchant_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    /** Comma-separated permission keys (see backend/src/lib/permissions.ts) */
    permissions: text("permissions").notNull().default(""),
    isSystem: boolean("is_system").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantNameIdx: uniqueIndex("merchant_roles_merchant_name_idx").on(table.merchantId, table.name),
    merchantIdIdx: index("merchant_roles_merchant_id_idx").on(table.merchantId),
  })
);

export const merchantStaff = pgTable(
  "merchant_staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => merchantRoles.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    pinHash: varchar("pin_hash", { length: 255 }),
    passwordHash: varchar("password_hash", { length: 255 }),
    /** Can sign in to merchant backend panel (email + password) */
    canAccessPanel: boolean("can_access_panel").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("merchant_staff_merchant_id_idx").on(table.merchantId),
    merchantEmailIdx: uniqueIndex("merchant_staff_merchant_email_idx").on(table.merchantId, table.email),
  })
);

// ============================================================================
// SUBSCRIPTION PLANS (platform SaaS tiers)
// ============================================================================

export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 50 }).notNull().unique(),
    description: text("description"),
    priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).notNull().default("0"),
    priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }),
    currency: varchar("currency", { length: 3 }).notNull().default("CHF"),
    maxDevices: integer("max_devices").notNull().default(1),
    maxProducts: integer("max_products"),
    features: json("features").$type<string[]>().default([]),
    isActive: boolean("is_active").notNull().default(true),
    /** Visible for merchants to purchase in their panel */
    isPublic: boolean("is_public").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    trialDays: integer("trial_days").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("subscription_plans_slug_idx").on(table.slug),
    activeIdx: index("subscription_plans_active_idx").on(table.isActive),
  })
);

/** Platform-wide key/value settings (e.g. platform Adyen credentials) */
export const platformSettings = pgTable("platform_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Merchant subscription purchases paid to the platform Adyen account */
export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: "restrict" }),
    billingCycle: varchar("billing_cycle", { length: 20 }).notNull(), // monthly | yearly
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("CHF"),
    status: varchar("status", { length: 30 }).notNull().default("pending"), // pending | paid | failed | cancelled
    adyenSessionId: varchar("adyen_session_id", { length: 255 }),
    adyenPspReference: varchar("adyen_psp_reference", { length: 255 }),
    adyenResultCode: varchar("adyen_result_code", { length: 50 }),
    paidAt: timestamp("paid_at"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("subscription_payments_merchant_id_idx").on(table.merchantId),
    planIdIdx: index("subscription_payments_plan_id_idx").on(table.planId),
    statusIdx: index("subscription_payments_status_idx").on(table.status),
    sessionIdx: index("subscription_payments_session_idx").on(table.adyenSessionId),
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
    imageUrl: varchar("image_url", { length: 500 }),
    /** Special shelf for promotional / offer products */
    isOffersCategory: boolean("is_offers_category").default(false).notNull(),
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
    /** Opt-in for newsletters / marketing (default true when email known from orders) */
    marketingOptIn: boolean("marketing_opt_in").default(true).notNull(),
    /** Denormalized last paid/completed web or POS order time */
    lastOrderAt: timestamp("last_order_at"),
    /** Last automatic reorder-reminder email sent */
    lastReorderReminderAt: timestamp("last_reorder_reminder_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("customers_merchant_id_idx").on(table.merchantId),
    emailIdx: index("customers_email_idx").on(table.email),
    lastOrderIdx: index("customers_last_order_idx").on(table.merchantId, table.lastOrderAt),
  })
);

/** Saved delivery addresses for logged-in shop customers (Home, Office, …). */
export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    /** home | office | other | free-text label */
    label: varchar("label", { length: 40 }).notNull().default("home"),
    address: text("address").notNull(),
    zipCode: varchar("zip_code", { length: 20 }),
    city: varchar("city", { length: 100 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("customer_addresses_customer_idx").on(table.customerId),
    merchantCustomerIdx: index("customer_addresses_merchant_customer_idx").on(
      table.merchantId,
      table.customerId
    ),
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
    /** Cash rounding adjustment applied at checkout (can be negative) */
    roundingAmount: decimal("rounding_amount", { precision: 10, scale: 2 }).default("0"),
    amountTendered: decimal("amount_tendered", { precision: 10, scale: 2 }),
    changeDue: decimal("change_due", { precision: 10, scale: 2 }),
    /** Staff who completed the POS / WebPOS sale */
    staffName: varchar("staff_name", { length: 255 }),
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
    /** Links split-bill sibling orders (Android masterOrderId / WebPOS split checkout) */
    masterOrderId: varchar("master_order_id", { length: 64 }),
    /** 1-based split check number within a masterOrderId group */
    splitCheckNumber: integer("split_check_number"),
    clientId: varchar("client_id", { length: 64 }), // offline POS transaction id
    deviceId: varchar("device_id", { length: 255 }),
    syncedAt: timestamp("synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    cancelReason: text("cancel_reason"),
    cancelledAt: timestamp("cancelled_at"),
    refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }).default("0"),
    refundedAt: timestamp("refunded_at"),
  },
  (table) => ({
    merchantIdIdx: index("orders_merchant_id_idx").on(table.merchantId),
    orderNumberIdx: uniqueIndex("orders_order_number_idx").on(table.orderNumber),
    statusIdx: index("orders_status_idx").on(table.status),
    createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
    clientIdIdx: index("orders_client_id_idx").on(table.clientId),
    tableIdIdx: index("orders_table_id_idx").on(table.tableId),
    masterOrderIdIdx: index("orders_master_order_id_idx").on(table.masterOrderId),
  })
);

// ============================================================================
// WEBPOS / POS HELD ORDERS (on-hold carts)
// ============================================================================

export const heldOrders = pgTable(
  "held_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 120 }),
    status: varchar("status", { length: 40 }).default("held").notNull(), // held | sent_to_kitchen
    channel: varchar("channel", { length: 50 }).default("takeaway"),
    cartJson: json("cart_json").$type<unknown>().notNull(),
    notes: text("notes"),
    staffId: uuid("staff_id"),
    staffName: varchar("staff_name", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("held_orders_merchant_id_idx").on(table.merchantId),
    statusIdx: index("held_orders_status_idx").on(table.merchantId, table.status),
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
// RESTAURANT RESERVATIONS
// ============================================================================

export type ReservationSettings = {
  /** Use takeaway weekly hours for booking slots, or custom dine_in hours */
  dineInHoursMode?: "same_as_takeaway" | "custom";
  /** Minutes between bookable start times (15 / 30 / 60) */
  slotIntervalMinutes?: number;
  /** Expected seating length used for overlap / capacity */
  seatingDurationMinutes?: number;
  /** Extra gap after a reservation before the next can start on shared capacity */
  bufferMinutes?: number;
  minPartySize?: number;
  maxPartySize?: number;
  /** Guest must book at least this many hours before the slot */
  minHoursBefore?: number;
  /** How far ahead guests can book (days) */
  maxDaysAhead?: number;
  /** If true, new web bookings become confirmed immediately */
  autoAccept?: boolean;
  sendConfirmationEmail?: boolean;
  sendStatusEmails?: boolean;
  /** Soft capacity per slot (covers). Null/0 = sum of table seats or unlimited */
  maxCoversPerSlot?: number | null;
  policiesText?: string | null;
  /** Email reminder before the reservation (hours ahead) */
  reminderEnabled?: boolean;
  reminderHoursBefore?: number;
  sendReminderEmail?: boolean;
  /**
   * Off-peak / happy-hour discounts shown on bookable slots.
   * scheduleMode: specific_days = only daysOfWeek; whole_week = every day.
   * Empty timeStart/timeEnd = all open hours that day.
   */
  slotDiscounts?: Array<{
    id: string;
    name: string;
    percentOff: number;
    scheduleMode?: "specific_days" | "whole_week";
    daysOfWeek?: string[]; // mon..sun
    timeStart?: string | null; // HH:mm
    timeEnd?: string | null;
    enabled?: boolean;
  }>;
  /** Email merchant account on new / updated reservations (default true) */
  notifyAdminEmail?: boolean;
  /** Daily 10:00 Europe/Zurich summary of today's bookings (default true) */
  dailySummaryEnabled?: boolean;
  /** Last YYYY-MM-DD (Zurich) a daily summary was sent */
  lastDailySummaryDate?: string | null;
};

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "rejected"
  | "no_show";

/** Programmable holiday / vacation closure for the online shop */
export type LocalizedText = {
  en?: string | null;
  fr?: string | null;
  de?: string | null;
};

export type VacationPeriod = {
  id: string;
  /** Inclusive start date YYYY-MM-DD (Europe/Zurich calendar) */
  startDate: string;
  /** Start time HH:mm (Europe/Zurich), default 00:00 */
  startTime?: string | null;
  /** Inclusive end date YYYY-MM-DD */
  endDate: string;
  /** End time HH:mm (Europe/Zurich), default 23:59 */
  endTime?: string | null;
  /** Period label — deprecated, ignored in UI (title & message on settings are enough) */
  title?: LocalizedText | string | null;
};

export type VacationSettings = {
  /**
   * Master switch. When false, scheduled periods do not activate vacation mode.
   * Legacy `manualActive` is treated as enabled when `enabled` is absent.
   */
  enabled?: boolean;
  /** @deprecated Prefer `enabled` — kept for older saved settings */
  manualActive?: boolean;
  /** Popup image shown on homepage & shop while on vacation */
  popupImageUrl?: string | null;
  /** Editable popup title — multilingual */
  popupTitle?: LocalizedText | string | null;
  /** Optional visitor-facing message — multilingual */
  message?: LocalizedText | string | null;
  periods?: VacationPeriod[];
};

export type MerchantSmtpSettings = {
  enabled?: boolean;
  host?: string | null;
  port?: number | null;
  secure?: boolean;
  user?: string | null;
  /** Stored as plain text for SMTP AUTH — protect DB access */
  password?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
};

export type MarketingSettings = {
  reorderReminderEnabled?: boolean;
  /** Days after last order before sending reminder (default 5) */
  reorderReminderDays?: number;
  reorderReminderSubject?: string | null;
  /** Plain text / simple HTML body. Placeholders: {{name}} {{shopUrl}} {{businessName}} */
  reorderReminderBody?: string | null;
};

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    guestName: varchar("guest_name", { length: 200 }).notNull(),
    guestEmail: varchar("guest_email", { length: 255 }),
    guestPhone: varchar("guest_phone", { length: 50 }).notNull(),
    partySize: integer("party_size").notNull().default(2),
    reservedAt: timestamp("reserved_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(90),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    tableId: uuid("table_id").references(() => diningTables.id, { onDelete: "set null" }),
    tableLabel: varchar("table_label", { length: 50 }),
    /** Slot promotion captured at booking time (e.g. 20) */
    discountPercent: integer("discount_percent"),
    discountLabel: varchar("discount_label", { length: 80 }),
    notes: text("notes"),
    internalNotes: text("internal_notes"),
    source: varchar("source", { length: 30 }).notNull().default("web"), // web | phone | pos | dashboard
    confirmationSentAt: timestamp("confirmation_sent_at", { withTimezone: true }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    seatedAt: timestamp("seated_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    merchantReservedIdx: index("reservations_merchant_reserved_idx").on(
      table.merchantId,
      table.reservedAt
    ),
    merchantStatusIdx: index("reservations_merchant_status_idx").on(table.merchantId, table.status),
    merchantCodeUq: uniqueIndex("reservations_merchant_code_uq").on(table.merchantId, table.code),
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
// OFFERS / PROMOTIONS (online shop + dine-in)
// ============================================================================

export type OfferType =
  | "percent_category"
  | "percent_order"
  | "fixed_off"
  | "bogo"
  | "pay_n_get_m"
  | "combo_deal"
  | "package_deal";

export type OfferRules = {
  percentOff?: number;
  fixedOff?: number;
  buyQty?: number;
  getQty?: number;
  getDiscountPercent?: number;
  payQty?: number;
  receiveQty?: number;
  minOrderAmount?: number;
  /** @deprecated use package_deal buy/get lists */
  comboProductIds?: string[];
  comboPercentOff?: number;
  comboFixedOff?: number;
  /**
   * Package deal: choose `buyQty` from `buyProductIds`, get `getQty` from
   * `getProductIds` free (or included), for a single `packagePrice`.
   */
  buyProductIds?: string[];
  getProductIds?: string[];
  packagePrice?: number;
};

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    offerType: varchar("offer_type", { length: 40 }).notNull(),
    rules: json("rules").$type<OfferRules>().default({}).notNull(),
    channels: json("channels").$type<string[]>().default([]).notNull(),
    categoryIds: json("category_ids").$type<string[]>().default([]).notNull(),
    productIds: json("product_ids").$type<string[]>().default([]).notNull(),
    scheduleMode: varchar("schedule_mode", { length: 20 }).default("always").notNull(),
    daysOfWeek: json("days_of_week").$type<string[]>().default([]).notNull(),
    timeStart: varchar("time_start", { length: 5 }),
    timeEnd: varchar("time_end", { length: 5 }),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    featured: boolean("featured").default(true).notNull(),
    badgeLabel: varchar("badge_label", { length: 40 }),
    priority: integer("priority").default(0).notNull(),
    stackable: boolean("stackable").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("offers_merchant_id_idx").on(table.merchantId),
    activeIdx: index("offers_merchant_active_idx").on(table.merchantId, table.isActive),
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

/** Puck editor page data (`content` + `root`) */
export type CmsPuckItem = {
  type: string;
  props: Record<string, unknown>;
};

export type CmsPuckData = {
  content: CmsPuckItem[];
  root: { props?: Record<string, unknown> };
  zones?: Record<string, CmsPuckItem[]>;
};

/** @deprecated legacy ChaiBuilder block — migrated on read */
export type CmsBlock = {
  _id?: string;
  _type?: string;
  type?: string;
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
    /** Puck Data JSON (`{ content, root }`) — legacy Chai arrays are migrated in the service */
    blocks: json("blocks").$type<CmsPuckData | CmsBlock[]>().notNull().default({ content: [], root: {} }),
    /** Optional theme / metadata */
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
  reservations: many(reservations),
  subscriptionPayments: many(subscriptionPayments),
  cmsPages: many(cmsPages),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  merchant: one(merchants, { fields: [reservations.merchantId], references: [merchants.id] }),
  customer: one(customers, { fields: [reservations.customerId], references: [customers.id] }),
  table: one(diningTables, { fields: [reservations.tableId], references: [diningTables.id] }),
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

export const heldOrdersRelations = relations(heldOrders, ({ one }) => ({
  merchant: one(merchants, { fields: [heldOrders.merchantId], references: [merchants.id] }),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  customer: one(customers, {
    fields: [customerAddresses.customerId],
    references: [customers.id],
  }),
  merchant: one(merchants, {
    fields: [customerAddresses.merchantId],
    references: [merchants.id],
  }),
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

/** Newsletter / marketing campaigns designed and sent by merchants */
export const newsletterCampaigns = pgTable(
  "newsletter_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull().default("Newsletter"),
    subject: varchar("subject", { length: 300 }).notNull(),
    bodyHtml: text("body_html").notNull().default(""),
    status: varchar("status", { length: 30 }).notNull().default("draft"), // draft | sending | sent | failed
    audience: varchar("audience", { length: 30 }).notNull().default("all"), // all | selected
    recipientCount: integer("recipient_count").default(0),
    sentCount: integer("sent_count").default(0),
    failedCount: integer("failed_count").default(0),
    selectedEmails: json("selected_emails").$type<string[] | null>(),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("newsletter_campaigns_merchant_idx").on(table.merchantId),
    statusIdx: index("newsletter_campaigns_status_idx").on(table.merchantId, table.status),
  })
);

/** Log of marketing emails (newsletter + reorder reminders) */
export const marketingEmailLog = pgTable(
  "marketing_email_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => newsletterCampaigns.id, {
      onDelete: "set null",
    }),
    email: varchar("email", { length: 255 }).notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    type: varchar("type", { length: 40 }).notNull(), // newsletter | reorder_reminder
    status: varchar("status", { length: 30 }).notNull().default("sent"), // sent | failed
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("marketing_email_log_merchant_idx").on(table.merchantId),
    emailIdx: index("marketing_email_log_email_idx").on(table.merchantId, table.email),
    typeIdx: index("marketing_email_log_type_idx").on(table.merchantId, table.type),
  })
);

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  payments: many(subscriptionPayments),
}));

export const subscriptionPaymentsRelations = relations(subscriptionPayments, ({ one }) => ({
  merchant: one(merchants, {
    fields: [subscriptionPayments.merchantId],
    references: [merchants.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [subscriptionPayments.planId],
    references: [subscriptionPlans.id],
  }),
}));
