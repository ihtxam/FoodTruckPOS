import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { db } from '../db';
import { orders, orderItems, kitchenMessages } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Middleware
router.use(authMiddleware);

/**
 * Create new course-based order
 * POST /api/merchant/orders/course
 */
router.post('/course', async (req, res) => {
  try {
    const merchantId = req.user?.merchantId;
    const orderNumber = `ORD-${Date.now()}`;

    const newOrder = await db.insert(orders).values({
      merchantId,
      orderNumber,
      orderType: 'course-based',
      status: 'open',
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0,
      createdAt: new Date(),
    }).returning();

    res.json({
      success: true,
      data: {
        id: newOrder[0].id,
        orderNumber,
        courses: [
          { type: 'starter', label: 'Starters', items: [], isFired: false },
          { type: 'main', label: 'Main Course', items: [], isFired: false },
          { type: 'dessert', label: 'Desserts', items: [], isFired: false },
        ],
        kitchenMessages: [],
        subtotal: 0,
        tax: 0,
        discount: 0,
        total: 0,
        status: 'open',
        createdAt: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Get order with courses
 * GET /api/merchant/orders/:id/courses
 */
router.get('/:id/courses', async (req, res) => {
  try {
    const { id } = req.params;
    const merchantId = req.user?.merchantId;

    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.merchantId, merchantId)),
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const items = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, id),
    });

    // Group items by course
    const courses = [
      {
        type: 'starter',
        label: 'Starters',
        items: items.filter((i: any) => i.course === 'starter'),
        isFired: items.filter((i: any) => i.course === 'starter').every((i: any) => i.fired),
      },
      {
        type: 'main',
        label: 'Main Course',
        items: items.filter((i: any) => i.course === 'main'),
        isFired: items.filter((i: any) => i.course === 'main').every((i: any) => i.fired),
      },
      {
        type: 'dessert',
        label: 'Desserts',
        items: items.filter((i: any) => i.course === 'dessert'),
        isFired: items.filter((i: any) => i.course === 'dessert').every((i: any) => i.fired),
      },
    ];

    const messages = await db.query.kitchenMessages.findMany({
      where: eq(kitchenMessages.orderId, id),
    });

    res.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        courses,
        kitchenMessages: messages,
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Add item to course
 * POST /api/merchant/orders/:id/items
 */
router.post('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, productName, course, price, quantity = 1 } = req.body;
    const merchantId = req.user?.merchantId;

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.merchantId, merchantId)),
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const totalPrice = price * quantity;

    const newItem = await db.insert(orderItems).values({
      orderId: id,
      productId,
      productName,
      course,
      quantity,
      unitPrice: price,
      totalPrice,
      discount: 0,
      fired: false,
      createdAt: new Date(),
    }).returning();

    // Update order totals
    const allItems = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, id),
    });

    const subtotal = allItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    await db.update(orders)
      .set({ subtotal, tax, total })
      .where(eq(orders.id, id));

    res.json({
      success: true,
      data: { itemId: newItem[0].id, message: 'Item added to order' },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Update item
 * PUT /api/merchant/orders/:id/items/:itemId
 */
router.put('/:id/items/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { quantity, unitPrice, discount } = req.body;
    const merchantId = req.user?.merchantId;

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.merchantId, merchantId)),
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const updates: any = {};
    if (quantity !== undefined) updates.quantity = quantity;
    if (unitPrice !== undefined) updates.unitPrice = unitPrice;
    if (discount !== undefined) updates.discount = discount;

    if (quantity !== undefined || unitPrice !== undefined) {
      const item = await db.query.orderItems.findFirst({
        where: eq(orderItems.id, itemId),
      });
      if (item) {
        const newQty = quantity ?? item.quantity;
        const newPrice = unitPrice ?? item.unitPrice;
        updates.totalPrice = newQty * newPrice - (discount ?? item.discount);
      }
    }

    await db.update(orderItems)
      .set(updates)
      .where(eq(orderItems.id, itemId));

    // Recalculate order totals
    const allItems = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, id),
    });

    const subtotal = allItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    await db.update(orders)
      .set({ subtotal, tax, total })
      .where(eq(orders.id, id));

    res.json({ success: true, data: { message: 'Item updated' } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Remove item
 * DELETE /api/merchant/orders/:id/items/:itemId
 */
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const merchantId = req.user?.merchantId;

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.merchantId, merchantId)),
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    await db.delete(orderItems).where(eq(orderItems.id, itemId));

    // Recalculate totals
    const allItems = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, id),
    });

    const subtotal = allItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    await db.update(orders)
      .set({ subtotal, tax, total })
      .where(eq(orders.id, id));

    res.json({ success: true, data: { message: 'Item removed' } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Fire items to kitchen
 * POST /api/merchant/orders/:id/fire-items
 */
router.post('/:id/fire-items', async (req, res) => {
  try {
    const { id } = req.params;
    const { itemIds } = req.body;
    const merchantId = req.user?.merchantId;

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.merchantId, merchantId)),
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Mark items as fired
    for (const itemId of itemIds) {
      await db.update(orderItems)
        .set({ fired: true, firedAt: new Date() })
        .where(eq(orderItems.id, itemId));
    }

    // TODO: Send to kitchen printer/display

    res.json({ success: true, data: { message: 'Items fired to kitchen' } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Fire entire course
 * PUT /api/merchant/orders/:id/fire-course
 */
router.put('/:id/fire-course', async (req, res) => {
  try {
    const { id } = req.params;
    const { course } = req.body;
    const merchantId = req.user?.merchantId;

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.merchantId, merchantId)),
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Get all items in course
    const courseItems = await db.query.orderItems.findMany({
      where: and(eq(orderItems.orderId, id), eq(orderItems.course, course)),
    });

    // Mark all as fired
    for (const item of courseItems) {
      await db.update(orderItems)
        .set({ fired: true, firedAt: new Date() })
        .where(eq(orderItems.id, item.id));
    }

    // TODO: Send to kitchen printer/display

    res.json({ success: true, data: { message: `${course} course fired to kitchen` } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Send kitchen message
 * POST /api/merchant/orders/:id/kitchen-message
 */
router.post('/:id/kitchen-message', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, course } = req.body;
    const merchantId = req.user?.merchantId;

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.merchantId, merchantId)),
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const newMessage = await db.insert(kitchenMessages).values({
      orderId: id,
      message,
      course,
      read: false,
      createdAt: new Date(),
    }).returning();

    // TODO: Broadcast to kitchen display

    res.json({
      success: true,
      data: { messageId: newMessage[0].id, message: 'Message sent to kitchen' },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Get kitchen messages
 * GET /api/merchant/orders/:id/kitchen-messages
 */
router.get('/:id/kitchen-messages', async (req, res) => {
  try {
    const { id } = req.params;
    const merchantId = req.user?.merchantId;

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.merchantId, merchantId)),
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const messages = await db.query.kitchenMessages.findMany({
      where: eq(kitchenMessages.orderId, id),
    });

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Complete order
 * POST /api/merchant/orders/:id/complete
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, paymentDetails } = req.body;
    const merchantId = req.user?.merchantId;

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.merchantId, merchantId)),
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Update order status
    await db.update(orders)
      .set({ status: 'completed', paymentMethod })
      .where(eq(orders.id, id));

    // TODO: Process payment
    // TODO: Generate receipt
    // TODO: Update inventory

    res.json({
      success: true,
      data: {
        orderId: id,
        receiptId: `RCP-${Date.now()}`,
        message: 'Order completed successfully',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Cancel order
 * POST /api/merchant/orders/:id/cancel
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const merchantId = req.user?.merchantId;

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.merchantId, merchantId)),
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Update order status
    await db.update(orders)
      .set({ status: 'cancelled' })
      .where(eq(orders.id, id));

    res.json({ success: true, data: { message: 'Order cancelled' } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * Get kitchen display data
 * GET /api/merchant/kitchen-display
 */
router.get('/', async (req, res) => {
  try {
    const merchantId = req.user?.merchantId;

    const activeOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.merchantId, merchantId),
        eq(orders.status, 'open')
      ),
    });

    const messages = await db.query.kitchenMessages.findMany({
      where: eq(kitchenMessages.read, false),
    });

    res.json({
      success: true,
      data: {
        activeOrders,
        completedOrders: [],
        messages,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
