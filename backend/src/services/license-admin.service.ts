import crypto from "crypto";
import { getDb, schema } from "@/db";
import { eq, and, desc, lt, gt, asc } from "drizzle-orm";
import { LicensingService } from "./licensing.service";
import {
  deriveShortDeviceId,
  normalizeChaslayDeviceId,
} from "./chaslay-compat.service";

function formatActivationCode(): string {
  const raw = crypto.randomBytes(6).toString("hex").toUpperCase();
  return raw.match(/.{1,4}/g)?.join("-") ?? raw;
}

export class LicenseAdminService {
  /**
   * Issue a license bound to the Android POS device ID shown in the app.
   * Matches legacy Chaslay admin flow: copy device ID → generate code for that device.
   */
  static async issueForPosDeviceId(
    merchantId: string,
    posDeviceId: string,
    licenseType: "trial" | "yearly" | "custom" = "yearly",
    customDays?: number,
    deviceType: string = "tablet"
  ) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const trimmed = String(posDeviceId || "").trim();
    if (!trimmed) throw new Error("POS device ID is required");

    const normalized =
      normalizeChaslayDeviceId(trimmed) || deriveShortDeviceId(trimmed);
    if (!normalized) throw new Error("Invalid POS device ID");

    let device = await db.query.devices.findFirst({
      where: and(
        eq(schema.devices.merchantId, merchantId),
        eq(schema.devices.deviceId, normalized)
      ),
      with: { licenses: true },
    });

    if (!device) {
      // Also match if stored under derived short form of a longer id
      const all = await db.query.devices.findMany({
        where: eq(schema.devices.merchantId, merchantId),
        with: { licenses: true },
      });
      device =
        all.find(
          (d) =>
            normalizeChaslayDeviceId(d.deviceId) === normalized ||
            deriveShortDeviceId(d.deviceId) === normalized
        ) || undefined;
    }

    if (!device) {
      const inserted = await db
        .insert(schema.devices)
        .values({
          merchantId,
          deviceId: normalized,
          deviceName: `POS ${normalized}`,
          deviceType,
          isActive: true,
        })
        .returning();
      device = { ...inserted[0]!, licenses: [] };
    }

    const existingActive = (device.licenses || []).find(
      (l) => l.status === "active" && l.expiresAt > new Date()
    );
    if (existingActive) {
      return {
        deviceId: device.id,
        externalDeviceId: device.deviceId,
        deviceName: device.deviceName,
        licenseKey: existingActive.licenseKey,
        expiresAt: existingActive.expiresAt,
        licenseId: existingActive.id,
        reused: true,
      };
    }

    const now = new Date();
    let expiresAt: Date;
    if (licenseType === "trial") {
      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (licenseType === "custom" && customDays) {
      expiresAt = new Date(now.getTime() + customDays * 24 * 60 * 60 * 1000);
    } else {
      expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    }

    // Chaslay-style short activation code (easier to type on tablet)
    let licenseKey = formatActivationCode();
    for (let i = 0; i < 5; i++) {
      const taken = await db.query.licenses.findFirst({
        where: eq(schema.licenses.licenseKey, licenseKey),
      });
      if (!taken) break;
      licenseKey = formatActivationCode();
    }

    const license = await db
      .insert(schema.licenses)
      .values({
        merchantId,
        deviceId: device.id,
        licenseKey,
        licenseType,
        startsAt: now,
        expiresAt,
        status: "active",
      })
      .returning();

    await db
      .update(schema.merchants)
      .set({ status: "active", subscriptionEndsAt: expiresAt, updatedAt: now })
      .where(eq(schema.merchants.id, merchantId));

    return {
      deviceId: device.id,
      externalDeviceId: normalized,
      deviceName: device.deviceName,
      licenseKey,
      expiresAt,
      licenseId: license[0]!.id,
      reused: false,
    };
  }

