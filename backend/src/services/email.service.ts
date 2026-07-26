import sgMail from "@sendgrid/mail";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export class EmailService {
  static isConfigured() {
    return !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
  }

  static fromAddress() {
    return process.env.SENDGRID_FROM_EMAIL || "noreply@chaslay.com";
  }

  static async send(input: SendEmailInput) {
    if (!this.isConfigured()) {
      throw new Error(
        "Email is not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL on the server."
      );
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
}
