import { Router } from 'express';
import { db } from '../db';
import { merchants, orders, orderItems, deliveryZones, merchantSettings } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * Get Merchant Shop Info (Public)
 * GET /api/shop/:merchantSlug
 */
router.get('/:merchantSlug', async (req, res) => {
  try {
    const { merchantSlug } = req.params;

    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.slug, merchantSlug),
    });

    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const settings = await db.query.merchantSettings.findFirst({
      where: eq(merchantSettings.merchantId, merchant.id),
    });

    if (!settings?.shopEnabled) {
      return res.status(403).json({ success: false, error: 'Shop is currently closed' });
    }

    const license = await db.query.licenses.findFirst({
      where: eq(licenses.merchantId, merchant.id),
    });

    res.json({
      success: true,
      data: {
        id: merchant.id,
        name: merchant.businessName,
        slug: merchant.slug,
        address: merchant.address,
        city: merchant.city,
        zipCode: merchant.zipCode,
        phone: merchant.phone,
        status: merchant.status,
        settings: {
          deliveryEnabled: settings.deliveryEnabled,
          pickupEnabled: settings.pickupEnabled,
          preOrderEnabled: settings.preOrderEnabled,
        },
        license: {
          packageId: license?.packageId,
          status: license?.status,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Get Merchant Menu (Public)
 * GET /api/shop/:merchantSlug/menu
 */
router.get('/:merchantSlug/menu', async (req, res) => {
  try {
    const { merchantSlug } = req.params;

    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.slug, merchantSlug),
    });

    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    // Get products organized by category
    const products = await db.query.products.findMany({
      where: eq(products.merchantId, merchant.id),
    });

    const categories = await db.query.categories.findMany({
      where: eq(categories.merchantId, merchant.id),
    });

    // Organize products by category
    const menu = categories.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      items: products.filter((p: any) => p.categoryId === cat.id),
    }));

    res.json({
      success: true,
      data: menu,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Get Delivery Zones (Public)
 * GET /api/shop/:merchantSlug/delivery-zones
 */
router.get('/:merchantSlug/delivery-zones', async (req, res) => {
  try {
    const { merchantSlug } = req.params;

    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.slug, merchantSlug),
    });

    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const zones = await db.query.deliveryZones.findMany({
      where: and(eq(deliveryZones.merchantId, merchant.id), eq(deliveryZones.isActive, true)),
    });

    const formattedZones = zones.map((zone: any) => ({
      id: zone.id,
      name: zone.name,
      zipCodes: JSON.parse(zone.zipCodes || '[]'),
      minDeliveryAmount: zone.minDeliveryAmount,
      deliveryFee: zone.deliveryFee,
      estimatedTime: zone.estimatedTime,
    }));

    res.json({
      success: true,
      data: formattedZones,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Check Delivery Availability (Public)
 * POST /api/shop/:merchantSlug/check-delivery
 */
router.post('/:merchantSlug/check-delivery', async (req, res) => {
  try {
    const { merchantSlug } = req.params;
    const { zipCode } = req.body;

    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.slug, merchantSlug),
    });

    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const zones = await db.query.deliveryZones.findMany({
      where: eq(deliveryZones.merchantId, merchant.id),
    });

    const availableZone = zones.find((zone: any) => {
      const zipCodes = JSON.parse(zone.zipCodes || '[]');
      return zipCodes.includes(zipCode);
    });

    if (!availableZone) {
      return res.json({
        success: true,
        data: {
          available: false,
          message: 'Delivery not available for this ZIP code',
        },
      });
    }

    res.json({
      success: true,
      data: {
        available: true,
        zone: {
          id: availableZone.id,
          name: availableZone.name,
          minDeliveryAmount: availableZone.minDeliveryAmount,
          deliveryFee: availableZone.deliveryFee,
          estimatedTime: availableZone.estimatedTime,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Create Online Order
 * POST /api/shop/:merchantSlug/orders
 */
router.post('/:merchantSlug/orders', async (req, res) => {
  try {
    const { merchantSlug } = req.params;
    const {
      items,
      customerName,
      customerEmail,
      customerPhone,
      deliveryAddress,
      zipCode,
      orderType,
      scheduledTime,
      specialInstructions,
      discount,
    } = req.body;

    // Validate merchant
    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.slug, merchantSlug),
    });

    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'No items in order' });
    }

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.price * item.quantity;
    }

    // Get delivery fee if applicable
    let deliveryFee = 0;
    if (orderType === 'delivery') {
      const zones = await db.query.deliveryZones.findMany({
        where: eq(deliveryZones.merchantId, merchant.id),
      });

      const zone = zones.find((z: any) => {
        const zipCodes = JSON.parse(z.zipCodes || '[]');
        return zipCodes.includes(zipCode);
      });

      if (!zone) {
        return res.status(400).json({ success: false, error: 'Delivery not available' });
      }

      if (subtotal < zone.minDeliveryAmount) {
        return res.status(400).json({
          success: false,
          error: `Minimum order amount is ${zone.minDeliveryAmount}`,
        });
      }

      deliveryFee = zone.deliveryFee;
    }

    const discountAmount = discount || 0;
    const taxableAmount = subtotal + deliveryFee - discountAmount;
    const tax = taxableAmount * 0.1;
    const total = taxableAmount + tax;

    // Create order
    const orderNumber = `WEB-${Date.now()}`;
    const newOrder = await db
      .insert(orders)
      .values({
        merchantId: merchant.id,
        orderNumber,
        orderType: 'online',
        status: 'pending',
        subtotal,
        tax,
        discount: discountAmount,
        total,
        deliveryFee,
        customerName,
        customerEmail,
        customerPhone,
        deliveryAddress,
        zipCode,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        specialInstructions,
        createdAt: new Date(),
      })
      .returning();

    // Add items to order
    for (const item of items) {
      await db.insert(orderItems).values({
        orderId: newOrder[0].id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity,
        createdAt: new Date(),
      });
    }

    res.status(201).json({
      success: true,
      data: {
        orderId: newOrder[0].id,
        orderNumber: newOrder[0].orderNumber,
        total,
        estimatedTime: orderType === 'delivery' ? '45-60 minutes' : '15-20 minutes',
        message: 'Order created successfully',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Get Order Status (Public)
 * GET /api/shop/:merchantSlug/orders/:orderId
 */
router.get('/:merchantSlug/orders/:orderId', async (req, res) => {
  try {
    const { merchantSlug, orderId } = req.params;

    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.slug, merchantSlug),
    });

    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.merchantId, merchant.id)),
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const orderItems = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, orderId),
    });

    res.json({
      success: true,
      data: {
        ...order,
        items: orderItems,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