  /**
   * Issue N device seats for a merchant (creates placeholder devices + license keys).
   * POS devices activate/bind using these license codes.
   */
  static async issueDeviceSeats(
    merchantId: string,
    seats: number = 1,
    licenseType: "trial" | "yearly" | "custom" = "yearly",
    customDays?: number,
    deviceType: string = "tablet"
  ) {
    const db = getDb();
    const count = Math.max(1, Math.min(20, seats));
    const issued: Array<{
      deviceId: string;
      deviceName: string;
      licenseKey: string;
      expiresAt: Date;
      licenseId: string;
    }> = [];

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) {
      throw new Error("Merchant not found");
    }

    for (let i = 0; i < count; i++) {
      const externalDeviceId = LicensingService.generateDeviceId(merchantId);
      const deviceName = `POS Seat ${Date.now().toString(36).slice(-4).toUpperCase()}-${i + 1}`;

      const device = await db
        .insert(schema.devices)
        .values({
          merchantId,
          deviceId: externalDeviceId,
          deviceName,
          deviceType,
          isActive: true,
        })
        .returning();

      const result = await this.generateLicenseForMerchant(
        merchantId,
        device[0].id,
        licenseType,
        customDays
      );

      issued.push({
        deviceId: device[0].id,
        deviceName,
        licenseKey: result.licenseCode,
        expiresAt: result.license.expiresAt,
        licenseId: result.license.id,
      });
    }

