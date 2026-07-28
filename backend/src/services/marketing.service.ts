import { and, desc, eq, gte, isNotNull, lt, ne } from "drizzle-orm";
import { getDb, schema, type MarketingSettings, type MerchantSmtpSettings } from "@/db";
import { EmailService } from "@/services/email.service";

const DEFAULT_REORDER_DAYS = 5;

const DEFAULT_REORDER_SUBJECT = "We miss you — order again from {{businessName}}";
const DEFAULT_REORDER_BODY = `<p>Hi {{name}},</p>
<p>It's been a few days since your last order. We'd love to see you again!</p>
<p><a href="{{shopUrl}}">Order now</a></p>
<p>— {{businessName}}</p>`;

function normalizeSmtp(raw: MerchantSmtpSettings | null | undefined): MerchantSmtpSettings {
  if (!raw || typeof raw !== "object") {
    return { enabled: false, host: "", port: 587, secure: false, user: "", password: "", fromEmail: "", fromName: "" };
  }
  return {
    enabled: !!raw.enabled,
    host: String(raw.host || "").trim(),
    port: Number(raw.port) || 587,
    secure: !!raw.secure,
    user: String(raw.user || "").trim(),
    password: raw.password != null ? String(raw.password) : "",
    fromEmail: String(raw.fromEmail || "").trim(),
    fromName: String(raw.fromName || "").trim(),
  };
}

function normalizeMarketing(raw: MarketingSettings | null | undefined): MarketingSettings {
  if (!raw || typeof raw !== "object") {
    return {
      reorderReminderEnabled: false,
      reorderReminderDays: DEFAULT_REORDER_DAYS,
      reorderReminderSubject: DEFAULT_REORDER_SUBJECT,
      reorderReminderBody: DEFAULT_REORDER_BODY,
    };
  }
  const days = Number(raw.reorderReminderDays);
  return {
    reorderReminderEnabled: !!raw.reorderReminderEnabled,
    reorderReminderDays:
      Number.isFinite(days) && days >= 1 && days <= 90 ? Math.round(days) : DEFAULT_REORDER_DAYS,
    reorderReminderSubject: String(raw.reorderReminderSubject || DEFAULT_REORDER_SUBJECT),
    reorderReminderBody: String(raw.reorderReminderBody || DEFAULT_REORDER_BODY),
  };
}

function applyPlaceholders(
  template: string,
  vars: { name: string; shopUrl: string; businessName: string }
) {
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, vars.name)
    .replace(/\{\{\s*shopUrl\s*\}\}/gi, vars.shopUrl)
    .replace(/\{\{\s*businessName\s*\}\}/gi, vars.businessName);
}

function shopUrlForMerchant(merchant: {
  slug?: string | null;
  subdomain?: string | null;
  customDomain?: string | null;
}) {
  const domain = process.env.DOMAIN || process.env.PUBLIC_APP_URL || "https://chaslay.com";
  const base = domain.replace(/\/$/, "").startsWith("http")
    ? domain.replace(/\/$/, "")
    : `https://${domain.replace(/\/$/, "")}`;
  if (merchant.customDomain) return `https://${merchant.customDomain.replace(/^https?:\/\//, "")}`;
  if (merchant.subdomain) {
    try {
      const host = new URL(base).host;
      const apex = host.replace(/^www\./, "").replace(/^shop\./, "").replace(/^app\./, "");
      return `https://${merchant.subdomain}.${apex}`;
    } catch {
      /* fall through */
    }
  }
  if (merchant.slug) return `${base}/${merchant.slug}`;
  return base;
}

function htmlWrap(body: string) {
  const looksHtml = /<[a-z][\s\S]*>/i.test(body);
  const content = looksHtml ? body : body.replace(/\n/g, "<br/>");
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1c1917;max-width:560px;margin:0 auto;padding:24px">${content}</body></html>`;
}

export class MarketingService {
  static getSmtpPublic(raw: MerchantSmtpSettings | null | undefined) {
    const s = normalizeSmtp(raw);
    return {
      enabled: s.enabled,
      host: s.host,
      port: s.port,
      secure: s.secure,
      user: s.user,
      passwordSet: !!s.password,
      fromEmail: s.fromEmail,
      fromName: s.fromName,
    };
  }

  static normalizeSmtp = normalizeSmtp;
  static normalizeMarketing = normalizeMarketing;

