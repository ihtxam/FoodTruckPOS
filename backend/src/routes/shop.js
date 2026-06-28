import { Router } from 'express';
import { query } from '../db.js';
import { getTenantBySlug } from '../services/tenantService.js';

const router = Router();

function nextOrderNumber() {
  return `W-${Date.now().toString().slice(-8)}`;
}

async function loadPublicMenu(tenantId) {
  const categories = (
    await query(
      `SELECT id, name, sort_order, color_hex
       FROM categories
       WHERE tenant_id = $1 AND deleted_at IS NULL AND online_visible = TRUE
       ORDER BY sort_order, name`,
      [tenantId]
    )
  ).rows;
  const products = (
    await query(
      `SELECT id, category_id, name, description, price::float8, tax_rate::float8, image_url, in_stock
       FROM products
       WHERE tenant_id = $1 AND deleted_at IS NULL AND online_visible = TRUE AND in_stock = TRUE
       ORDER BY sort_order, name`,
      [tenantId]
    )
  ).rows;
  return { categories, products };
}

router.get('/:tenantSlug/menu', async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    if (!tenant.shop_enabled) {
      return res.status(403).json({ error: 'Online shop is disabled for this merchant' });
    }
    const menu = await loadPublicMenu(tenant.id);
    res.json({
      tenant: {
        slug: tenant.slug,
        name: tenant.name,
        currencySymbol: tenant.currency_symbol,
      },
      ...menu,
    });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Menu failed' });
  }
});

router.post('/:tenantSlug/orders', async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    if (!tenant.shop_enabled) {
      return res.status(403).json({ error: 'Online shop is disabled for this merchant' });
    }

    const body = req.body ?? {};
    const items = Array.isArray(body.items) ? body.items : [];
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.lineTotal ?? item.unitPrice * item.quantity ?? 0),
      0
    );
    const taxTotal = Number(body.taxTotal ?? 0);
    const total = Number(body.total ?? subtotal + taxTotal);
    const orderNumber = body.orderNumber || nextOrderNumber();

    const row = (
      await query(
        `INSERT INTO online_orders (
           tenant_id, order_number, source, status, service_type, fulfillment_type,
           customer_name, customer_phone, delivery_address, pickup_time_ms,
           subtotal, tax_total, total, notes, payload
         ) VALUES ($1,$2,'ONLINE','NEW',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id, order_number, status, created_at`,
        [
          tenant.id,
          orderNumber,
          body.serviceType ?? 'TAKEAWAY',
          body.fulfillmentType ?? 'PICKUP',
          body.customerName ?? null,
          body.customerPhone ?? null,
          body.deliveryAddress ?? null,
          body.pickupTimeMs ?? null,
          subtotal,
          taxTotal,
          total,
          body.notes ?? null,
          JSON.stringify({ items, tenantSlug: tenant.slug }),
        ]
      )
    ).rows[0];

    res.status(201).json({
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      createdAt: row.created_at,
    });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Could not create order' });
  }
});

export default router;
