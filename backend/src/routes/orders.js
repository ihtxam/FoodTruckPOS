import { Router } from 'express';
import { query } from '../db.js';
import { requireApiKey } from '../middleware/auth.js';
import { getDefaultTenantId } from '../services/tenantService.js';

const router = Router();

function nextOrderNumber() {
  return `W-${Date.now().toString().slice(-8)}`;
}

/** Online shop creates an order */
router.post('/', async (req, res) => {
  try {
    const tenantId = await getDefaultTenantId();
    const body = req.body ?? {};
    const items = Array.isArray(body.items) ? body.items : [];
    const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal ?? item.unitPrice * item.quantity ?? 0), 0);
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
          tenantId,
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
          JSON.stringify({ items }),
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

/** POS pulls new online orders */
router.get('/incoming', requireApiKey, async (req, res) => {
  try {
    const tenantId = req.tenantId ?? (await getDefaultTenantId());
    const since = Number(req.query.since || 0);
    const sinceDate = since > 0 ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = (
      await query(
        `SELECT id, order_number, source, status, service_type, fulfillment_type,
                customer_name, customer_phone, delivery_address, pickup_time_ms,
                subtotal::float8, tax_total::float8, total::float8, notes, payload,
                created_at, updated_at
         FROM online_orders
         WHERE tenant_id = $1 AND status IN ('NEW', 'ACCEPTED', 'PREPARING', 'READY')
           AND created_at > $2
         ORDER BY created_at ASC
         LIMIT 200`,
        [tenantId, sinceDate]
      )
    ).rows;

    res.json({ serverTime: Date.now(), orders: rows });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Incoming orders failed' });
  }
});

router.post('/:id/ack', requireApiKey, async (req, res) => {
  try {
    const tenantId = req.tenantId ?? (await getDefaultTenantId());
    const { id } = req.params;
    await query(
      `UPDATE online_orders
       SET status = 'ACCEPTED', pos_ack_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Ack failed' });
  }
});

/** Public menu for online shop */
router.get('/menu', async (_req, res) => {
  try {
    const tenantId = await getDefaultTenantId();
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
    res.json({ categories, products });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Menu failed' });
  }
});

export default router;
