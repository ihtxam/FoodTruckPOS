import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema, type CmsPuckData, type CmsTheme } from "@/db";
import { randomUUID } from "crypto";

function slugify(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return cleaned || `page-${Date.now().toString(36)}`;
}

function bid() {
  return randomUUID();
}

function item(type: string, props: Record<string, unknown> = {}) {
  return { type, props: { id: bid(), ...props } };
}

function emptyData(title = ""): CmsPuckData {
  return { content: [], root: { props: { title } } };
}

function restaurantData(shopName: string): CmsPuckData {
  return {
    root: { props: { title: shopName } },
    content: [
      item("Hero", {
        title: shopName,
        subtitle: "Fresh dishes, crafted with care. Order online for pickup or delivery.",
        ctaLabel: "Order now",
        ctaHref: "/menu",
        secondaryCtaLabel: "Reservations",
        secondaryCtaHref: "/reservations",
        imageUrl: "",
        align: "center",
      }),
      item("Text", {
        text: `Welcome to ${shopName}. Explore our menu — the same catalog as our POS.`,
      }),
      item("PosMenu", {
        title: "Our menu",
        subtitle: "Straight from the kitchen",
        mode: "full",
        showPrices: true,
        limit: 8,
        ctaLabel: "Full menu & checkout",
        ctaHref: "/menu",
      }),
      item("ReservationsCta", {
        title: "Reserve a table",
        subtitle: "Book online and we will have everything ready when you arrive.",
        ctaLabel: "Book a table",
        ctaHref: "/reservations",
      }),
      item("ShopHours", { title: "Opening hours", channel: "display" }),
      item("Cta", {
        title: "Hungry?",
        subtitle: "Order online in minutes.",
        primaryLabel: "Order online",
        primaryHref: "/menu",
        secondaryLabel: "Book a table",
        secondaryHref: "/reservations",
      }),
    ],
  };
}

function foodTruckData(shopName: string): CmsPuckData {
  return {
    root: { props: { title: shopName } },
    content: [
      item("Hero", {
        title: shopName,
        subtitle: "Street food. Real flavor. Find us or order ahead.",
        ctaLabel: "See the menu",
        ctaHref: "/menu",
        secondaryCtaLabel: "Reservations",
        secondaryCtaHref: "/reservations",
        imageUrl: "",
        align: "center",
      }),
      item("PosMenu", {
        title: "Today's favourites",
        subtitle: "",
        mode: "featured",
        showPrices: true,
        limit: 6,
        ctaLabel: "Order now",
        ctaHref: "/menu",
      }),
      item("ReservationsCta", {
        title: "Reserve a table",
        subtitle: "Book online and we will have everything ready when you arrive.",
        ctaLabel: "Book a table",
        ctaHref: "/reservations",
      }),
      item("Html", {
        html: '<div style="padding:1.25rem;border:1px dashed #a8a29e;text-align:center"><p style="margin:0">Drop your own HTML here — maps, events, embeds…</p></div>',
      }),
      item("ShopHours", { title: "When we're open", channel: "display" }),
      item("Cta", {
        title: "Order ahead",
        subtitle: "",
        primaryLabel: "Start order",
        primaryHref: "/menu",
        secondaryLabel: "Book a table",
        secondaryHref: "/reservations",
      }),
    ],
  };
}

export type CmsTemplateKey = "blank" | "restaurant" | "food_truck";

export const CMS_TEMPLATES: Array<{
  key: CmsTemplateKey;
  name: string;
  description: string;
  data: (shopName: string) => CmsPuckData;
}> = [
  {
    key: "blank",
    name: "Blank",
    description: "Empty canvas — drag blocks in the builder",
    data: (name) => emptyData(name),
  },
  {
    key: "restaurant",
    name: "Restaurant",
    description: "Hero, story, POS menu, hours, and order CTA",
    data: restaurantData,
  },
  {
    key: "food_truck",
    name: "Food truck",
    description: "Bold hero, featured menu, HTML spot, CTA",
    data: foodTruckData,
  },
];

