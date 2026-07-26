import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export const PLATFORM_ADYEN_KEYS = {
  apiKey: "adyen_api_key",
  merchantAccount: "adyen_merchant_account",
  clientKey: "adyen_client_key",
  environment: "adyen_environment",
  hmacKey: "adyen_hmac_key",
} as const;

export const PLATFORM_BREVO_KEYS = {
  apiKey: "brevo_api_key",
  fromEmail: "brevo_from_email",
  fromName: "brevo_from_name",
} as const;

export type PlatformAdyenSettings = {
  apiKey?: string | null;
  merchantAccount?: string | null;
  clientKey?: string | null;
  environment?: "TEST" | "LIVE" | string | null;
  hmacKey?: string | null;
};

function maskSecret(value?: string | null) {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export class PlatformSettingsService {
  static async get(key: string): Promise<string | null> {
    const db = getDb();
    const row = await db.query.platformSettings.findFirst({
      where: eq(schema.platformSettings.key, key),
    });
    return row?.value ?? null;
  }

  static async set(key: string, value: string | null | undefined) {
    const db = getDb();
    const normalized = value === undefined || value === null ? null : String(value);
    await db
      .insert(schema.platformSettings)
      .values({ key, value: normalized, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.platformSettings.key,
        set: { value: normalized, updatedAt: new Date() },
      });
  }

  static async getMany(keys: string[]) {
    const out: Record<string, string | null> = {};
    for (const key of keys) {
      out[key] = await this.get(key);
    }
    return out;
  }

  static async getAdyenSettings(): Promise<PlatformAdyenSettings> {
    const rows = await this.getMany(Object.values(PLATFORM_ADYEN_KEYS));
    return {
      apiKey: rows[PLATFORM_ADYEN_KEYS.apiKey],
      merchantAccount: rows[PLATFORM_ADYEN_KEYS.merchantAccount],
      clientKey: rows[PLATFORM_ADYEN_KEYS.clientKey],
      environment: rows[PLATFORM_ADYEN_KEYS.environment] || "TEST",
      hmacKey: rows[PLATFORM_ADYEN_KEYS.hmacKey],
    };
  }

  /** Public/safe view for superadmin UI (secrets masked) */
  static async getAdyenSettingsPublic() {
    const s = await this.getAdyenSettings();
    const envFallback =
      !s.apiKey &&
      !!(process.env.PLATFORM_ADYEN_API_KEY || process.env.ADYEN_API_KEY);
    return {
      merchantAccount:
        s.merchantAccount ||
        process.env.PLATFORM_ADYEN_MERCHANT_ACCOUNT ||
        process.env.ADYEN_MERCHANT_ACCOUNT ||
        "",
      clientKey:
        s.clientKey ||
        process.env.PLATFORM_ADYEN_CLIENT_KEY ||
        process.env.ADYEN_CLIENT_ID ||
        "",
      environment: (s.environment || process.env.PLATFORM_ADYEN_ENVIRONMENT || "TEST").toUpperCase(),
      apiKeyMasked: maskSecret(s.apiKey || process.env.PLATFORM_ADYEN_API_KEY || process.env.ADYEN_API_KEY),
      apiKeySet: !!(s.apiKey || process.env.PLATFORM_ADYEN_API_KEY || process.env.ADYEN_API_KEY),
      hmacKeyMasked: maskSecret(s.hmacKey || process.env.PLATFORM_ADYEN_HMAC_KEY),
      hmacKeySet: !!(s.hmacKey || process.env.PLATFORM_ADYEN_HMAC_KEY),
      usingEnvFallback: envFallback && !s.apiKey,
      configured: !!(
        (s.apiKey || process.env.PLATFORM_ADYEN_API_KEY || process.env.ADYEN_API_KEY) &&
        (s.merchantAccount ||
          process.env.PLATFORM_ADYEN_MERCHANT_ACCOUNT ||
          process.env.ADYEN_MERCHANT_ACCOUNT) &&
        (s.clientKey || process.env.PLATFORM_ADYEN_CLIENT_KEY || process.env.ADYEN_CLIENT_ID)
      ),
    };
  }

  static async updateAdyenSettings(input: {
    apiKey?: string;
    merchantAccount?: string;
    clientKey?: string;
    environment?: string;
    hmacKey?: string;
  }) {
    if (input.merchantAccount !== undefined) {
      await this.set(PLATFORM_ADYEN_KEYS.merchantAccount, input.merchantAccount.trim() || null);
    }
    if (input.clientKey !== undefined) {
      await this.set(PLATFORM_ADYEN_KEYS.clientKey, input.clientKey.trim() || null);
    }
    if (input.environment !== undefined) {
      const env = input.environment.toUpperCase() === "LIVE" ? "LIVE" : "TEST";
      await this.set(PLATFORM_ADYEN_KEYS.environment, env);
    }
    if (input.apiKey !== undefined && input.apiKey.trim() && !input.apiKey.includes("••••")) {
      await this.set(PLATFORM_ADYEN_KEYS.apiKey, input.apiKey.trim());
    }
    if (input.hmacKey !== undefined && input.hmacKey.trim() && !input.hmacKey.includes("••••")) {
      await this.set(PLATFORM_ADYEN_KEYS.hmacKey, input.hmacKey.trim());
    }
    return this.getAdyenSettingsPublic();
  }

  static async getBrevoSettings() {
    const rows = await this.getMany(Object.values(PLATFORM_BREVO_KEYS));
    return {
      apiKey: rows[PLATFORM_BREVO_KEYS.apiKey],
      fromEmail: rows[PLATFORM_BREVO_KEYS.fromEmail],
      fromName: rows[PLATFORM_BREVO_KEYS.fromName],
    };
  }

  static async getBrevoSettingsPublic() {
    const s = await this.getBrevoSettings();
    const envKey =
      process.env.BREVO_API_KEY ||
      process.env.SENDINBLUE_API_KEY ||
      process.env.SIB_API_KEY ||
      "";
    const envFrom =
      process.env.BREVO_FROM_EMAIL ||
      process.env.BREVO_SENDER_EMAIL ||
      process.env.SENDINBLUE_FROM_EMAIL ||
      process.env.FROM_EMAIL ||
      process.env.MAIL_FROM ||
      "";
    const envName = process.env.BREVO_FROM_NAME || process.env.SENDINBLUE_FROM_NAME || "Chaslay";
    const apiKey = s.apiKey || envKey;
    const fromEmail = s.fromEmail || envFrom;
    return {
      fromEmail: fromEmail || "",
      fromName: s.fromName || envName,
      apiKeyMasked: maskSecret(apiKey),
      apiKeySet: !!apiKey,
      usingEnvFallback: !s.apiKey && !!envKey,
      configured: !!(apiKey && fromEmail),
      provider: apiKey && fromEmail ? "brevo" : null,
    };
  }

  static async updateBrevoSettings(input: {
    apiKey?: string;
    fromEmail?: string;
    fromName?: string;
  }) {
    if (input.fromEmail !== undefined) {
      await this.set(PLATFORM_BREVO_KEYS.fromEmail, input.fromEmail.trim() || null);
    }
    if (input.fromName !== undefined) {
      await this.set(PLATFORM_BREVO_KEYS.fromName, input.fromName.trim() || null);
    }
    if (input.apiKey !== undefined && input.apiKey.trim() && !input.apiKey.includes("••••")) {
      await this.set(PLATFORM_BREVO_KEYS.apiKey, input.apiKey.trim());
    }
    return this.getBrevoSettingsPublic();
  }

  /**
   * Resolve platform Adyen credentials for subscription checkout.
   * DB platform settings → PLATFORM_ADYEN_* env → ADYEN_* env.
   */
  static async resolvePlatformAdyenCredentials() {
    const s = await this.getAdyenSettings();
    const apiKey =
      s.apiKey || process.env.PLATFORM_ADYEN_API_KEY || process.env.ADYEN_API_KEY || "";
    const merchantAccount =
      s.merchantAccount ||
      process.env.PLATFORM_ADYEN_MERCHANT_ACCOUNT ||
      process.env.ADYEN_MERCHANT_ACCOUNT ||
      "";
    const clientKey =
      s.clientKey || process.env.PLATFORM_ADYEN_CLIENT_KEY || process.env.ADYEN_CLIENT_ID || "";
    const environment = (
      s.environment ||
      process.env.PLATFORM_ADYEN_ENVIRONMENT ||
      "TEST"
    ).toUpperCase();
    const hmacKey = s.hmacKey || process.env.PLATFORM_ADYEN_HMAC_KEY || "";

    if (!apiKey || !merchantAccount) {
      throw new Error(
        "Platform Adyen is not configured. Set it in Superadmin → Settings → Payment (Adyen)."
      );
    }

    const apiBase =
      environment === "LIVE"
        ? process.env.PLATFORM_ADYEN_API_BASE ||
          process.env.ADYEN_API_BASE_LIVE ||
          "https://checkout-live.adyen.com/v71"
        : process.env.PLATFORM_ADYEN_API_BASE ||
          process.env.ADYEN_API_BASE ||
          "https://checkout-test.adyen.com/v71";

    return {
      apiKey,
      merchantAccount,
      clientKey,
      environment: environment === "LIVE" ? "LIVE" : "TEST",
      hmacKey,
      apiBase,
    };
  }
}
