import { Router } from 'express';
import { query } from '../db.js';
import { getDefaultTenantId } from '../services/tenantService.js';

const router = Router();

router.get('/bootstrap', async (_req, res) => {
  try {
    const tenantId = await getDefaultTenantId();
    const tenant = (await query(`SELECT id, slug, name, currency_symbol FROM tenants WHERE id = $1`, [tenantId])).rows[0];
    const categories = (
      await query(
        `SELECT id, name, sort_order, color_hex, online_visible, kiosk_visible, updated_at
         FROM categories WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY sort_order, name`,
        [tenantId]
      )
    ).rows;
    const products = (
      await query(
        `SELECT id, category_id, name, description, price::float8, tax_rate::float8, sku, image_url,
                sort_order, in_stock, online_visible, kiosk_visible, updated_at
         FROM products WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY sort_order, name`,
        [tenantId]
      )
    ).rows;
    res.json({
      serverTime: Date.now(),
      tenant,
      categories,
      products,
    });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Bootstrap failed' });
  }
});

router.get('/menu', async (req, res) => {
  try {
    const tenantId = await getDefaultTenantId();
    const since = Number(req.query.since || 0);
    const sinceDate = since > 0 ? new Date(since) : new Date(0);

    const categories = (
      await query(
        `SELECT id, name, sort_order, color_hex, online_visible, kiosk_visible, updated_at, deleted_at
         FROM categories
         WHERE tenant_id = $1 AND updated_at > $2
         ORDER BY updated_at ASC`,
        [tenantId, sinceDate]
      )
    ).rows;

    const products = (
      await query(
        `SELECT id, category_id, name, description, price::float8, tax_rate::float8, sku, image_url,
                sort_order, in_stock, online_visible, kiosk_visible, updated_at, deleted_at
         FROM products
         WHERE tenant_id = $1 AND updated_at > $2
         ORDER BY updated_at ASC`,
        [tenantId, sinceDate]
      )
    ).rows;

    res.json({
      serverTime: Date.now(),
      categories,
      products,
    });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Menu sync failed' });
  }
});

export default router;
