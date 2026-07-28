import nodemailer from "nodemailer";
import axios from "axios";
import sgMail from "@sendgrid/mail";
import type { MerchantSmtpSettings } from "@/db/schema";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Optional merchant override for SMTP / from */
  merchantId?: string;
};

type EmailProvider = "smtp" | "brevo" | "sendgrid" | null;

type ResolvedEmailConfig = {
  provider: EmailProvider;
  apiKey: string;
  fromEmail: string;
  fromName: string;
  source: "merchant_smtp" | "database" | "env" | "none";
  smtp?: MerchantSmtpSettings | null;
};

/**
 * Prefer merchant SMTP when enabled, then platform Brevo, then env / SendGrid.
 */
export class EmailService {
  private static envBrevoApiKey() {
    return (
      process.env.BREVO_API_KEY ||
      process.env.SENDINBLUE_API_KEY ||
      process.env.SIB_API_KEY ||
      ""
    ).trim();
  }

  private static envFromAddress() {
    return (
      process.env.BREVO_FROM_EMAIL ||
      process.env.BREVO_SENDER_EMAIL ||
      process.env.SENDINBLUE_FROM_EMAIL ||
      process.env.FROM_EMAIL ||
      process.env.MAIL_FROM ||
      process.env.SENDGRID_FROM_EMAIL ||
      "noreply@chaslay.com"
    ).trim();
  }

  private static envFromName() {
    return (
      process.env.BREVO_FROM_NAME ||
      process.env.SENDINBLUE_FROM_NAME ||
      process.env.MAIL_FROM_NAME ||
      process.env.EMAIL_FROM_NAME ||
      "Chaslay"
    ).trim();
  }

  static async resolveConfig(merchantId?: string | null): Promise<ResolvedEmailConfig> {
    if (merchantId) {
      try {
        const { getDb, schema } = await import("@/db");
        const { eq } = await import("drizzle-orm");
        const db = getDb();
        const merchant = await db.query.merchants.findFirst({
          where: eq(schema.merchants.id, merchantId),
          columns: { emailSmtpSettings: true, name: true },
        });
        const smtp = merchant?.emailSmtpSettings || null;
        if (
          smtp?.enabled &&
          smtp.host &&
          smtp.fromEmail &&
          String(smtp.host).trim() &&
          String(smtp.fromEmail).trim()
        ) {
          return {
            provider: "smtp",
            apiKey: "",
            fromEmail: String(smtp.fromEmail).trim(),
            fromName: String(smtp.fromName || merchant?.name || "Shop").trim(),
            source: "merchant_smtp",
            smtp,
          };
        }
      } catch {
        /* continue to platform */
      }
    }

    let dbApiKey = "";
    let dbFromEmail = "";
    let dbFromName = "";

    try {
      const { PlatformSettingsService } = await import("@/services/platform-settings.service");
      const s = await PlatformSettingsService.getBrevoSettings();
      dbApiKey = (s.apiKey || "").trim();
      dbFromEmail = (s.fromEmail || "").trim();
      dbFromName = (s.fromName || "").trim();
    } catch {
      /* platform settings table may be unavailable */
    }

    const apiKey = dbApiKey || this.envBrevoApiKey();
    const fromEmail = dbFromEmail || this.envFromAddress();
    const fromName = dbFromName || this.envFromName();
    const source: ResolvedEmailConfig["source"] = dbApiKey
      ? "database"
      : this.envBrevoApiKey() || process.env.SENDGRID_API_KEY
        ? "env"
        : "none";

    if (apiKey && fromEmail) {
      return { provider: "brevo", apiKey, fromEmail, fromName, source };
    }

    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
      return {
        provider: "sendgrid",
        apiKey: process.env.SENDGRID_API_KEY,
        fromEmail: process.env.SENDGRID_FROM_EMAIL,
        fromName: fromName || "Chaslay",
        source: dbApiKey ? "database" : "env",
      };
    }

    return { provider: null, apiKey: "", fromEmail, fromName, source: "none" };
  }

  static async isConfigured(merchantId?: string | null) {
    const cfg = await this.resolveConfig(merchantId);
    return cfg.provider !== null;
  }

  static async status(merchantId?: string | null) {
    const cfg = await this.resolveConfig(merchantId);
    let apiKeyMasked = "";
    let apiKeySet = false;
    try {
      const { PlatformSettingsService } = await import("@/services/platform-settings.service");
      const pub = await PlatformSettingsService.getBrevoSettingsPublic();
      apiKeyMasked = pub.apiKeyMasked;
      apiKeySet = pub.apiKeySet;
    } catch {
      apiKeySet = !!(cfg.apiKey || this.envBrevoApiKey() || process.env.SENDGRID_API_KEY);
    }

    return {
      configured: cfg.provider !== null,
      provider: cfg.provider,
      fromEmail: cfg.fromEmail,
      fromName: cfg.fromName,
      source: cfg.source,
      apiKeySet,
      apiKeyMasked,
      brevoKeySet: cfg.provider === "brevo" || !!this.envBrevoApiKey() || apiKeySet,
      sendgridKeySet: !!process.env.SENDGRID_API_KEY,
      smtpEnabled: cfg.provider === "smtp",
    };
  }

  static async send(input: SendEmailInput) {
    const cfg = await this.resolveConfig(input.merchantId);
    if (!cfg.provider) {
      throw new Error(
        "Email is not configured. Add SMTP in Settings → Email, or platform Brevo (BREVO_API_KEY)."
      );
    }

    if (cfg.provider === "smtp") {
      await this.sendViaSmtp(cfg, input);
      return;
    }

    if (cfg.provider === "brevo") {
      await this.sendViaBrevo(cfg, input);
      return;
    }

    sgMail.setApiKey(cfg.apiKey);
    await sgMail.send({
      to: input.to,
      from: cfg.fromEmail,
      subject: input.subject,
      html: input.html,
      text: input.text || input.html.replace(/<[^>]+>/g, " "),
    });
  }

  private static async sendViaSmtp(cfg: ResolvedEmailConfig, input: SendEmailInput) {
    const smtp = cfg.smtp || {};
    const port = Number(smtp.port) || (smtp.secure ? 465 : 587);
    const transporter = nodemailer.createTransport({
      host: String(smtp.host || "").trim(),
      port,
      secure: !!smtp.secure || port === 465,
      auth:
        smtp.user || smtp.password
          ? {
              user: String(smtp.user || "").trim(),
              pass: String(smtp.password || ""),
            }
          : undefined,
    });

    await transporter.sendMail({
      from: `"${cfg.fromName || "Shop"}" <${cfg.fromEmail}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text || input.html.replace(/<[^>]+>/g, " "),
    });
  }

  private static async sendViaBrevo(cfg: ResolvedEmailConfig, input: SendEmailInput) {
    try {
      await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        {
          sender: {
            name: cfg.fromName || "Chaslay",
            email: cfg.fromEmail,
          },
          to: [{ email: input.to }],
          subject: input.subject,
          htmlContent: input.html,
          textContent: input.text || input.html.replace(/<[^>]+>/g, " "),
        },
        {
          headers: {
            "api-key": cfg.apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 20000,
        }
      );
    } catch (error: any) {
      const detail =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        (typeof error?.response?.data === "string" ? error.response.data : null) ||
        error?.message ||
        "Brevo send failed";
      throw new Error(typeof detail === "string" ? detail : "Brevo send failed");
    }
  }
}
