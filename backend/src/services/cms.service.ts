import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema, type CmsBlock, type CmsTheme } from "@/db";
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

function chaiBlock(type: string, props: Record<string, unknown> = {}, parent?: string | null): CmsBlock {
  const block: CmsBlock = { _id: bid(), _type: type, ...props };
  if (parent) block._parent = parent;
  return block;
}

/** Build ChaiBuilder-compatible block trees for starter templates */
function restaurantBlocks(shopName: string): CmsBlock[] {
  const hero = chaiBlock("Box", {
    tag: "section",
    styles: "#styles:,min-h-[52vh] flex flex-col items-center justify-center px-6 py-20 bg-stone-900 text-white text-center",
    backgroundImage: "",
  });
  const heading = chaiBlock(
    "Heading",
    {
      tag: "h1",
      styles: "#styles:,text-4xl md:text-6xl font-semibold tracking-tight",
      content: shopName,
    },
    hero._id
  );
  const sub = chaiBlock(
    "Paragraph",
    {
      styles: "#styles:,mt-4 text-base md:text-lg text-stone-200 max-w-2xl",
      content: "Fresh dishes, crafted with care. Order online for pickup or delivery.",
    },
    hero._id
  );
  const cta = chaiBlock(
    "Button",
    {
      styles: "#styles:,mt-8 bg-white text-stone-900 px-6 py-3 rounded-none font-semibold",
      content: "Order now",
      icon: "",
      iconSize: 16,
      iconPos: "order-last",
      link: { type: "url", href: "/menu", target: "_self" },
      prefetchLink: true,
    },
    hero._id
  );
  const story = chaiBlock("CustomHTML", {
    styles: "#styles:,max-w-3xl mx-auto px-4 py-10",
    htmlCode: `<p>Welcome to <strong>${shopName}</strong>. Explore our menu — the same catalog as our POS.</p>`,
  });
  const menu = chaiBlock("PosMenu", {
    styles: "#styles:,max-w-5xl mx-auto px-4 py-12",
    title: "Our menu",
    subtitle: "Straight from the kitchen",
    mode: "full",
    showPrices: true,
    limit: 8,
    ctaLabel: "Full menu & checkout",
    ctaHref: "/menu",
  });
  const hours = chaiBlock("ShopHours", {
    styles: "#styles:,max-w-5xl mx-auto px-4 py-10 text-center",
    title: "Opening hours",
    channel: "display",
  });
  const ctaBox = chaiBlock("Box", {
    tag: "section",
    styles: "#styles:,bg-stone-900 text-white px-6 py-14 text-center",
    backgroundImage: "",
  });
  const ctaTitle = chaiBlock(
    "Heading",
    {
      tag: "h2",
      styles: "#styles:,text-2xl md:text-3xl font-semibold",
      content: "Hungry?",
    },
    ctaBox._id
  );
  const ctaBtn = chaiBlock(
    "Button",
    {
      styles: "#styles:,mt-6 bg-white text-stone-900 px-5 py-2.5 font-semibold",
      content: "Order online",
      icon: "",
      iconSize: 16,
      iconPos: "order-last",
      link: { type: "url", href: "/menu", target: "_self" },
      prefetchLink: true,
    },
    ctaBox._id
  );
  return [hero, heading, sub, cta, story, menu, hours, ctaBox, ctaTitle, ctaBtn];
}

function foodTruckBlocks(shopName: string): CmsBlock[] {
  const hero = chaiBlock("Box", {
    tag: "section",
    styles: "#styles:,min-h-[48vh] flex flex-col items-center justify-center px-6 py-16 bg-amber-900 text-amber-50 text-center",
    backgroundImage: "",
  });
  const heading = chaiBlock(
    "Heading",
    {
      tag: "h1",
      styles: "#styles:,text-4xl md:text-5xl font-semibold tracking-tight",
      content: shopName,
    },
    hero._id
  );
  const sub = chaiBlock(
    "Paragraph",
    {
      styles: "#styles:,mt-3 text-amber-100 max-w-xl",
      content: "Street food. Real flavor. Find us or order ahead.",
    },
    hero._id
  );
  const menu = chaiBlock("PosMenu", {
    styles: "#styles:,max-w-5xl mx-auto px-4 py-12",
    title: "Today's favourites",
    subtitle: "",
    mode: "featured",
    showPrices: true,
    limit: 6,
    ctaLabel: "Order now",
    ctaHref: "/menu",
  });
  const html = chaiBlock("CustomHTML", {
    styles: "#styles:,max-w-3xl mx-auto px-4 py-6",
    htmlCode:
      '<div style="padding:1.25rem;border:1px dashed #a8a29e;text-align:center"><p style="margin:0">Drop your own HTML here — maps, events, embeds…</p></div>',
  });
  const hours = chaiBlock("ShopHours", {
    styles: "#styles:,max-w-5xl mx-auto px-4 py-8 text-center",
    title: "When we're open",
    channel: "display",
  });
  const cta = chaiBlock(
    "Button",
    {
      styles: "#styles:,mx-auto my-10 block w-fit bg-stone-900 text-white px-6 py-3 font-semibold",
      content: "Start order",
      icon: "",
      iconSize: 16,
      iconPos: "order-last",
      link: { type: "url", href: "/menu", target: "_self" },
      prefetchLink: true,
    }
  );
  return [hero, heading, sub, menu, html, hours, cta];
}

