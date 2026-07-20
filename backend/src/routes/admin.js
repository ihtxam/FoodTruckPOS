import { Router } from 'express';
import { query } from '../db.js';
import { requireSuperadmin, requireAdminSession } from '../middleware/adminAuth.js';
import {
  createAdminUser,
  formatSessionUser,
  listAdminUsersForTenant,
  loginSuperadmin,
  loginWithEmail,
} from '../services/authService.js';
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

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (email?.trim()) {
      const result = await loginWithEmail(email.trim(), password ?? '');
      return res.json(result);
    }
    const result = await loginSuperadmin(password ?? '');
    return res.json(result);
  } catch (err) {
    return res.status(401).json({ error: err.message ?? 'Login failed' });
  }
});

router.get('/auth/me', requireAdminSession, (req, res) => {
  res.json({ user: formatSessionUser(req.adminSession) });
});

router.get('/auth/check', requireAdminSession, (req, res) => {
  res.json({ ok: true, user: formatSessionUser(req.adminSession) });
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
    const boundDeviceId = deviceId != null && String(deviceId).trim() ? String(deviceId).trim() : null;
    const code = await generateActivationCode({
      tenantId: tenant.id,
      label: label ?? 'Annual license',
      validDays: Number(validDays ?? 365),
      boundDeviceId,
    });

    res.status(201).json({
      code,
      tenantSlug: tenant.slug,
      validDays: Number(validDays ?? 365),
      boundDeviceId,
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

router.get('/tenants/:tenantId/users', async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const users = await listAdminUsersForTenant(tenant.id);
    res.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.is_active,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'List users failed' });
  }
});

router.post('/tenants/:tenantId/users', async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const { email, password, name } = req.body ?? {};
    if (!email?.trim() || !password || password.length < 8) {
      return res.status(400).json({ error: 'email and password (min 8 chars) are required' });
    }

    const user = await createAdminUser({
      email: email.trim(),
      password,
      role: 'MERCHANT',
      tenantId: tenant.id,
      name: name?.trim() || tenant.name,
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenant_id,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Create user failed' });
  }
});

export default router;
