import axios from "axios";
import sgMail from "@sendgrid/mail";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type EmailProvider = "brevo" | "sendgrid" | null;

/**
 * Prefer Brevo (already used across Chaslay environments), fall back to SendGrid.
 * Accepted env aliases:
 *   BREVO_API_KEY | SENDINBLUE_API_KEY | SIB_API_KEY
 *   BREVO_FROM_EMAIL | BREVO_SENDER_EMAIL | SENDINBLUE_FROM_EMAIL | FROM_EMAIL | MAIL_FROM
 *   BREVO_FROM_NAME | SENDINBLUE_FROM_NAME | MAIL_FROM_NAME
 *   SENDGRID_API_KEY + SENDGRID_FROM_EMAIL
 */
export class EmailService {
  static brevoApiKey() {
    return (
      process.env.BREVO_API_KEY ||
      process.env.SENDINBLUE_API_KEY ||
      process.env.SIB_API_KEY ||
      ""
    ).trim();
  }

  static fromAddress() {
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

  static fromName() {
    return (
      process.env.BREVO_FROM_NAME ||
      process.env.SENDINBLUE_FROM_NAME ||
      process.env.MAIL_FROM_NAME ||
      process.env.EMAIL_FROM_NAME ||
      "Chaslay"
    ).trim();
  }

  static provider(): EmailProvider {
    if (this.brevoApiKey() && this.fromAddress()) return "brevo";
    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) return "sendgrid";
    return null;
  }

  static isConfigured() {
    return this.provider() !== null;
  }

  static status() {
    const provider = this.provider();
    return {
      configured: provider !== null,
      provider,
      fromEmail: this.fromAddress(),
      fromName: this.fromName(),
      brevoKeySet: !!this.brevoApiKey(),
      sendgridKeySet: !!process.env.SENDGRID_API_KEY,
    };
  }

  static async send(input: SendEmailInput) {
    const provider = this.provider();
    if (!provider) {
      throw new Error(
        "Email is not configured. Set BREVO_API_KEY (or SENDINBLUE_API_KEY) and BREVO_FROM_EMAIL on the server."
      );
    }

    if (provider === "brevo") {
      await this.sendViaBrevo(input);
      return;
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
    await sgMail.send({
      to: input.to,
      from: this.fromAddress(),
      subject: input.subject,
      html: input.html,
      text: input.text || input.html.replace(/<[^>]+>/g, " "),
    });
  }

  private static async sendViaBrevo(input: SendEmailInput) {
    try {
      await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        {
          sender: {
            name: this.fromName(),
            email: this.fromAddress(),
          },
          to: [{ email: input.to }],
          subject: input.subject,
          htmlContent: input.html,
          textContent: input.text || input.html.replace(/<[^>]+>/g, " "),
        },
        {
          headers: {
            "api-key": this.brevoApiKey(),
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
