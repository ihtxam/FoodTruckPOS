import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { db } from '../db';
import { merchants, licenses, merchantSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Middleware - verify superadmin role
router.use(authMiddleware);
router.use((req, res, next) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Unauthorized: Superadmin access required' });
  }
  next();
});

/**
 * Get All Merchants
 * GET /api/superadmin/merchants
 */
router.get('/merchants', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    let query = db.query.merchants.findMany();

    const allMerchants = await db.query.merchants.findMany();

    const filtered = allMerchants.filter((m: any) => {
      if (status && m.status !== status) return false;
      if (search) {
        const searchStr = (search as string).toLowerCase();
        return (
          m.businessName.toLowerCase().includes(searchStr) ||
          m.email.toLowerCase().includes(searchStr) ||
          m.slug.toLowerCase().includes(searchStr)
        );
      }
      return true;
    });

    const offset = ((page as number) - 1) * (limit as number);
    const paginated = filtered.slice(offset, offset + (limit as number));

    // Get licenses for each merchant
    const merchantsWithLicenses = await Promise.all(
      paginated.map(async (merchant: any) => {
        const license = await db.query.licenses.findFirst({
          where: eq(licenses.merchantId, merchant.id),
        });
        return {
          ...merchant,
          license,
        };
      })
    );

    res.json({
      success: true,
      data: merchantsWithLicenses,
      pagination: {
        total: filtered.length,
        page,
        limit,
        pages: Math.ceil(filtered.length / (limit as number)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Get Merchant Details
 * GET /api/superadmin/merchants/:merchantId
 */
router.get('/merchants/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;

    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, merchantId),
    });

    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Merchant not found' });
    }

    const license = await db.query.licenses.findFirst({
      where: eq(licenses.merchantId, merchantId),
    });

    const settings = await db.query.merchantSettings.findFirst({
      where: eq(merchantSettings.merchantId, merchantId),
    });

    res.json({
      success: true,
      data: {
        ...merchant,
        license,
        settings,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Activate/Deactivate Merchant Shop
 * PUT /api/superadmin/merchants/:merchantId/shop-status
 */
router.put('/merchants/:merchantId/shop-status', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { shopEnabled } = req.body;

    // Verify merchant exists
    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, merchantId),
    });

    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Merchant not found' });
    }

    // Verify merchant has shop license
    const license = await db.query.licenses.findFirst({
      where: eq(licenses.merchantId, merchantId),
    });

    if (!license || (license.packageId === 'pos')) {
      return res.status(400).json({
        success: false,
        error: 'Merchant does not have shop license',
      });
    }

    // Update shop status
    await db
      .update(merchantSettings)
      .set({ shopEnabled })
      .where(eq(merchantSettings.merchantId, merchantId));

    res.json({
      success: true,
      data: {
        merchantId,
        shopEnabled,
        message: shopEnabled ? 'Shop activated' : 'Shop deactivated',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Suspend/Reactivate Merchant Account
 * PUT /api/superadmin/merchants/:merchantId/status
 */
router.put('/merchants/:merchantId/status', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'suspended', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Verify merchant exists
    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, merchantId),
    });

    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Merchant not found' });
    }

    // Update merchant status
    await db
      .update(merchants)
      .set({ status, updatedAt: new Date() })
      .where(eq(merchants.id, merchantId));

    res.json({
      success: true,
      data: {
        merchantId,
        status,
        reason,
        message: `Merchant account ${status}`,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Get License Details
 * GET /api/superadmin/licenses/:licenseId
 */
router.get('/licenses/:licenseId', async (req, res) => {
  try {
    const { licenseId } = req.params;

    const license = await db.query.licenses.findFirst({
      where: eq(licenses.id, licenseId),
    });

    if (!license) {
      return res.status(404).json({ success: false, error: 'License not found' });
    }

    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, license.merchantId),
    });

    res.json({
      success: true,
      data: {
        ...license,
        merchant: {
          id: merchant?.id,
          businessName: merchant?.businessName,
          email: merchant?.email,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Extend License Expiry
 * PUT /api/superadmin/licenses/:licenseId/extend
 */
router.put('/licenses/:licenseId/extend', async (req, res) => {
  try {
    const { licenseId } = req.params;
    const { months = 12 } = req.body;

    const license = await db.query.licenses.findFirst({
      where: eq(licenses.id, licenseId),
    });

    if (!license) {
      return res.status(404).json({ success: false, error: 'License not found' });
    }

    const newExpiryDate = new Date(license.expiryDate);
    newExpiryDate.setMonth(newExpiryDate.getMonth() + months);

    await db
      .update(licenses)
      .set({ expiryDate: newExpiryDate })
      .where(eq(licenses.id, licenseId));

    res.json({
      success: true,
      data: {
        licenseId,
        newExpiryDate,
        message: `License extended by ${months} months`,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Revoke License
 * PUT /api/superadmin/licenses/:licenseId/revoke
 */
router.put('/licenses/:licenseId/revoke', async (req, res) => {
  try {
    const { licenseId } = req.params;
    const { reason } = req.body;

    const license = await db.query.licenses.findFirst({
      where: eq(licenses.id, licenseId),
    });

    if (!license) {
      return res.status(404).json({ success: false, error: 'License not found' });
    }

    await db
      .update(licenses)
      .set({ status: 'revoked' })
      .where(eq(licenses.id, licenseId));

    // Deactivate shop
    await db
      .update(merchantSettings)
      .set({ shopEnabled: false })
      .where(eq(merchantSettings.merchantId, license.merchantId));

    res.json({
      success: true,
      data: {
        licenseId,
        status: 'revoked',
        reason,
        message: 'License revoked and shop deactivated',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Get Licenses Expiring Soon
 * GET /api/superadmin/licenses/expiring/soon
 */
router.get('/licenses/expiring/soon', async (req, res) => {
  try {
    const allLicenses = await db.query.licenses.findMany();

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringLicenses = allLicenses.filter((license: any) => {
      return license.expiryDate > now && license.expiryDate <= thirtyDaysFromNow;
    });

    const licensesWithMerchants = await Promise.all(
      expiringLicenses.map(async (license: any) => {
        const merchant = await db.query.merchants.findFirst({
          where: eq(merchants.id, license.merchantId),
        });
        return {
          ...license,
          merchant,
        };
      })
    );

    res.json({
      success: true,
      data: licensesWithMerchants,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Get License Statistics
 * GET /api/superadmin/licenses/stats
 */
router.get('/licenses/stats', async (req, res) => {
  try {
    const allLicenses = await db.query.licenses.findMany();

    const stats = {
      total: allLicenses.length,
      active: allLicenses.filter((l: any) => l.status === 'active').length,
      expired: allLicenses.filter((l: any) => l.status === 'expired').length,
      revoked: allLicenses.filter((l: any) => l.status === 'revoked').length,
      byPackage: {
        pos: allLicenses.filter((l: any) => l.packageId === 'pos').length,
        'pos-shop': allLicenses.filter((l: any) => l.packageId === 'pos-shop').length,
        'pos-shop-kds': allLicenses.filter((l: any) => l.packageId === 'pos-shop-kds').length,
      },
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