  static async listAudience(merchantId: string) {
    const db = getDb();
    const rows = await db
      .select({
        id: schema.customers.id,
        email: schema.customers.email,
        firstName: schema.customers.firstName,
        lastName: schema.customers.lastName,
        phone: schema.customers.phone,
        marketingOptIn: schema.customers.marketingOptIn,
        lastOrderAt: schema.customers.lastOrderAt,
        totalSpent: schema.customers.totalSpent,
      })
      .from(schema.customers)
      .where(
        and(
          eq(schema.customers.merchantId, merchantId),
          isNotNull(schema.customers.email),
          ne(schema.customers.email, "")
        )
      )
      .orderBy(desc(schema.customers.lastOrderAt), desc(schema.customers.updatedAt));

    // Also include distinct guest emails from orders not linked to a customer
    const guestEmails = await db
      .selectDistinct({ email: schema.orders.customerEmail, name: schema.orders.customerName })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.merchantId, merchantId),
          isNotNull(schema.orders.customerEmail),
          ne(schema.orders.customerEmail, "")
        )
      );

    const byEmail = new Map<
      string,
      {
        id: string | null;
        email: string;
        name: string;
        phone: string | null;
        marketingOptIn: boolean;
        lastOrderAt: Date | null;
        totalSpent: string | null;
      }
    >();

    for (const c of rows) {
      const email = String(c.email || "")
        .trim()
        .toLowerCase();
      if (!email || !email.includes("@")) continue;
      if (c.marketingOptIn === false) continue;
      byEmail.set(email, {
        id: c.id,
        email,
        name: [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || email,
        phone: c.phone || null,
        marketingOptIn: c.marketingOptIn !== false,
        lastOrderAt: c.lastOrderAt || null,
        totalSpent: c.totalSpent != null ? String(c.totalSpent) : null,
      });
    }

    for (const g of guestEmails) {
      const email = String(g.email || "")
        .trim()
        .toLowerCase();
      if (!email || !email.includes("@") || byEmail.has(email)) continue;
      byEmail.set(email, {
        id: null,
        email,
        name: String(g.name || "").trim() || email,
        phone: null,
        marketingOptIn: true,
        lastOrderAt: null,
        totalSpent: null,
      });
    }

    return Array.from(byEmail.values()).sort((a, b) => a.email.localeCompare(b.email));
  }

  static async listCampaigns(merchantId: string) {
    const db = getDb();
    return db.query.newsletterCampaigns.findMany({
      where: eq(schema.newsletterCampaigns.merchantId, merchantId),
      orderBy: [desc(schema.newsletterCampaigns.createdAt)],
      limit: 50,
    });
  }

  static async saveCampaign(
    merchantId: string,
    input: {
      id?: string;
      title?: string;
      subject: string;
      bodyHtml: string;
      audience?: "all" | "selected";
      selectedEmails?: string[];
    }
  ) {
    const db = getDb();
    const subject = String(input.subject || "").trim();
    const bodyHtml = String(input.bodyHtml || "").trim();
    if (!subject) throw new Error("Subject is required");
    if (!bodyHtml) throw new Error("Newsletter body is required");

    const audience = input.audience === "selected" ? "selected" : "all";
    const selectedEmails =
      audience === "selected"
        ? Array.from(
            new Set(
              (input.selectedEmails || [])
                .map((e) => String(e || "").trim().toLowerCase())
                .filter((e) => e.includes("@"))
            )
          )
        : null;

    if (input.id) {
      const existing = await db.query.newsletterCampaigns.findFirst({
        where: and(
          eq(schema.newsletterCampaigns.id, input.id),
          eq(schema.newsletterCampaigns.merchantId, merchantId)
        ),
      });
      if (!existing) throw new Error("Campaign not found");
      if (existing.status === "sending") throw new Error("Campaign is currently sending");
      const [updated] = await db
        .update(schema.newsletterCampaigns)
        .set({
          title: String(input.title || existing.title || "Newsletter").slice(0, 200),
          subject: subject.slice(0, 300),
          bodyHtml,
          audience,
          selectedEmails,
          status: existing.status === "sent" ? "draft" : existing.status,
          updatedAt: new Date(),
        })
        .where(eq(schema.newsletterCampaigns.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(schema.newsletterCampaigns)
      .values({
        merchantId,
        title: String(input.title || "Newsletter").slice(0, 200),
        subject: subject.slice(0, 300),
        bodyHtml,
        audience,
        selectedEmails,
        status: "draft",
      })
      .returning();
    return created;
  }

  static async sendCampaign(merchantId: string, campaignId: string) {
    const db = getDb();
    const campaign = await db.query.newsletterCampaigns.findFirst({
      where: and(
        eq(schema.newsletterCampaigns.id, campaignId),
        eq(schema.newsletterCampaigns.merchantId, merchantId)
      ),
    });
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status === "sending") throw new Error("Already sending");

    const configured = await EmailService.isConfigured(merchantId);
    if (!configured) {
      throw new Error("Configure SMTP in Settings → Email before sending");
    }

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const audience = await this.listAudience(merchantId);
    let recipients = audience;
    if (campaign.audience === "selected") {
      const set = new Set((campaign.selectedEmails || []).map((e) => e.toLowerCase()));
      recipients = audience.filter((a) => set.has(a.email));
    }
    if (!recipients.length) throw new Error("No recipients selected");

    await db
      .update(schema.newsletterCampaigns)
      .set({
        status: "sending",
        recipientCount: recipients.length,
        sentCount: 0,
        failedCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(schema.newsletterCampaigns.id, campaignId));

    const shopUrl = shopUrlForMerchant(merchant);
    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      try {
        const html = applyPlaceholders(campaign.bodyHtml, {
          name: r.name || "there",
          shopUrl,
          businessName: merchant.name || "us",
        });
        await EmailService.send({
          merchantId,
          to: r.email,
          subject: applyPlaceholders(campaign.subject, {
            name: r.name || "there",
            shopUrl,
            businessName: merchant.name || "us",
          }),
          html: htmlWrap(html),
        });
        sent += 1;
        await db.insert(schema.marketingEmailLog).values({
          merchantId,
          campaignId,
          email: r.email,
          customerId: r.id,
          type: "newsletter",
          status: "sent",
        });
      } catch (error: any) {
        failed += 1;
        await db.insert(schema.marketingEmailLog).values({
          merchantId,
          campaignId,
          email: r.email,
          customerId: r.id,
          type: "newsletter",
          status: "failed",
          error: error?.message || "Send failed",
        });
      }
    }

    const [updated] = await db
      .update(schema.newsletterCampaigns)
      .set({
        status: failed && !sent ? "failed" : "sent",
        sentCount: sent,
        failedCount: failed,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.newsletterCampaigns.id, campaignId))
      .returning();

    return updated;
  }

  /** Refresh lastOrderAt from latest non-cancelled order (by customerId or email). */
  static async touchLastOrder(
    merchantId: string,
    opts: { customerId?: string | null; email?: string | null; at?: Date }
  ) {
    const db = getDb();
    const at = opts.at || new Date();
    if (opts.customerId) {
      await db
        .update(schema.customers)
        .set({ lastOrderAt: at, updatedAt: new Date() })
        .where(
          and(eq(schema.customers.id, opts.customerId), eq(schema.customers.merchantId, merchantId))
        );
      return;
    }
    const email = String(opts.email || "")
      .trim()
      .toLowerCase();
    if (!email) return;
    const existing = await db.query.customers.findFirst({
      where: and(eq(schema.customers.merchantId, merchantId), eq(schema.customers.email, email)),
    });
    if (existing) {
      await db
        .update(schema.customers)
        .set({ lastOrderAt: at, updatedAt: new Date() })
        .where(eq(schema.customers.id, existing.id));
    }
  }

  static async processReorderReminders() {
    const db = getDb();
    const merchants = await db.query.merchants.findMany({
      where: eq(schema.merchants.status, "active"),
      columns: {
        id: true,
        name: true,
        slug: true,
        subdomain: true,
        customDomain: true,
        marketingSettings: true,
        emailSmtpSettings: true,
        shopEnabled: true,
      },
    });

    let sent = 0;
    for (const merchant of merchants) {
      const marketing = normalizeMarketing(merchant.marketingSettings);
      if (!marketing.reorderReminderEnabled) continue;
      if (!(await EmailService.isConfigured(merchant.id))) continue;

      const days = marketing.reorderReminderDays || DEFAULT_REORDER_DAYS;
      const cutoff = new Date(Date.now() - days * 24 * 3600_000);
      const minOrder = new Date(Date.now() - (days + 2) * 24 * 3600_000); // window: ordered ~days ago, not older than days+2
      // Eligible: last order between (now-days-2) and (now-days), and no reminder since that order
      const candidates = await db
        .select()
        .from(schema.customers)
        .where(
          and(
            eq(schema.customers.merchantId, merchant.id),
            eq(schema.customers.marketingOptIn, true),
            isNotNull(schema.customers.email),
            isNotNull(schema.customers.lastOrderAt),
            lt(schema.customers.lastOrderAt, cutoff),
            gte(schema.customers.lastOrderAt, minOrder)
          )
        )
        .limit(200);

      const shopUrl = shopUrlForMerchant(merchant);
      for (const c of candidates) {
        const email = String(c.email || "")
          .trim()
          .toLowerCase();
        if (!email.includes("@")) continue;
        if (c.lastReorderReminderAt && c.lastOrderAt && c.lastReorderReminderAt >= c.lastOrderAt) {
          continue; // already reminded after this order
        }
        const name =
          [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || email.split("@")[0];
        const subject = applyPlaceholders(marketing.reorderReminderSubject || DEFAULT_REORDER_SUBJECT, {
          name,
          shopUrl,
          businessName: merchant.name || "us",
        });
        const body = applyPlaceholders(marketing.reorderReminderBody || DEFAULT_REORDER_BODY, {
          name,
          shopUrl,
          businessName: merchant.name || "us",
        });
        try {
          await EmailService.send({
            merchantId: merchant.id,
            to: email,
            subject,
            html: htmlWrap(body),
          });
          await db
            .update(schema.customers)
            .set({ lastReorderReminderAt: new Date(), updatedAt: new Date() })
            .where(eq(schema.customers.id, c.id));
          await db.insert(schema.marketingEmailLog).values({
            merchantId: merchant.id,
            email,
            customerId: c.id,
            type: "reorder_reminder",
            status: "sent",
          });
          sent += 1;
        } catch (error: any) {
          await db.insert(schema.marketingEmailLog).values({
            merchantId: merchant.id,
            email,
            customerId: c.id,
            type: "reorder_reminder",
            status: "failed",
            error: error?.message || "Send failed",
          });
        }
      }
    }
    return { sent };
  }
}
