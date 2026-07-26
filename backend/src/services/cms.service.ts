import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema, type CmsBlock } from "@/db";
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
    description: "Empty page — add your own blocks",
    blocks: () => [],
  },
  {
    key: "restaurant",
    name: "Restaurant",
    description: "Hero, story, POS menu, hours, and order CTA",
    blocks: (shopName) => [
      {
        id: bid(),
        type: "hero",
        title: shopName,
        subtitle: "Fresh dishes, crafted with care. Order online for pickup or delivery.",
        ctaLabel: "Order now",
        ctaHref: "/menu",
        align: "center",
      },
      {
        id: bid(),
        type: "richtext",
        html: `<p>Welcome to <strong>${shopName}</strong>. Explore our menu and order in a few taps — the same catalog as our POS.</p>`,
      },
      {
        id: bid(),
        type: "menu",
        title: "Our menu",
        subtitle: "Straight from the kitchen",
        mode: "full",
        showPrices: true,
        ctaLabel: "Full menu & checkout",
        ctaHref: "/menu",
      },
      {
        id: bid(),
        type: "hours",
        title: "Opening hours",
        channel: "display",
      },
      {
        id: bid(),
        type: "cta",
        title: "Hungry?",
        subtitle: "Order online in minutes.",
        primaryLabel: "Order online",
        primaryHref: "/menu",
      },
    ],
  },
  {
    key: "food_truck",
    name: "Food truck",
    description: "Bold hero, featured menu, custom HTML spot, CTA",
    blocks: (shopName) => [
      {
        id: bid(),
        type: "hero",
        title: shopName,
        subtitle: "Street food. Real flavor. Find us or order ahead.",
        ctaLabel: "See the menu",
        ctaHref: "/menu",
        align: "center",
      },
      {
        id: bid(),
        type: "menu",
        title: "Today's favourites",
        mode: "featured",
        limit: 6,
        showPrices: true,
        ctaLabel: "Order now",
        ctaHref: "/menu",
      },
      {
        id: bid(),
        type: "html",
        html: `<div style="padding:1.25rem;border:1px dashed #a8a29e;text-align:center"><p style="margin:0;font-size:0.95rem">Drop your own HTML here — maps, events, embed widgets…</p></div>`,
      },
      {
        id: bid(),
        type: "hours",
        title: "When we're open",
        channel: "display",
      },
      {
        id: bid(),
        type: "cta",
        title: "Order ahead",
        primaryLabel: "Start order",
        primaryHref: "/menu",
      },
    ],
  },
];

function normalizeBlocks(blocks: unknown): CmsBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b): b is CmsBlock => !!b && typeof b === "object" && typeof (b as any).type === "string")
    .map((b) => ({ ...b, id: typeof (b as any).id === "string" ? (b as any).id : bid() }));
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
  // basic hostname check
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return null;
  return d;
}
