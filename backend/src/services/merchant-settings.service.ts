import { getDb, schema } from "@/db";
import type { VacationSettings, MerchantSmtpSettings, MarketingSettings } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { normalizeCustomDomain } from "@/services/cms.service";
import { normalizeVacationSettings } from "@/lib/vacation";
import { MarketingService } from "@/services/marketing.service";
import {
  normalizePosPrintSettings,
  type PosPrintSettings,
} from "@/lib/pos-print-settings";

function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function normalizeSubdomain(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!cleaned || cleaned.length < 2) return null;
  return cleaned.slice(0, 63);
}

function slugFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || `shop-${Date.now().toString(36)}`
  );
}

export type FulfillmentChannel = "takeaway" | "dine_in" | "delivery";
export type ChannelSelectMode = "checkout" | "popup_start" | "menu";

function normalizeChannelSelectMode(raw?: string | null): ChannelSelectMode {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "popup_start" || v === "menu" || v === "checkout") return v;
  return "checkout";
}

export class MerchantSettingsService {
  static async getMerchantSettings(merchantId: string) {
    const db = getDb();

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });

    if (!merchant) {
      throw new Error("Merchant not found");
    }

    const domain = process.env.DOMAIN || process.env.PUBLIC_APP_URL?.replace(/^https?:\/\//, "") || "localhost";
    const shopHost =
      process.env.SHOP_PUBLIC_HOST ||
      (domain.includes("chaslay.com") ? "shop.chaslay.com" : domain.startsWith("shop.") ? domain : `shop.${domain}`);
    const apex = domain.replace(/^shop\./, "");

    return {
      id: merchant.id,
      name: merchant.name,
      email: merchant.email,
      phone: merchant.phone,
      businessLicense: merchant.businessLicense,
      address: merchant.address,
      city: merchant.city,
      country: merchant.country,
      vatNumber: merchant.vatNumber,
      vatRate: merchant.vatRate,
      taxTakeawayRate: merchant.taxTakeawayRate,
      taxDineInRate: merchant.taxDineInRate,
      taxDeliveryRate: merchant.taxDeliveryRate,
      slug: merchant.slug,
      subdomain: merchant.subdomain,
      customDomain: merchant.customDomain,
      cmsHomepageEnabled: !!merchant.cmsHomepageEnabled,
      shopEnabled: merchant.shopEnabled,
      acceptingOrders: merchant.acceptingOrders !== false,
      acceptingReservations: merchant.acceptingReservations !== false,
      reservationsEnabled: !!merchant.reservationsEnabled,
      pickupEnabled: merchant.pickupEnabled,
      dineInEnabled: merchant.dineInEnabled,
      deliveryEnabled: merchant.deliveryEnabled,
      channelSelectMode: normalizeChannelSelectMode(merchant.channelSelectMode),
      menuShowProductImages: merchant.menuShowProductImages !== false,
      menuShowCategoryBanners: merchant.menuShowCategoryBanners !== false,
      scheduledOrdersEnabled: merchant.scheduledOrdersEnabled !== false,
      floorPlanEnabled: merchant.floorPlanEnabled,
      paxOrderingEnabled: merchant.paxOrderingEnabled,
      coursesEnabled: !!merchant.coursesEnabled,
      storeHours: merchant.storeHours || {},
      shopLogoUrl: merchant.shopLogoUrl,
      shopBannerUrl: merchant.shopBannerUrl,
      latitude: merchant.latitude,
      longitude: merchant.longitude,
      pickupEtaMinutes: merchant.pickupEtaMinutes,
      deliveryEtaMinutes: merchant.deliveryEtaMinutes,
      deliveryMenuMarkup: merchant.deliveryMenuMarkup ?? "0",
      vacationSettings: normalizeVacationSettings(merchant.vacationSettings),
      emailSmtpSettings: MarketingService.getSmtpPublic(merchant.emailSmtpSettings),
      marketingSettings: MarketingService.normalizeMarketing(merchant.marketingSettings),
      shopPathUrl: merchant.slug ? `https://${shopHost}/${merchant.slug}` : null,
      shopSubdomainUrl: merchant.subdomain ? `https://${merchant.subdomain}.${apex}` : null,
      shopCustomDomainUrl: merchant.customDomain ? `https://${merchant.customDomain}` : null,
      adyenMerchantAccount: merchant.adyenMerchantAccount,
      adyenApiKeyMasked: maskSecret(merchant.adyenApiKey),
      adyenApiKeySet: !!merchant.adyenApiKey,
      adyenClientId: merchant.adyenClientId,
      adyenLiveEnvironment: !!merchant.adyenLiveEnvironment,
      adyenLiveRegion: merchant.adyenLiveRegion || "EU",
      adyenUseLegacyEndpoint: !!merchant.adyenUseLegacyEndpoint,
      webposExpressEnabled: merchant.webposExpressEnabled !== false,
      webposCashEnabled: merchant.webposCashEnabled !== false,
      webposCardEnabled: merchant.webposCardEnabled !== false,
      webposTerminalEnabled: merchant.webposTerminalEnabled !== false,
      onlineCardFeeFixed: merchant.onlineCardFeeFixed ?? "0",
      onlineCardFeePercent: merchant.onlineCardFeePercent ?? "0",
      panelLanguage: merchant.panelLanguage || "en",
      shopLanguage: merchant.shopLanguage || merchant.panelLanguage || "en",
      posPrintSettings: normalizePosPrintSettings(merchant.posPrintSettings),
      status: merchant.status,
      subscriptionPlan: merchant.subscriptionPlan,
    };
  }

  static async updateMerchantSettings(
    merchantId: string,
    updates: {
      name?: string;
      phone?: string;
      address?: string;
      city?: string;
      country?: string;
      businessLicense?: string;
      vatNumber?: string;
      vatRate?: number;
      taxTakeawayRate?: number;
      taxDineInRate?: number;
      taxDeliveryRate?: number;
      slug?: string;
      subdomain?: string;
      customDomain?: string | null;
      cmsHomepageEnabled?: boolean;
      shopEnabled?: boolean;
      acceptingOrders?: boolean;
      acceptingReservations?: boolean;
      pickupEnabled?: boolean;
      dineInEnabled?: boolean;
      deliveryEnabled?: boolean;
      channelSelectMode?: ChannelSelectMode | string;
      menuShowProductImages?: boolean;
      menuShowCategoryBanners?: boolean;
      scheduledOrdersEnabled?: boolean;
      floorPlanEnabled?: boolean;
      paxOrderingEnabled?: boolean;
      coursesEnabled?: boolean;
      storeHours?: Record<string, unknown>;
      shopLogoUrl?: string | null;
      shopBannerUrl?: string | null;
      latitude?: number | string | null;
      longitude?: number | string | null;
      pickupEtaMinutes?: number;
      deliveryEtaMinutes?: number;
      deliveryMenuMarkup?: number;
      vacationSettings?: VacationSettings | null;
      emailSmtpSettings?: MerchantSmtpSettings | null;
      marketingSettings?: MarketingSettings | null;
      adyenMerchantAccount?: string;
      adyenApiKey?: string;
      adyenClientId?: string;
      adyenLiveEnvironment?: boolean;
      adyenLiveRegion?: string;
      adyenUseLegacyEndpoint?: boolean;
      webposExpressEnabled?: boolean;
      webposCashEnabled?: boolean;
      webposCardEnabled?: boolean;
      webposTerminalEnabled?: boolean;
      onlineCardFeeFixed?: number;
      onlineCardFeePercent?: number;
      panelLanguage?: string;
      shopLanguage?: string;
      posPrintSettings?: PosPrintSettings | null;
    }
  ) {
    const db = getDb();

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (updates.name !== undefined) {
      const name = String(updates.name || "").trim().slice(0, 255);
      if (!name) throw new Error("Business name is required");
      patch.name = name;
    }
    if (updates.phone !== undefined) patch.phone = updates.phone;
    if (updates.address !== undefined) patch.address = updates.address;
    if (updates.city !== undefined) patch.city = updates.city;
    if (updates.country !== undefined) patch.country = updates.country;
    if (updates.businessLicense !== undefined) patch.businessLicense = updates.businessLicense;
    if (updates.vatNumber !== undefined) patch.vatNumber = updates.vatNumber;
    if (updates.vatRate !== undefined) patch.vatRate = updates.vatRate.toString();
    if (updates.taxTakeawayRate !== undefined) patch.taxTakeawayRate = updates.taxTakeawayRate.toString();
    if (updates.taxDineInRate !== undefined) patch.taxDineInRate = updates.taxDineInRate.toString();
    if (updates.taxDeliveryRate !== undefined) patch.taxDeliveryRate = updates.taxDeliveryRate.toString();
    if (updates.shopEnabled !== undefined) patch.shopEnabled = !!updates.shopEnabled;
    if (updates.acceptingOrders !== undefined) patch.acceptingOrders = !!updates.acceptingOrders;
    if (updates.acceptingReservations !== undefined) {
      patch.acceptingReservations = !!updates.acceptingReservations;
    }
    if (updates.pickupEnabled !== undefined) patch.pickupEnabled = !!updates.pickupEnabled;
    if (updates.dineInEnabled !== undefined) patch.dineInEnabled = !!updates.dineInEnabled;
    if (updates.deliveryEnabled !== undefined) patch.deliveryEnabled = !!updates.deliveryEnabled;
    if (updates.channelSelectMode !== undefined) {
      patch.channelSelectMode = normalizeChannelSelectMode(updates.channelSelectMode);
    }
    if (updates.menuShowProductImages !== undefined) {
      patch.menuShowProductImages = !!updates.menuShowProductImages;
    }
    if (updates.menuShowCategoryBanners !== undefined) {
      patch.menuShowCategoryBanners = !!updates.menuShowCategoryBanners;
    }
    if (updates.scheduledOrdersEnabled !== undefined) {
      patch.scheduledOrdersEnabled = !!updates.scheduledOrdersEnabled;
    }
    if (updates.floorPlanEnabled !== undefined) patch.floorPlanEnabled = !!updates.floorPlanEnabled;
    if (updates.paxOrderingEnabled !== undefined) patch.paxOrderingEnabled = !!updates.paxOrderingEnabled;
    if (updates.coursesEnabled !== undefined) patch.coursesEnabled = !!updates.coursesEnabled;
    if (updates.storeHours !== undefined) patch.storeHours = updates.storeHours;
    if (updates.shopLogoUrl !== undefined) patch.shopLogoUrl = updates.shopLogoUrl;
    if (updates.shopBannerUrl !== undefined) patch.shopBannerUrl = updates.shopBannerUrl;
    if (updates.latitude !== undefined) {
      patch.latitude = updates.latitude === null || updates.latitude === "" ? null : String(updates.latitude);
    }
    if (updates.longitude !== undefined) {
      patch.longitude = updates.longitude === null || updates.longitude === "" ? null : String(updates.longitude);
    }
    if (updates.pickupEtaMinutes !== undefined) patch.pickupEtaMinutes = updates.pickupEtaMinutes;
    if (updates.deliveryEtaMinutes !== undefined) patch.deliveryEtaMinutes = updates.deliveryEtaMinutes;
    if (updates.deliveryMenuMarkup !== undefined) {
      const n = Number(updates.deliveryMenuMarkup);
      if (!Number.isFinite(n) || n < 0) throw new Error("deliveryMenuMarkup must be >= 0");
      patch.deliveryMenuMarkup = n.toFixed(2);
    }
    if (updates.adyenMerchantAccount !== undefined) patch.adyenMerchantAccount = updates.adyenMerchantAccount;
    if (updates.adyenClientId !== undefined) patch.adyenClientId = updates.adyenClientId;
    if (updates.adyenLiveEnvironment !== undefined) patch.adyenLiveEnvironment = !!updates.adyenLiveEnvironment;
    if (updates.adyenLiveRegion !== undefined) {
      const region = String(updates.adyenLiveRegion || "EU").toUpperCase();
      patch.adyenLiveRegion = ["EU", "US", "AU", "APSE"].includes(region) ? region : "EU";
    }
    if (updates.adyenUseLegacyEndpoint !== undefined) {
      patch.adyenUseLegacyEndpoint = !!updates.adyenUseLegacyEndpoint;
    }
    if (updates.webposExpressEnabled !== undefined) patch.webposExpressEnabled = !!updates.webposExpressEnabled;
    if (updates.webposCashEnabled !== undefined) patch.webposCashEnabled = !!updates.webposCashEnabled;
    if (updates.webposCardEnabled !== undefined) patch.webposCardEnabled = !!updates.webposCardEnabled;
    if (updates.webposTerminalEnabled !== undefined) patch.webposTerminalEnabled = !!updates.webposTerminalEnabled;
    if (updates.onlineCardFeeFixed !== undefined) {
      const n = Number(updates.onlineCardFeeFixed);
      if (!Number.isFinite(n) || n < 0) throw new Error("onlineCardFeeFixed must be >= 0");
      patch.onlineCardFeeFixed = n.toFixed(2);
    }
    if (updates.onlineCardFeePercent !== undefined) {
      const n = Number(updates.onlineCardFeePercent);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new Error("onlineCardFeePercent must be between 0 and 100");
      }
      patch.onlineCardFeePercent = n.toFixed(3);
    }
    if (updates.panelLanguage !== undefined) {
      const lang = updates.panelLanguage.toLowerCase();
      if (!["en", "fr", "de"].includes(lang)) {
        throw new Error("panelLanguage must be en, fr, or de");
      }
      patch.panelLanguage = lang;
    }
    if (updates.shopLanguage !== undefined) {
      const lang = updates.shopLanguage.toLowerCase();
      if (!["en", "fr", "de"].includes(lang)) {
        throw new Error("shopLanguage must be en, fr, or de");
      }
      patch.shopLanguage = lang;
    }
    // Only overwrite API key when a non-empty new value is provided (not the masked placeholder)
    if (updates.adyenApiKey && !updates.adyenApiKey.includes("••••")) {
      patch.adyenApiKey = updates.adyenApiKey;
    }

    if (updates.slug !== undefined) {
      patch.slug = normalizeSubdomain(updates.slug) || null;
    }
    if (updates.subdomain !== undefined) {
      patch.subdomain = normalizeSubdomain(updates.subdomain);
    }
    if (updates.customDomain !== undefined) {
      const domainNorm = normalizeCustomDomain(updates.customDomain);
      if (domainNorm) {
        const taken = await db.query.merchants.findFirst({
          where: eq(schema.merchants.customDomain, domainNorm),
        });
        if (taken && taken.id !== merchantId) {
          throw new Error("Custom domain already in use");
        }
      }
      patch.customDomain = domainNorm;
    }
    if (updates.cmsHomepageEnabled !== undefined) {
      patch.cmsHomepageEnabled = !!updates.cmsHomepageEnabled;
    }
    if (updates.vacationSettings !== undefined) {
      patch.vacationSettings = normalizeVacationSettings(updates.vacationSettings);
    }
    if (updates.emailSmtpSettings !== undefined) {
      const next = MarketingService.normalizeSmtp(updates.emailSmtpSettings);
      if (!next.password) {
        const current = await db.query.merchants.findFirst({
          where: eq(schema.merchants.id, merchantId),
          columns: { emailSmtpSettings: true },
        });
        const prev = MarketingService.normalizeSmtp(current?.emailSmtpSettings || null);
        if (prev.password) next.password = prev.password;
      }
      patch.emailSmtpSettings = next;
    }
    if (updates.marketingSettings !== undefined) {
      patch.marketingSettings = MarketingService.normalizeMarketing(updates.marketingSettings);
    }
    if (updates.posPrintSettings !== undefined) {
      patch.posPrintSettings = normalizePosPrintSettings(updates.posPrintSettings);
    }

    // Auto-create slug when enabling shop without one
    if (updates.shopEnabled && !updates.slug) {
      const current = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });
      if (current && !current.slug) {
        patch.slug = slugFromName(current.name);
      }
    }

    const merchant = await db
      .update(schema.merchants)
      .set(patch)
      .where(eq(schema.merchants.id, merchantId))
      .returning();

    if (merchant.length === 0) {
      throw new Error("Merchant not found");
    }

    return this.getMerchantSettings(merchantId);
  }

  static channelTaxRate(
    merchant: {
      vatRate?: string | number | null;
      taxTakeawayRate?: string | number | null;
      taxDineInRate?: string | number | null;
      taxDeliveryRate?: string | number | null;
    },
    channel: FulfillmentChannel = "takeaway"
  ): number {
    const fallback = merchant.vatRate != null ? parseFloat(String(merchant.vatRate)) : 0;
    const pick = (v?: string | number | null) => {
      if (v === undefined || v === null || v === "") return null;
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };
    if (channel === "dine_in") return pick(merchant.taxDineInRate) ?? fallback;
    if (channel === "delivery") return pick(merchant.taxDeliveryRate) ?? fallback;
    return pick(merchant.taxTakeawayRate) ?? fallback;
  }

  static async getVATSettings(merchantId: string) {
    const db = getDb();
    return db.query.vatSettings.findMany({
      where: eq(schema.vatSettings.merchantId, merchantId),
    });
  }

  static async createVATSetting(
    merchantId: string,
    country: string,
    vatRate: number,
    taxId?: string,
    isDefault: boolean = false
  ) {
    const db = getDb();

    if (isDefault) {
      await db
        .update(schema.vatSettings)
        .set({ isDefault: false })
        .where(eq(schema.vatSettings.merchantId, merchantId));
    }

    const vatSetting = await db
      .insert(schema.vatSettings)
      .values({
        merchantId,
        country,
        vatRate: vatRate.toString(),
        taxId,
        isDefault,
      })
      .returning();

    return vatSetting[0];
  }

  static async updateVATSetting(
    merchantId: string,
    vatSettingId: string,
    updates: {
      vatRate?: number;
      taxId?: string;
      isDefault?: boolean;
    }
  ) {
    const db = getDb();

    if (updates.isDefault) {
      await db
        .update(schema.vatSettings)
        .set({ isDefault: false })
        .where(eq(schema.vatSettings.merchantId, merchantId));
    }

    const patch: Record<string, unknown> = {};
    if (updates.vatRate !== undefined) patch.vatRate = updates.vatRate.toString();
    if (updates.taxId !== undefined) patch.taxId = updates.taxId;
    if (updates.isDefault !== undefined) patch.isDefault = updates.isDefault;

    const vatSetting = await db
      .update(schema.vatSettings)
      .set(patch)
      .where(
        and(eq(schema.vatSettings.id, vatSettingId), eq(schema.vatSettings.merchantId, merchantId))
      )
      .returning();

    if (vatSetting.length === 0) {
      throw new Error("VAT setting not found");
    }

    return vatSetting[0];
  }

  static async deleteVATSetting(merchantId: string, vatSettingId: string) {
    const db = getDb();

    const result = await db
      .delete(schema.vatSettings)
      .where(
        and(eq(schema.vatSettings.id, vatSettingId), eq(schema.vatSettings.merchantId, merchantId))
      )
      .returning();

    if (result.length === 0) {
      throw new Error("VAT setting not found");
    }

    return { success: true };
  }

  static async getDefaultVATRate(merchantId: string) {
    const db = getDb();

    const defaultVAT = await db.query.vatSettings.findFirst({
      where: and(eq(schema.vatSettings.merchantId, merchantId), eq(schema.vatSettings.isDefault, true)),
    });

    if (defaultVAT) {
      return parseFloat(defaultVAT.vatRate.toString());
    }

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });

    return merchant ? parseFloat(merchant.vatRate?.toString() || "0") : 0;
  }

  static async getVATRateByCountry(merchantId: string, country: string) {
    const db = getDb();

    const vatSetting = await db.query.vatSettings.findFirst({
      where: and(eq(schema.vatSettings.merchantId, merchantId), eq(schema.vatSettings.country, country)),
    });

    if (vatSetting) {
      return parseFloat(vatSetting.vatRate.toString());
    }

    return this.getDefaultVATRate(merchantId);
  }

  static async getBusinessInfo(merchantId: string) {
    return this.getMerchantSettings(merchantId);
  }

  static async updateBusinessInfo(
    merchantId: string,
    businessInfo: {
      phone?: string;
      businessLicense?: string;
      address?: string;
      city?: string;
      country?: string;
      vatNumber?: string;
      vatRate?: number;
    }
  ) {
    return this.updateMerchantSettings(merchantId, businessInfo);
  }

  static async resolveByShopHost(hostOrSlug: string) {
    const db = getDb();
    const raw = hostOrSlug.toLowerCase().trim();
    const domain = (process.env.DOMAIN || "").toLowerCase();
    // strip port
    const host = raw.split(":")[0];
    let key = host;
    if (domain && host.endsWith(`.${domain}`)) {
      key = host.slice(0, -(domain.length + 1));
    }

    // Custom apex / branded domain first
    const byCustom = await db.query.merchants.findFirst({
      where: eq(schema.merchants.customDomain, host),
    });
    if (byCustom) return byCustom;

    return db.query.merchants.findFirst({
      where: or(eq(schema.merchants.subdomain, key), eq(schema.merchants.slug, key)),
    });
  }
}