/** Accept Puck data, or migrate legacy ChaiBuilder arrays. */
export function normalizePuckData(raw: unknown, fallbackTitle = ""): CmsPuckData {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as any).content)) {
    const data = raw as CmsPuckData;
    return {
      content: (data.content || []).map((c) => ({
        type: String(c.type || "Text"),
        props: {
          id: typeof c.props?.id === "string" ? c.props.id : bid(),
          ...(c.props || {}),
        },
      })),
      root: data.root && typeof data.root === "object" ? data.root : { props: { title: fallbackTitle } },
      zones: data.zones,
    };
  }

  // Legacy ChaiBuilder array → best-effort Puck content
  if (Array.isArray(raw)) {
    const content: CmsPuckData["content"] = [];
    for (const b of raw) {
      if (!b || typeof b !== "object") continue;
      const type = String((b as any)._type || (b as any).type || "");
      if (type === "Heading" || type === "hero") {
        content.push(
          item("Hero", {
            title: String((b as any).content || (b as any).title || fallbackTitle || "Welcome"),
            subtitle: String((b as any).subtitle || ""),
            ctaLabel: String((b as any).ctaLabel || "Order now"),
            ctaHref: String((b as any).ctaHref || "/menu"),
            imageUrl: String((b as any).imageUrl || ""),
            align: "center",
          })
        );
      } else if (type === "CustomHTML" || type === "html" || type === "richtext") {
        content.push(item("Html", { html: String((b as any).htmlCode || (b as any).html || "") }));
      } else if (type === "PosMenu" || type === "menu") {
        content.push(
          item("PosMenu", {
            title: String((b as any).title || "Menu"),
            subtitle: String((b as any).subtitle || ""),
            mode: (b as any).mode === "featured" ? "featured" : "full",
            showPrices: (b as any).showPrices !== false,
            limit: Number((b as any).limit) || 8,
            ctaLabel: String((b as any).ctaLabel || "Order online"),
            ctaHref: String((b as any).ctaHref || "/menu"),
          })
        );
      } else if (type === "ShopHours" || type === "hours") {
        content.push(
          item("ShopHours", {
            title: String((b as any).title || "Hours"),
            channel: String((b as any).channel || "display"),
          })
        );
      } else if (type === "Paragraph") {
        content.push(item("Text", { text: String((b as any).content || "") }));
      }
    }
    return { content, root: { props: { title: fallbackTitle } } };
  }

  return emptyData(fallbackTitle);
}

export class CmsService {
  static listTemplates() {
    return CMS_TEMPLATES.map(({ key, name, description }) => ({ key, name, description }));
  }

  static async listPages(merchantId: string) {
    const db = getDb();
    return db.query.cmsPages.findMany({
      where: eq(schema.cmsPages.merchantId, merchantId),
      orderBy: [desc(schema.cmsPages.isHomepage), asc(schema.cmsPages.title)],
    });
  }

  static async getPage(merchantId: string, pageId: string) {
    const db = getDb();
    const page = await db.query.cmsPages.findFirst({
      where: and(eq(schema.cmsPages.id, pageId), eq(schema.cmsPages.merchantId, merchantId)),
    });
    if (!page) throw new Error("Page not found");
    return {
      ...page,
      blocks: normalizePuckData(page.blocks, page.title),
    };
  }

  static async createPage(
    merchantId: string,
    input: {
      title: string;
      slug?: string;
      isHomepage?: boolean;
      templateKey?: CmsTemplateKey;
      blocks?: CmsPuckData | unknown;
      theme?: CmsTheme | null;
      seoTitle?: string;
      seoDescription?: string;
      status?: "draft" | "published";
    }
  ) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const template = CMS_TEMPLATES.find((t) => t.key === (input.templateKey || "blank"));
    const title = (input.title || "Homepage").trim().slice(0, 200);
    let slug = slugify(input.slug || (input.isHomepage ? "home" : title));

    const existing = await db.query.cmsPages.findFirst({
      where: and(eq(schema.cmsPages.merchantId, merchantId), eq(schema.cmsPages.slug, slug)),
    });
    if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const isHomepage = !!input.isHomepage;
    if (isHomepage) {
      await db
        .update(schema.cmsPages)
        .set({ isHomepage: false, updatedAt: new Date() })
        .where(and(eq(schema.cmsPages.merchantId, merchantId), eq(schema.cmsPages.isHomepage, true)));
    }

    const status = input.status === "published" ? "published" : "draft";
    const blocks =
      input.blocks !== undefined
        ? normalizePuckData(input.blocks, title)
        : template
          ? template.data(merchant.name)
          : emptyData(title);

    const [page] = await db
      .insert(schema.cmsPages)
      .values({
        merchantId,
        title,
        slug,
        isHomepage,
        status,
        templateKey: template?.key || input.templateKey || null,
        blocks,
        theme: input.theme || null,
        seoTitle: input.seoTitle?.slice(0, 200) || null,
        seoDescription: input.seoDescription || null,
        publishedAt: status === "published" ? new Date() : null,
      })
      .returning();

    if (isHomepage && status === "published") {
      await db
        .update(schema.merchants)
        .set({ cmsHomepageEnabled: true, updatedAt: new Date() })
        .where(eq(schema.merchants.id, merchantId));
    }

