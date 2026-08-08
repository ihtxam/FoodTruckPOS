import { getDb, schema, type ReportEmailSettings } from "@/db";
import { eq } from "drizzle-orm";
import { EmailService } from "./email.service";
import { ReportExportService } from "./report-export.service";
import { PosReportsService, type ReportPreset } from "./pos-reports.service";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ymdInZurich(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDaysYmd(ymd: string, delta: number): string {
  const base = new Date(`${ymd}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + delta);
  return ymdInZurich(base);
}

function hourInZurich(d = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Zurich",
      hour: "2-digit",
      hour12: false,
    }).format(d)
  );
}

export function normalizeReportEmailSettings(
  raw: ReportEmailSettings | null | undefined
): ReportEmailSettings {
  const lang = raw?.language;
  const emails = Array.isArray(raw?.emails)
    ? [...new Set(raw!.emails!.map((e) => String(e || "").trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))]
    : [];
  return {
    language: lang === "fr" || lang === "de" || lang === "en" ? lang : "en",
    sendEveryDay: !!raw?.sendEveryDay,
    sendEveryMonth: !!raw?.sendEveryMonth,
    emails,
    lastSentDailyDate: raw?.lastSentDailyDate || null,
    lastSentMonthlyKey: raw?.lastSentMonthlyKey || null,
  };
}

const SUBJECTS: Record<string, { daily: string; monthly: string; manual: string }> = {
  en: {
    daily: "Daily sales report ù {{store}} ({{period}})",
    monthly: "Monthly sales report ù {{store}} ({{period}})",
    manual: "Sales report ù {{store}} ({{period}})",
  },
  fr: {
    daily: "Rapport de ventes quotidien ù {{store}} ({{period}})",
    monthly: "Rapport de ventes mensuel ù {{store}} ({{period}})",
    manual: "Rapport de ventes ù {{store}} ({{period}})",
  },
  de: {
    daily: "Tùglicher Verkaufsbericht ù {{store}} ({{period}})",
    monthly: "Monatlicher Verkaufsbericht ù {{store}} ({{period}})",
    manual: "Verkaufsbericht ù {{store}} ({{period}})",
  },
};

function fill(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v),
    template
  );
}

function htmlBody(
  lang: "en" | "fr" | "de",
  store: string,
  period: string,
  kpis: { totalSales: number; netSales: number; orders: number; customers: number }
) {
  const labels =
    lang === "fr"
      ? {
          title: "Rapport de ventes",
          total: "Ventes totales",
          net: "Ventes nettes",
          orders: "Commandes",
          customers: "Clients",
          attach: "Le rapport Excel est joint ù cet e-mail.",
        }
      : lang === "de"
        ? {
            title: "Verkaufsbericht",
            total: "Gesamtumsatz",
            net: "Nettoumsatz",
            orders: "Bestellungen",
            customers: "Kunden",
            attach: "Der Excel-Bericht ist diesem E-Mail beigefùgt.",
          }
        : {
            title: "Sales report",
            total: "Total sales",
            net: "Net sales",
            orders: "Orders",
            customers: "Customers",
            attach: "The Excel report is attached to this email.",
          };

  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;
  return `<div style="font-family:system-ui,sans-serif;max-width:560px">
  <h2 style="margin:0 0 8px">${labels.title}</h2>
  <p style="color:#555;margin:0 0 16px">${store} ù ${period}</p>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:8px;border-bottom:1px solid #eee">${labels.total}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${money(kpis.totalSales)}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee">${labels.net}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${money(kpis.netSales)}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee">${labels.orders}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${kpis.orders}</td></tr>
    <tr><td style="padding:8px">${labels.customers}</td><td style="padding:8px;text-align:right;font-weight:600">${kpis.customers}</td></tr>
  </table>
  <p style="color:#666;margin-top:16px;font-size:13px">${labels.attach}</p>
</div>`;
}

export class ReportEmailService {
  static normalize = normalizeReportEmailSettings;

  static async getSettings(merchantId: string): Promise<ReportEmailSettings> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { reportEmailSettings: true },
    });
    return normalizeReportEmailSettings(merchant?.reportEmailSettings);
  }

  static async saveSettings(
    merchantId: string,
    updates: Partial<ReportEmailSettings>
  ): Promise<ReportEmailSettings> {
    const current = await this.getSettings(merchantId);
    const next = normalizeReportEmailSettings({
      ...current,
      ...updates,
      // preserve internal send markers unless explicitly passed
      lastSentDailyDate:
        updates.lastSentDailyDate !== undefined
          ? updates.lastSentDailyDate
          : current.lastSentDailyDate,
      lastSentMonthlyKey:
        updates.lastSentMonthlyKey !== undefined
          ? updates.lastSentMonthlyKey
          : current.lastSentMonthlyKey,
    });
    const db = getDb();
    await db
      .update(schema.merchants)
      .set({ reportEmailSettings: next, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return next;
  }

  static async sendReportEmail(
    merchantId: string,
    opts: {
      preset?: ReportPreset;
      from?: string;
      to?: string;
      emails?: string[];
      kind?: "manual" | "daily" | "monthly";
      language?: "en" | "fr" | "de";
    }
  ) {
    const settings = await this.getSettings(merchantId);
    const emails = (opts.emails?.length ? opts.emails : settings.emails || [])
      .map((e) => String(e).trim().toLowerCase())
      .filter((e) => EMAIL_RE.test(e));
    if (!emails.length) {
      throw new Error("Add at least one recipient email in report settings");
    }

    const { buffer, filename, overview } = await ReportExportService.buildOverviewWorkbook(
      merchantId,
      {
        preset: opts.preset || "today",
        from: opts.from,
        to: opts.to,
      }
    );

    const lang = opts.language || settings.language || "en";
    const kind = opts.kind || "manual";
    const subjectTpl = SUBJECTS[lang]?.[kind] || SUBJECTS.en!.manual;
    const subject = fill(subjectTpl, {
      store: overview.businessName || "Store",
      period: overview.range.label,
    });
    const html = htmlBody(lang, overview.businessName || "Store", overview.range.label, {
      totalSales: overview.kpis.totalSales,
      netSales: overview.kpis.netSales,
      orders: overview.kpis.orders,
      customers: overview.kpis.customers,
    });

    let sent = 0;
    const errors: string[] = [];
    for (const to of emails) {
      try {
        await EmailService.send({
          to,
          subject,
          html,
          merchantId,
          attachments: [
            {
              filename,
              content: buffer,
              contentType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          ],
        });
        sent += 1;
      } catch (e) {
        errors.push(`${to}: ${e instanceof Error ? e.message : "send failed"}`);
      }
    }

    if (sent === 0) {
      throw new Error(errors[0] || "Failed to send report email");
    }

    return { sent, failed: errors.length, errors, period: overview.range.label, filename };
  }

  /**
   * Hourly job: after 23:00 Zurich, send yesterday's report for daily flag;
   * on day 1 after 06:00, send previous month for monthly flag.
   */
  static async processScheduledReports(): Promise<{ sent: number; merchants: number }> {
    const db = getDb();
    const merchants = await db.query.merchants.findMany({
      columns: {
        id: true,
        name: true,
        reportEmailSettings: true,
        status: true,
      },
    });

    const today = ymdInZurich();
    const hour = hourInZurich();
    let sent = 0;
    let touched = 0;

    for (const m of merchants) {
      if (m.status === "suspended") continue;
      const settings = normalizeReportEmailSettings(m.reportEmailSettings);
      if (!settings.emails?.length) continue;
      if (!settings.sendEveryDay && !settings.sendEveryMonth) continue;

      try {
        // Daily: after midnight Zurich (00ñ07), email yesterday's full-day report once.
        if (settings.sendEveryDay && hour < 8) {
          const yesterday = addDaysYmd(today, -1);
          if (settings.lastSentDailyDate !== yesterday) {
            await this.sendReportEmail(m.id, {
              preset: "custom",
              from: yesterday,
              to: yesterday,
              kind: "daily",
              language: settings.language,
            });
            await this.saveSettings(m.id, { lastSentDailyDate: yesterday });
            sent += 1;
            touched += 1;
          }
        }

        // Monthly: on the 1st (Zurich, from 06:00), email previous calendar month once.
        if (settings.sendEveryMonth) {
          const [y, mo] = today.split("-").map(Number);
          const dayNum = Number(today.slice(8, 10));
          if (dayNum === 1 && hour >= 6) {
            const prevMonth = mo === 1 ? 12 : mo! - 1;
            const prevYear = mo === 1 ? y! - 1 : y!;
            const monthKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
            if (settings.lastSentMonthlyKey !== monthKey) {
              const from = `${monthKey}-01`;
              const lastDay = new Date(Date.UTC(prevYear!, prevMonth!, 0)).getUTCDate();
              const to = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
              await this.sendReportEmail(m.id, {
                preset: "custom",
                from,
                to,
                kind: "monthly",
                language: settings.language,
              });
              await this.saveSettings(m.id, { lastSentMonthlyKey: monthKey });
              sent += 1;
              touched += 1;
            }
          }
        }
      } catch (error) {
        console.error(`[report-email] schedule failed for merchant ${m.id}`, error);
      }
    }

    return { sent, merchants: touched };
  }

  /** Convenience for overview KPIs without full export */
  static async peekOverview(
    merchantId: string,
    opts: { preset?: ReportPreset; from?: string; to?: string }
  ) {
    return PosReportsService.getOverviewDashboard(merchantId, opts);
  }
}
