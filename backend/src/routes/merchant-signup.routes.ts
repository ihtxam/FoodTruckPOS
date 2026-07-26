import { Router } from 'express';
import { db } from '../db';
import { merchants, licenses, merchantSettings } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = Router();

/**
 * License Packages
 */
const LICENSE_PACKAGES = {
  POS: {
    id: 'pos',
    name: 'POS Only',
    description: 'Point of Sale system for in-store transactions',
    price: 99,
    currency: 'USD',
    billingCycle: 'monthly',
    features: ['POS System', 'Inventory Management', 'Staff Management', 'Reports'],
    maxLocations: 1,
    maxUsers: 5,
  },
  POS_SHOP: {
    id: 'pos-shop',
    name: 'POS + Online Shop',
    description: 'POS system with online ordering and delivery management',
    price: 199,
    currency: 'USD',
    billingCycle: 'monthly',
    features: [
      'POS System',
      'Online Shop',
      'Delivery Management',
      'Inventory Management',
      'Staff Management',
      'Reports',
    ],
    maxLocations: 1,
    maxUsers: 10,
  },
  POS_SHOP_KDS: {
    id: 'pos-shop-kds',
    name: 'POS + Shop + Kitchen Display',
    description: 'Complete solution with POS, online shop, and kitchen display system',
    price: 299,
    currency: 'USD',
    billingCycle: 'monthly',
    features: [
      'POS System',
      'Online Shop',
      'Kitchen Display System',
      'Delivery Management',
      'Inventory Management',
      'Staff Management',
      'Advanced Reports',
      'API Access',
    ],
    maxLocations: 3,
    maxUsers: 20,
  },
};

/**
 * Merchant Signup
 * POST /api/auth/merchant/signup
 */
router.post('/signup', async (req, res) => {
  try {
    const {
      businessName,
      email,
      password,
      phone,
      address,
      city,
      zipCode,
      country,
      packageId,
    } = req.body;

    // Validate required fields
    if (!businessName || !email || !password || !packageId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: businessName, email, password, packageId',
      });
    }

    // Validate package
    const selectedPackage = Object.values(LICENSE_PACKAGES).find((p) => p.id === packageId);
    if (!selectedPackage) {
      return res.status(400).json({ success: false, error: 'Invalid package selected' });
    }

    // Check if email already exists
    const existingMerchant = await db.query.merchants.findFirst({
      where: eq(merchants.email, email),
    });

    if (existingMerchant) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate merchant slug
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Create merchant
    const newMerchant = await db
      .insert(merchants)
      .values({
        businessName,
        email,
        password: hashedPassword,
        phone,
        address,
        city,
        zipCode,
        country,
        slug,
        status: 'active',
        isVerified: false,
        createdAt: new Date(),
      })
      .returning();

    const merchantId = newMerchant[0].id;

    // Create license
    const licenseCode = `LIC-${merchantId}-${Date.now()}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 365); // 1 year

    const newLicense = await db
      .insert(licenses)
      .values({
        merchantId,
        licenseCode,
        packageId,
        status: 'active',
        trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days trial
        expiryDate,
        isTrialActive: true,
        createdAt: new Date(),
      })
      .returning();

    // Create merchant settings
    await db.insert(merchantSettings).values({
      merchantId,
      shopEnabled: packageId !== 'pos',
      kdsEnabled: packageId === 'pos-shop-kds',
      preOrderEnabled: true,
      deliveryEnabled: packageId !== 'pos',
      pickupEnabled: true,
      createdAt: new Date(),
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        merchantId,
        email,
        role: 'merchant',
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        merchantId,
        businessName,
        email,
        slug,
        package: selectedPackage,
        license: {
          code: licenseCode,
          status: 'active',
          trialEndDate: newLicense[0].trialEndDate,
          expiryDate: newLicense[0].expiryDate,
        },
        token,
        message: 'Merchant account created successfully. 7-day trial activated.',
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Get Available Packages
 * GET /api/auth/packages
 */
router.get('/packages', async (req, res) => {
  try {
    res.json({
      success: true,
      data: Object.values(LICENSE_PACKAGES),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Get Package Details
 * GET /api/auth/packages/:packageId
 */
router.get('/packages/:packageId', async (req, res) => {
  try {
    const { packageId } = req.params;

    const pkg = Object.values(LICENSE_PACKAGES).find((p) => p.id === packageId);

    if (!pkg) {
      return res.status(404).json({ success: false, error: 'Package not found' });
    }

    res.json({
      success: true,
      data: pkg,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Upgrade Package
 * POST /api/merchant/upgrade-package
 */
router.post('/upgrade-package', async (req, res) => {
  try {
    const { merchantId, newPackageId } = req.body;

    // Validate package
    const newPackage = Object.values(LICENSE_PACKAGES).find((p) => p.id === newPackageId);
    if (!newPackage) {
      return res.status(400).json({ success: false, error: 'Invalid package' });
    }

    // Get current license
    const currentLicense = await db.query.licenses.findFirst({
      where: eq(licenses.merchantId, merchantId),
    });

    if (!currentLicense) {
      return res.status(404).json({ success: false, error: 'License not found' });
    }

    // Update license
    await db
      .update(licenses)
      .set({
        packageId: newPackageId,
        updatedAt: new Date(),
      })
      .where(eq(licenses.id, currentLicense.id));

    // Update merchant settings based on package
    await db
      .update(merchantSettings)
      .set({
        shopEnabled: newPackageId !== 'pos',
        kdsEnabled: newPackageId === 'pos-shop-kds',
      })
      .where(eq(merchantSettings.merchantId, merchantId));

    res.json({
      success: true,
      data: {
        message: 'Package upgraded successfully',
        newPackage,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Get Merchant Shop URL
 * GET /api/merchant/shop-url
 */
router.get('/shop-url/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;

    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, merchantId),
    });

    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Merchant not found' });
    }

    const shopUrl = `https://order.${process.env.DOMAIN || 'yourdomain.com'}/${merchant.slug}`;

    res.json({
      success: true,
      data: {
        shopUrl,
        slug: merchant.slug,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
