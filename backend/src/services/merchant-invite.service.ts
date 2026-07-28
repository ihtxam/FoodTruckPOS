import crypto from "crypto";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AuthService } from "@/services/auth.service";
import { EmailService } from "@/services/email.service";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicAppBase() {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.MERCHANT_DASHBOARD_URL ||
    process.env.SUPERADMIN_URL ||
    "https://app.chaslay.com"
  ).replace(/\/$/, "");
}

export class MerchantInviteService {
  static buildInviteUrl(token: string) {
    return `${publicAppBase()}/set-password?token=${encodeURIComponent(token)}`;
  }

  /**
   * Create a fresh invite token for a merchant. Returns raw token (show once / email once).
   */
  static async createInviteToken(merchantId: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await db
      .update(schema.merchants)
      .set({
        inviteTokenHash: hashToken(token),
        inviteTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchantId));

    return {
      token,
      expiresAt,
      inviteUrl: this.buildInviteUrl(token),
      merchant,
    };
  }

  static async sendInviteEmail(merchantId: string) {
    const { token, expiresAt, inviteUrl, merchant } = await this.createInviteToken(merchantId);

    const subject = `Set up your ${merchant.name} merchant account`;
    const html = `
      <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
        <h2 style="margin: 0 0 12px;">Welcome to your merchant panel</h2>
        <p>Hi,</p>
        <p>
          An account was created for <strong>${escapeHtml(merchant.name)}</strong>
          (${escapeHtml(merchant.email)}).
        </p>
        <p>Click the button below to create your password and sign in:</p>
        <p style="margin: 24px 0;">
          <a href="${inviteUrl}"
             style="background:#0f172a;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;display:inline-block;">
            Create password
          </a>
        </p>
        <p style="font-size: 13px; color: #555;">
          Or open this link:<br/>
          <a href="${inviteUrl}">${inviteUrl}</a>
        </p>
        <p style="font-size: 13px; color: #555;">
          This link expires on ${expiresAt.toUTCString()}.
        </p>
      </div>
    `;

    let emailed = false;
    let emailError: string | undefined;

    if (await EmailService.isConfigured()) {
      try {
        await EmailService.send({
          to: merchant.email,
          subject,
          html,
          text: `Create your password: ${inviteUrl}`,
        });
        emailed = true;
      } catch (error) {
        emailError = error instanceof Error ? error.message : "Failed to send email";
        console.error("Invite email send failed:", error);
      }
    } else {
      emailError =
        "Email is not configured. Add Brevo in Superadmin → Settings (or BREVO_API_KEY / BREVO_FROM_EMAIL). Copy the invite link instead.";
      console.warn(`Invite email skipped (Brevo/SendGrid not configured). Link: ${inviteUrl}`);
    }

    const db = getDb();
    if (emailed) {
      await db
        .update(schema.merchants)
        .set({ inviteSentAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.merchants.id, merchantId));
    }

    return {
      emailed,
      emailError,
      inviteUrl,
      expiresAt,
      email: merchant.email,
      merchantName: merchant.name,
    };
  }

  static async getInvitePreview(token: string) {
    const merchant = await this.findByInviteToken(token);
    if (!merchant) throw new Error("Invalid or expired invite link");
    return {
      email: merchant.email,
      name: merchant.name,
      expiresAt: merchant.inviteTokenExpiresAt,
    };
  }

  static async acceptInvite(token: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const merchant = await this.findByInviteToken(token);
    if (!merchant) throw new Error("Invalid or expired invite link");

    const passwordHash = await AuthService.hashPassword(newPassword);
    const db = getDb();

    await db
      .update(schema.merchants)
      .set({
        passwordHash,
        passwordSetAt: new Date(),
        inviteTokenHash: null,
        inviteTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchant.id));

    return {
      email: merchant.email,
      name: merchant.name,
      id: merchant.id,
    };
  }

  private static async findByInviteToken(token: string) {
    if (!token || token.length < 20) return null;
    const db = getDb();
    const now = new Date();
    return (
      (await db.query.merchants.findFirst({
        where: and(
          eq(schema.merchants.inviteTokenHash, hashToken(token)),
          isNotNull(schema.merchants.inviteTokenExpiresAt),
          gt(schema.merchants.inviteTokenExpiresAt, now)
        ),
      })) || null
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
