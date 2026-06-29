import { Router } from 'express';
import { query } from '../db.js';
import { requireSuperadmin } from '../middleware/superadmin.js';
import {
  createTenant,
  formatTenant,
  getTenantById,
  listTenants,
  regenerateTenantApiKey,
  updateTenant,
} from '../services/tenantService.js';
import {
  extendDeviceLicense,
  formatActivationCode,
  formatDevice,
  generateActivationCode,
  listActivationCodesByTenant,
  listDevicesByTenant,
  updateDeviceStatus,
} from '../services/licenseService.js';

const router = Router();

router.post('/auth/login', (req, res) => {
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!password) {
    return res.status(503).json({
      error: 'Superadmin is not configured. Set SUPERADMIN_PASSWORD in backend/.env and restart.',
    });
  }
  if (req.body?.password === password) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

router.get('/auth/check', requireSuperadmin, (_req, res) => {
  res.json({ ok: true });
});

router.use(requireSuperadmin);

router.get('/stats', async (_req, res) => {
  try {
    const now = Date.now();
    const stats = (
      await query(
        `SELECT
           (SELECT COUNT(*)::int FROM tenants) AS tenant_count,
           (SELECT COUNT(*)::int FROM devices WHERE status = 'ACTIVE' AND expires_at > $1) AS active_devices,
           (SELECT COUNT(*)::int FROM activation_codes WHERE used_at IS NULL) AS unused_codes,
           (SELECT COUNT(*)::int FROM online_orders WHERE created_at > NOW() - INTERVAL '7 days') AS orders_7d`,
        [now]
      )
    ).rows[0];

    const recentOrders = (
      await query(
        `SELECT o.id, o.order_number, o.status, o.total::float8, o.created_at,
                t.slug AS tenant_slug, t.name AS tenant_name
         FROM online_orders o
         JOIN tenants t ON t.id = o.tenant_id
         ORDER BY o.created_at DESC
         LIMIT 10`
      )
    ).rows;

    res.json({
      tenantCount: stats.tenant_count,
      activeDevices: stats.active_devices,
      unusedCodes: stats.unused_codes,
      ordersLast7Days: stats.orders_7d,
      recentOrders: recentOrders.map((row) => ({
        id: row.id,
        orderNumber: row.order_number,
        status: row.status,
        total: row.total,
        createdAt: row.created_at,
        tenantSlug: row.tenant_slug,
        tenantName: row.tenant_name,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Stats failed' });
  }
});

router.get('/tenants', async (_req, res) => {
  try {
    const rows = await listTenants();
    res.json({ tenants: rows.map(formatTenant) });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'List tenants failed' });
  }
});

router.post('/tenants', async (req, res) => {
  try {
    const { slug, name, currencySymbol } = req.body ?? {};
    if (!slug || !name) {
      return res.status(400).json({ error: 'slug and name are required' });
    }
    const tenant = await createTenant({ slug, name, currencySymbol });
    res.status(201).json({ tenant: formatTenant(tenant) });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Create tenant failed' });
  }
});

router.get('/tenants/:tenantId', async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ tenant: formatTenant(tenant) });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Get tenant failed' });
  }
});

router.patch('/tenants/:tenantId', async (req, res) => {
  try {
    const { name, currencySymbol, shopEnabled } = req.body ?? {};
    const tenant = await updateTenant(req.params.tenantId, {
      name,
      currencySymbol,
      shopEnabled,
    });
    res.json({ tenant: formatTenant(tenant) });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Update tenant failed' });
  }
});

router.post('/tenants/:tenantId/regenerate-api-key', async (req, res) => {
  try {
    const tenant = await regenerateTenantApiKey(req.params.tenantId);
    res.json({ tenant: formatTenant(tenant) });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Regenerate API key failed' });
  }
});

router.get('/tenants/:tenantId/devices', async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const devices = await listDevicesByTenant(tenant.id);
    res.json({ devices: devices.map(formatDevice) });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'List devices failed' });
  }
});

router.get('/tenants/:tenantId/codes', async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const codes = await listActivationCodesByTenant(tenant.id);
    res.json({ codes: codes.map(formatActivationCode) });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'List codes failed' });
  }
});

router.post('/tenants/:tenantId/codes', async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const { label, validDays, deviceId } = req.body ?? {};
    const code = await generateActivationCode({
      tenantId: tenant.id,
      label: label ?? 'Annual license',
      validDays: Number(validDays ?? 365),
      boundDeviceId: deviceId ?? null,
    });

    res.status(201).json({
      code,
      tenantSlug: tenant.slug,
      validDays: Number(validDays ?? 365),
      boundDeviceId: deviceId ?? null,
    });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Generate code failed' });
  }
});

router.post('/tenants/:tenantId/devices/:deviceRowId/extend', async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const result = await extendDeviceLicense({
      tenantId: tenant.id,
      deviceRowId: req.params.deviceRowId,
      extraDays: req.body?.extraDays ?? 365,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Extend license failed' });
  }
});

router.patch('/tenants/:tenantId/devices/:deviceRowId', async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const result = await updateDeviceStatus({
      tenantId: tenant.id,
      deviceRowId: req.params.deviceRowId,
      status: req.body?.status,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Update device failed' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const tenantId = req.query.tenantId ?? null;
    const rows = tenantId
      ? (
          await query(
            `SELECT o.id, o.order_number, o.status, o.total::float8, o.customer_name, o.created_at,
                    t.slug AS tenant_slug, t.name AS tenant_name
             FROM online_orders o
             JOIN tenants t ON t.id = o.tenant_id
             WHERE o.tenant_id = $1
             ORDER BY o.created_at DESC
             LIMIT $2`,
            [tenantId, limit]
          )
        ).rows
      : (
          await query(
            `SELECT o.id, o.order_number, o.status, o.total::float8, o.customer_name, o.created_at,
                    t.slug AS tenant_slug, t.name AS tenant_name
             FROM online_orders o
             JOIN tenants t ON t.id = o.tenant_id
             ORDER BY o.created_at DESC
             LIMIT $1`,
            [limit]
          )
        ).rows;

    res.json({
      orders: rows.map((row) => ({
        id: row.id,
        orderNumber: row.order_number,
        status: row.status,
        total: row.total,
        customerName: row.customer_name,
        createdAt: row.created_at,
        tenantSlug: row.tenant_slug,
        tenantName: row.tenant_name,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'List orders failed' });
  }
});

export default router;