    return { ...page, blocks: normalizePuckData(page.blocks, page.title) };
  }

  static async updatePage(
    merchantId: string,
    pageId: string,
    input: {
      title?: string;
      slug?: string;
      isHomepage?: boolean;
      blocks?: CmsPuckData | unknown;
      theme?: CmsTheme | null;
      seoTitle?: string | null;
      seoDescription?: string | null;
      status?: "draft" | "published";
      templateKey?: string | null;
    }
  ) {
    const db = getDb();
    const current = await this.getPage(merchantId, pageId);
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (input.title !== undefined) patch.title = input.title.trim().slice(0, 200);
    if (input.slug !== undefined) {
      const slug = slugify(input.slug);
      const clash = await db.query.cmsPages.findFirst({
        where: and(eq(schema.cmsPages.merchantId, merchantId), eq(schema.cmsPages.slug, slug)),
      });
      if (clash && clash.id !== pageId) throw new Error("Slug already in use");
      patch.slug = slug;
    }
    if (input.blocks !== undefined) {
      patch.blocks = normalizePuckData(input.blocks, String(patch.title || current.title));
    }
    if (input.theme !== undefined) patch.theme = input.theme;
    if (input.seoTitle !== undefined) patch.seoTitle = input.seoTitle ? input.seoTitle.slice(0, 200) : null;
    if (input.seoDescription !== undefined) patch.seoDescription = input.seoDescription;
    if (input.templateKey !== undefined) patch.templateKey = input.templateKey;

    if (input.isHomepage === true) {
      await db
        .update(schema.cmsPages)
        .set({ isHomepage: false, updatedAt: new Date() })
        .where(and(eq(schema.cmsPages.merchantId, merchantId), eq(schema.cmsPages.isHomepage, true)));
      patch.isHomepage = true;
    } else if (input.isHomepage === false) {
      patch.isHomepage = false;
    }

    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === "published") {
        patch.publishedAt = current.publishedAt || new Date();
      }
    }

    const [page] = await db
      .update(schema.cmsPages)
      .set(patch)
      .where(and(eq(schema.cmsPages.id, pageId), eq(schema.cmsPages.merchantId, merchantId)))
      .returning();

    if (page.isHomepage) {
      await db
        .update(schema.merchants)
        .set({ cmsHomepageEnabled: page.status === "published", updatedAt: new Date() })
        .where(eq(schema.merchants.id, merchantId));
    }

    return { ...page, blocks: normalizePuckData(page.blocks, page.title) };
  }

  static async deletePage(merchantId: string, pageId: string) {
    const db = getDb();
    const page = await this.getPage(merchantId, pageId);
    await db
      .delete(schema.cmsPages)
      .where(and(eq(schema.cmsPages.id, pageId), eq(schema.cmsPages.merchantId, merchantId)));

    if (page.isHomepage) {
      await db
        .update(schema.merchants)
        .set({ cmsHomepageEnabled: false, updatedAt: new Date() })
        .where(eq(schema.merchants.id, merchantId));
    }
    return { ok: true };
  }

  static async getPublishedHomepage(merchantId: string) {
    const db = getDb();
    const page = await db.query.cmsPages.findFirst({
      where: and(
        eq(schema.cmsPages.merchantId, merchantId),
        eq(schema.cmsPages.isHomepage, true),
        eq(schema.cmsPages.status, "published")
      ),
    });
    if (!page) return null;
    return { ...page, blocks: normalizePuckData(page.blocks, page.title) };
  }

  static async getPublishedBySlug(merchantId: string, slug: string) {
    const db = getDb();
    const page = await db.query.cmsPages.findFirst({
      where: and(
        eq(schema.cmsPages.merchantId, merchantId),
        eq(schema.cmsPages.slug, slugify(slug)),
        eq(schema.cmsPages.status, "published")
      ),
    });
    if (!page) return null;
    return { ...page, blocks: normalizePuckData(page.blocks, page.title) };
  }

  static async updateSiteSettings(
    merchantId: string,
    input: { customDomain?: string | null; cmsHomepageEnabled?: boolean }
  ) {
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (input.customDomain !== undefined) {
      const domain = normalizeCustomDomain(input.customDomain);
      if (domain) {
        const taken = await db.query.merchants.findFirst({
          where: eq(schema.merchants.customDomain, domain),
        });
        if (taken && taken.id !== merchantId) {
          throw new Error("Custom domain already in use");
        }
      }
      patch.customDomain = domain;
    }
    if (input.cmsHomepageEnabled !== undefined) {
      patch.cmsHomepageEnabled = !!input.cmsHomepageEnabled;
    }

    await db.update(schema.merchants).set(patch).where(eq(schema.merchants.id, merchantId));
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    return {
      customDomain: merchant?.customDomain || null,
      cmsHomepageEnabled: !!merchant?.cmsHomepageEnabled,
      shopCustomDomainUrl: merchant?.customDomain ? `https://${merchant.customDomain}` : null,
    };
  }
}

export function normalizeCustomDomain(raw?: string | null): string | null {
  if (!raw) return null;
  let d = raw
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  if (!d || d.includes(" ") || d.includes("/") || !d.includes(".")) return null;
  if (d.length > 255) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return null;
  return d;
}