export type CmsTemplateKey = "blank" | "restaurant" | "food_truck";

export const CMS_TEMPLATES: Array<{
  key: CmsTemplateKey;
  name: string;
  description: string;
  blocks: (shopName: string) => CmsBlock[];
}> = [
  {
    key: "blank",
    name: "Blank",
    description: "Empty canvas — drag blocks in the builder",
    blocks: () => [],
  },
  {
    key: "restaurant",
    name: "Restaurant",
    description: "Hero, story, POS menu, hours, and order CTA",
    blocks: restaurantBlocks,
  },
  {
    key: "food_truck",
    name: "Food truck",
    description: "Bold hero, featured menu, HTML spot, CTA",
    blocks: foodTruckBlocks,
  },
];

function normalizeBlocks(blocks: unknown): CmsBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
    .map((b) => {
      // Already ChaiBuilder format
      if (typeof b._type === "string") {
        return {
          ...b,
          _id: typeof b._id === "string" ? b._id : bid(),
          _type: b._type,
        } as CmsBlock;
      }
      // Legacy simple CMS blocks → minimal Chai mapping
      const legacyType = String(b.type || "CustomHTML");
      if (legacyType === "html" || legacyType === "richtext") {
        return chaiBlock("CustomHTML", {
          styles: "#styles:,",
          htmlCode: String(b.html || ""),
        });
      }
      if (legacyType === "menu") {
        return chaiBlock("PosMenu", {
          styles: "#styles:,",
          title: String(b.title || "Menu"),
          subtitle: String(b.subtitle || ""),
          mode: b.mode === "featured" ? "featured" : "full",
          showPrices: b.showPrices !== false,
          limit: Number(b.limit) || 8,
          ctaLabel: String(b.ctaLabel || "Order online"),
          ctaHref: String(b.ctaHref || "/menu"),
        });
      }
      if (legacyType === "hours") {
        return chaiBlock("ShopHours", {
          styles: "#styles:,",
          title: String(b.title || "Hours"),
          channel: String(b.channel || "display"),
        });
      }
      if (legacyType === "hero") {
        return chaiBlock("Heading", {
          tag: "h1",
          styles: "#styles:,text-4xl font-semibold",
          content: String(b.title || "Welcome"),
        });
      }
      return chaiBlock("CustomHTML", {
        styles: "#styles:,",
        htmlCode: `<pre>${JSON.stringify(b).replace(/</g, "&lt;")}</pre>`,
      });
    });
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
    return page;
  }

  static async createPage(
    merchantId: string,
    input: {
      title: string;
      slug?: string;
      isHomepage?: boolean;
      templateKey?: CmsTemplateKey;
      blocks?: CmsBlock[];
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
        ? normalizeBlocks(input.blocks)
        : template
          ? template.blocks(merchant.name)
          : [];

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

    return page;
  }

  static async updatePage(
    merchantId: string,
    pageId: string,
    input: {
      title?: string;
      slug?: string;
      isHomepage?: boolean;
      blocks?: CmsBlock[];
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
    if (input.blocks !== undefined) patch.blocks = normalizeBlocks(input.blocks);
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

    const homepage = page.isHomepage;
    const published = page.status === "published";
    if (homepage) {
      await db
        .update(schema.merchants)
        .set({ cmsHomepageEnabled: published, updatedAt: new Date() })
        .where(eq(schema.merchants.id, merchantId));
    }

    return page;
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
    return db.query.cmsPages.findFirst({
      where: and(
        eq(schema.cmsPages.merchantId, merchantId),
        eq(schema.cmsPages.isHomepage, true),
        eq(schema.cmsPages.status, "published")
      ),
    });
  }

  static async getPublishedBySlug(merchantId: string, slug: string) {
    const db = getDb();
    return db.query.cmsPages.findFirst({
      where: and(
        eq(schema.cmsPages.merchantId, merchantId),
        eq(schema.cmsPages.slug, slugify(slug)),
        eq(schema.cmsPages.status, "published")
      ),
    });
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
