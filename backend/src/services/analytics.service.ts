import { getDb, schema } from "@/db";
import { eq, and, gte, lte } from "drizzle-orm";

export class AnalyticsService {
  /**
   * Get platform overview statistics
   */
  static async getPlatformOverview() {
    const db = getDb();

    try {
      // Get merchant counts
      const merchants = await db.query.merchants.findMany();
      const activeMerchants = merchants.filter((m) => m.status === "active").length;
      const trialMerchants = merchants.filter((m) => m.status === "trial").length;
      const suspendedMerchants = merchants.filter((m) => m.status === "suspended").length;

      // Get license statistics
      const licenses = await db.query.licenses.findMany();
      const activeLicenses = licenses.filter((l) => l.status === "active").length;
      const expiredLicenses = licenses.filter((l) => l.status === "expired").length;

      // Get device count
      const devices = await db.query.devices.findMany();

      // Get order statistics
      const orders = await db.query.orders.findMany();
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);

      return {
        merchants: {
          total: merchants.length,
          active: activeMerchants,
          trial: trialMerchants,
          suspended: suspendedMerchants,
        },
        licenses: {
          total: licenses.length,
          active: activeLicenses,
          expired: expiredLicenses,
        },
        devices: {
          total: devices.length,
          active: devices.filter((d) => d.isActive).length,
        },
        orders: {
          total: totalOrders,
          totalRevenue,
          averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        },
      };
    } catch (error) {
      console.error("Error getting platform overview:", error);
      throw error;
    }
  }

  /**
   * Get revenue analytics
   */
  static async getRevenueAnalytics(startDate?: Date, endDate?: Date) {
    const db = getDb();

    try {
      let orders = await db.query.orders.findMany();

      if (startDate && endDate) {
        orders = orders.filter(
          (o) => o.createdAt >= startDate && o.createdAt <= endDate
        );
      }

      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);
      const totalTax = orders.reduce((sum, order) => sum + parseFloat(order.taxAmount.toString()), 0);
      const totalDiscount = orders.reduce((sum, order) => sum + parseFloat(order.discountAmount.toString()), 0);

      // Revenue by payment method
      const revenueByPaymentMethod: Record<string, number> = {};
      orders.forEach((order) => {
        const method = order.paymentMethod || "unknown";
        revenueByPaymentMethod[method] = (revenueByPaymentMethod[method] || 0) + parseFloat(order.total.toString());
      });

      // Revenue by order type
      const revenueByOrderType: Record<string, number> = {};
      orders.forEach((order) => {
        const type = order.orderType;
        revenueByOrderType[type] = (revenueByOrderType[type] || 0) + parseFloat(order.total.toString());
      });

      return {
        period: {
          startDate: startDate || new Date(new Date().getFullYear(), 0, 1),
          endDate: endDate || new Date(),
        },
        summary: {
          totalRevenue,
          totalTax,
          totalDiscount,
          orderCount: orders.length,
          averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
        },
        breakdown: {
          byPaymentMethod: revenueByPaymentMethod,
          byOrderType: revenueByOrderType,
        },
      };
    } catch (error) {
      console.error("Error getting revenue analytics:", error);
      throw error;
    }
  }

  /**
   * Get merchant growth analytics
   */
  static async getMerchantGrowthAnalytics(months: number = 12) {
    const db = getDb();

    try {
      const merchants = await db.query.merchants.findMany();

      const monthlyGrowth: Record<string, number> = {};

      // Initialize months
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().substring(0, 7); // YYYY-MM
        monthlyGrowth[monthKey] = 0;
      }

      // Count merchants created in each month
      merchants.forEach((merchant) => {
        const monthKey = merchant.createdAt.toISOString().substring(0, 7);
        if (monthlyGrowth.hasOwnProperty(monthKey)) {
          monthlyGrowth[monthKey]++;
        }
      });

      return {
        period: `Last ${months} months`,
        monthlyGrowth,
        totalMerchants: merchants.length,
      };
    } catch (error) {
      console.error("Error getting merchant growth analytics:", error);
      throw error;
    }
  }

  /**
   * Get top merchants by revenue
   */
  static async getTopMerchantsByRevenue(limit: number = 10) {
    const db = getDb();

    try {
      const merchants = await db.query.merchants.findMany({
        with: {
          orders: true,
        },
      });

      const merchantRevenue = merchants.map((merchant) => {
        const revenue = merchant.orders.reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);
        return {
          merchant: {
            id: merchant.id,
            name: merchant.name,
            email: merchant.email,
          },
          revenue,
          orderCount: merchant.orders.length,
        };
      });

      return merchantRevenue.sort((a, b) => b.revenue - a.revenue).slice(0, limit);
    } catch (error) {
      console.error("Error getting top merchants:", error);
      throw error;
    }
  }

  /**
   * Get license renewal forecast
   */
  static async getLicenseRenewalForecast(daysAhead: number = 90) {
    const db = getDb();

    try {
      const now = new Date();
      const forecastDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

      const licenses = await db.query.licenses.findMany({
        where: and(
          eq(schema.licenses.status, "active"),
          gte(schema.licenses.expiresAt, now),
          lte(schema.licenses.expiresAt, forecastDate)
        ),
        with: {
          merchant: true,
        },
      });

      // Group by week
      const forecast: Record<string, any[]> = {};

      licenses.forEach((license) => {
        const weekStart = new Date(license.expiresAt);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().substring(0, 10);

        if (!forecast[weekKey]) {
          forecast[weekKey] = [];
        }

        forecast[weekKey].push({
          merchant: license.merchant.name,
          expiresAt: license.expiresAt,
          licenseType: license.licenseType,
        });
      });

      return {
        period: `Next ${daysAhead} days`,
        forecast,
        totalExpiring: licenses.length,
      };
    } catch (error) {
      console.error("Error getting license renewal forecast:", error);
      throw error;
    }
  }

  /**
   * Get subscription plan distribution
   */
  static async getSubscriptionDistribution() {
    const db = getDb();

    try {
      const merchants = await db.query.merchants.findMany();

      const distribution: Record<string, number> = {
        free: 0,
        starter: 0,
        professional: 0,
        enterprise: 0,
      };

      merchants.forEach((merchant) => {
        const plan = merchant.subscriptionPlan || "free";
        if (distribution.hasOwnProperty(plan)) {
          distribution[plan]++;
        }
      });

      return {
        total: merchants.length,
        distribution,
        percentages: {
          free: ((distribution.free / merchants.length) * 100).toFixed(2),
          starter: ((distribution.starter / merchants.length) * 100).toFixed(2),
          professional: ((distribution.professional / merchants.length) * 100).toFixed(2),
          enterprise: ((distribution.enterprise / merchants.length) * 100).toFixed(2),
        },
      };
    } catch (error) {
      console.error("Error getting subscription distribution:", error);
      throw error;
    }
  }

  /**
   * Get payment method distribution
   */
  static async getPaymentMethodDistribution() {
    const db = getDb();

    try {
      const orders = await db.query.orders.findMany();

      const distribution: Record<string, number> = {};
      const revenue: Record<string, number> = {};

      orders.forEach((order) => {
        const method = order.paymentMethod || "unknown";
        distribution[method] = (distribution[method] || 0) + 1;
        revenue[method] = (revenue[method] || 0) + parseFloat(order.total.toString());
      });

      return {
        orderCount: orders.length,
        distribution,
        revenue,
      };
    } catch (error) {
      console.error("Error getting payment method distribution:", error);
      throw error;
    }
  }
}
