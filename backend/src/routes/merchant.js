import { Router } from 'express';
import { query } from '../db.js';
import { requireMerchant } from '../middleware/adminAuth.js';
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  formatCategory,
  formatProduct,
  listCategories,
  listProducts,
  updateCategory,
  updateProduct,
} from '../services/menuService.js';
import { getTenantById, formatTenant } from '../services/tenantService.js';
import { getTenantSettings, updateTenantSettings } from '../services/tenantSettingsService.js';

const router = Router();
router.use(requireMerchant);

router.get('/me', async (req, res) => {
  try {
    const tenant = await getTenantById(req.tenantId);
    res.json({
      user: req.adminSession,
      tenant: formatTenant(tenant),
    });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Failed' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const now = Date.now();
    const stats = (
      await query(
        `SELECT
           (SELECT COUNT(*)::int FROM categories WHERE tenant_id = $1 AND deleted_at IS NULL) AS category_count,
           (SELECT COUNT(*)::int FROM products WHERE tenant_id = $1 AND deleted_at IS NULL) AS product_count,
           (SELECT COUNT(*)::int FROM online_orders WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days') AS orders_7d,
           (SELECT COUNT(*)::int FROM online_orders WHERE tenant_id = $1 AND status IN ('NEW','ACCEPTED','PREPARING')) AS open_orders`,
        [req.tenantId]
      )
    ).rows[0];
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Stats failed' });
  }
});

router.get('/menu/categories', async (req, res) => {
  try {
    const rows = await listCategories(req.tenantId);
    res.json({ categories: rows.map(formatCategory) });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'List categories failed' });
  }
});

router.post('/menu/categories', async (req, res) => {
  try {
    const { name, sortOrder, colorHex, onlineVisible, kioskVisible } = req.body ?? {};
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const row = await createCategory(req.tenantId, { name: name.trim(), sortOrder, colorHex, onlineVisible, kioskVisible });
    res.status(201).json({ category: formatCategory(row) });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Create category failed' });
  }
});

router.patch('/menu/categories/:id', async (req, res) => {
  try {
    const row = await updateCategory(req.tenantId, req.params.id, req.body ?? {});
    res.json({ category: formatCategory(row) });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Update category failed' });
  }
});

router.delete('/menu/categories/:id', async (req, res) => {
  try {
    await deleteCategory(req.tenantId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Delete category failed' });
  }
});

router.get('/menu/products', async (req, res) => {
  try {
    const rows = await listProducts(req.tenantId);
    res.json({ products: rows.map(formatProduct) });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'List products failed' });
  }
});

router.post('/menu/products', async (req, res) => {
  try {
    const body = req.body ?? {};
    if (!body.name?.trim()) return res.status(400).json({ error: 'name is required' });
    const row = await createProduct(req.tenantId, {
      categoryId: body.categoryId,
      name: body.name.trim(),
      description: body.description,
      price: body.price,
      taxRate: body.taxRate,
      sku: body.sku,
      imageUrl: body.imageUrl,
      sortOrder: body.sortOrder,
      inStock: body.inStock,
      onlineVisible: body.onlineVisible,
      kioskVisible: body.kioskVisible,
    });
    res.status(201).json({ product: formatProduct(row) });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Create product failed' });
  }
});

router.patch('/menu/products/:id', async (req, res) => {
  try {
    const body = req.body ?? {};
    const row = await updateProduct(req.tenantId, req.params.id, {
      categoryId: body.categoryId,
      name: body.name,
      description: body.description,
      price: body.price,
      taxRate: body.taxRate,
      sku: body.sku,
      imageUrl: body.imageUrl,
      sortOrder: body.sortOrder,
      inStock: body.inStock,
      onlineVisible: body.onlineVisible,
      kioskVisible: body.kioskVisible,
    });
    res.json({ product: formatProduct(row) });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Update product failed' });
  }
});

router.delete('/menu/products/:id', async (req, res) => {
  try {
    await deleteProduct(req.tenantId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Delete product failed' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 100), 200);
    const rows = (
      await query(
        `SELECT id, order_number, status, service_type, fulfillment_type,
                customer_name, customer_phone, delivery_address, pickup_time_ms,
                subtotal::float8, tax_total::float8, total::float8, notes, created_at, updated_at
         FROM online_orders
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [req.tenantId, limit]
      )
    ).rows;
    res.json({
      orders: rows.map((row) => ({
        id: row.id,
        orderNumber: row.order_number,
        status: row.status,
        serviceType: row.service_type,
        fulfillmentType: row.fulfillment_type,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        deliveryAddress: row.delivery_address,
        pickupTimeMs: row.pickup_time_ms,
        subtotal: row.subtotal,
        taxTotal: row.tax_total,
        total: row.total,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'List orders failed' });
  }
});

router.patch('/orders/:id', async (req, res) => {
  try {
    const { status } = req.body ?? {};
    const allowed = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }
    const row = (
      await query(
        `UPDATE online_orders SET status = $3, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2
         RETURNING id, order_number, status, updated_at`,
        [req.tenantId, req.params.id, status]
      )
    ).rows[0];
    if (!row) return res.status(404).json({ error: 'Order not found' });
    res.json({
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Update order failed' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const settings = await getTenantSettings(req.tenantId);
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Get settings failed' });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    const { openingHours, deliveryZones, orderSettings } = req.body ?? {};
    const settings = await updateTenantSettings(req.tenantId, {
      openingHours,
      deliveryZones,
      orderSettings,
    });
    res.json({ settings });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Update settings failed' });
  }
});

export default router;