    return issued;
  }

  /**
   * List devices for a merchant (for license assignment UI)
   */
  static async getMerchantDevices(merchantId: string) {
    const db = getDb();
    return db.query.devices.findMany({
      where: eq(schema.devices.merchantId, merchantId),
      with: { licenses: true },
      orderBy: desc(schema.devices.createdAt),
    });
  }

  /**
   * Generate and issue license code to merchant
   */
  static async generateLicenseForMerchant(
    merchantId: string,
    deviceId: string,
    licenseType: "trial" | "yearly" | "custom" = "yearly",
    customDays?: number
  ) {
    const db = getDb();

    try {
      // Get device
      const device = await db.query.devices.findFirst({
        where: and(
          eq(schema.devices.id, deviceId),
          eq(schema.devices.merchantId, merchantId)
        ),
      });

      if (!device) {
        throw new Error("Device not found for this merchant");
      }

      // Calculate expiry date
      const now = new Date();
      let expiresAt: Date;

      if (licenseType === "trial") {
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (licenseType === "custom" && customDays) {
        expiresAt = new Date(now.getTime() + customDays * 24 * 60 * 60 * 1000);
      } else {
        // yearly
        expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      }

      // Generate license code
      const licenseKey = LicensingService.generateLicenseCode(
        merchantId,
        device.deviceId,
        expiresAt.getFullYear()
      );

      // Create license
      const license = await db
        .insert(schema.licenses)
        .values({
          merchantId,
          deviceId: device.id,
          licenseKey,
          licenseType,
          startsAt: now,
          expiresAt,
          status: "active",
        })
        .returning();

      // Update merchant subscription if needed
      if (licenseType === "yearly" || licenseType === "custom") {
        await db
          .update(schema.merchants)
          .set({
            status: "active",
            subscriptionEndsAt: expiresAt,
          })
          .where(eq(schema.merchants.id, merchantId));
      }

      return {
        success: true,
        license: license[0],
        licenseCode: licenseKey,
      };
    } catch (error) {
      console.error("Error generating license:", error);
      throw error;
    }
  }

  /**
   * Get all licenses with filters
   */
  static async getAllLicenses(
    page: number = 1,
    limit: number = 20,
    status?: string,
    merchantId?: string
  ) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;
      let whereConditions: any[] = [];

      if (status) {
        whereConditions.push(eq(schema.licenses.status, status));
      }

      if (merchantId) {
        whereConditions.push(eq(schema.licenses.merchantId, merchantId));
      }

      const licenses = await db.query.licenses.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
        with: {
          merchant: true,
          device: true,
        },
        limit,
        offset,
        orderBy: desc(schema.licenses.createdAt),
      });

      return licenses;
    } catch (error) {
      console.error("Error getting licenses:", error);
      throw error;
    }
  }

  /**
   * Get license details
   */
  static async getLicenseDetails(licenseId: string) {
    const db = getDb();

    try {
      const license = await db.query.licenses.findFirst({
        where: eq(schema.licenses.id, licenseId),
        with: {
          merchant: true,
          device: true,
        },
      });

      if (!license) {
        throw new Error("License not found");
      }

      return license;
    } catch (error) {
      console.error("Error getting license details:", error);
      throw error;
    }
  }

  /**
   * Revoke license
   */
  static async revokeLicense(licenseId: string) {
    const db = getDb();

    try {
      const license = await db
        .update(schema.licenses)
        .set({
          status: "suspended",
          updatedAt: new Date(),
        })
        .where(eq(schema.licenses.id, licenseId))
        .returning();

      return license[0];
    } catch (error) {
      console.error("Error revoking license:", error);
      throw error;
    }
  }

  /**
   * Extend license expiry
   */
  static async extendLicense(licenseId: string, additionalDays: number) {
    const db = getDb();

    try {
      const license = await db.query.licenses.findFirst({
        where: eq(schema.licenses.id, licenseId),
      });

      if (!license) {
        throw new Error("License not found");
      }

      const newExpiryDate = new Date(license.expiresAt.getTime() + additionalDays * 24 * 60 * 60 * 1000);

      const updatedLicense = await db
        .update(schema.licenses)
        .set({
          expiresAt: newExpiryDate,
          updatedAt: new Date(),
        })
        .where(eq(schema.licenses.id, licenseId))
        .returning();

      return updatedLicense[0];
    } catch (error) {
      console.error("Error extending license:", error);
      throw error;
    }
  }

  /**
   * Get license statistics
   */
  static async getLicenseStatistics() {
    const db = getDb();

    try {
      const now = new Date();

      const licenses = await db.query.licenses.findMany();

      const stats = {
        total: licenses.length,
        active: licenses.filter((l) => l.status === "active").length,
        expired: licenses.filter((l) => l.status === "expired").length,
        suspended: licenses.filter((l) => l.status === "suspended").length,
        expiringIn30Days: licenses.filter(
          (l) =>
            l.status === "active" &&
            l.expiresAt > now &&
            l.expiresAt <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        ).length,
        trial: licenses.filter((l) => l.licenseType === "trial").length,
        yearly: licenses.filter((l) => l.licenseType === "yearly").length,
      };

      return stats;
    } catch (error) {
      console.error("Error getting license statistics:", error);
      throw error;
    }
  }

  /**
   * Bulk generate licenses for multiple merchants
   */
  static async bulkGenerateLicenses(
    merchantIds: string[],
    licenseType: "trial" | "yearly" = "yearly"
  ) {
    const db = getDb();

    try {
      const results = [];

      for (const merchantId of merchantIds) {
        // Get first device for merchant
        const device = await db.query.devices.findFirst({
          where: eq(schema.devices.merchantId, merchantId),
        });

        if (device) {
          const result = await this.generateLicenseForMerchant(merchantId, device.id, licenseType);
          results.push({
            merchantId,
            success: true,
            licenseCode: result.licenseCode,
          });
        } else {
          results.push({
            merchantId,
            success: false,
            error: "No device found for merchant",
          });
        }
      }

      return results;
    } catch (error) {
      console.error("Error bulk generating licenses:", error);
      throw error;
    }
  }

  /**
   * Get licenses expiring soon
   */
  static async getLicensesExpiringSoon(daysThreshold: number = 35) {
    const db = getDb();

    try {
      const now = new Date();
      const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

      const licenses = await db.query.licenses.findMany({
        where: and(
          eq(schema.licenses.status, "active"),
          lt(schema.licenses.expiresAt, thresholdDate),
          gt(schema.licenses.expiresAt, now)
        ),
        with: {
          merchant: true,
          device: true,
        },
        orderBy: asc(schema.licenses.expiresAt),
      });

      return licenses.map((l) => ({
        license: l,
        daysRemaining: Math.ceil((l.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      }));
    } catch (error) {
      console.error("Error getting licenses expiring soon:", error);
      throw error;
    }
  }
}
