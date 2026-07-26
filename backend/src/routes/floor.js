import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

function tenantIdFromRequest(req) {
  if (req.tenantId) return req.tenantId;
  throw new Error('Tenant not resolved from API key');
}

router.post('/register', async (req, res) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    const { deviceId, deviceName, role, lanHost, appVersion } = req.body ?? {};
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    const safeRole = ['MAIN_POS', 'WAITER', 'STANDARD'].includes(role) ? role : 'STANDARD';
    await query(
      `INSERT INTO floor_devices (tenant_id, device_id, device_name, role, lan_host, app_version, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (tenant_id, device_id) DO UPDATE SET
         device_name = EXCLUDED.device_name,
         role = EXCLUDED.role,
         lan_host = EXCLUDED.lan_host,
         app_version = EXCLUDED.app_version,
         last_seen_at = NOW()`,
      [tenantId, deviceId, deviceName ?? null, safeRole, lanHost ?? null, appVersion ?? null]
    );
    res.json({ ok: true, serverTime: Date.now() });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Register failed' });
  }
});

router.get('/main-pos', async (req, res) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    const row = (
      await query(
        `SELECT device_name, lan_host, last_seen_at
         FROM floor_devices
         WHERE tenant_id = $1 AND role = 'MAIN_POS' AND lan_host IS NOT NULL AND lan_host <> ''
         ORDER BY last_seen_at DESC NULLS LAST
         LIMIT 1`,
        [tenantId]
      )
    ).rows[0];
    if (!row) return res.json({ lanHost: null, deviceName: null, lastSeenAt: null });
    res.json({
      lanHost: row.lan_host,
      deviceName: row.device_name,
      lastSeenAt: row.last_seen_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Main POS lookup failed' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    const since = Number(req.query.since || 0);
    const sinceDate = since > 0 ? new Date(since) : new Date(0);
    const rows = (
      await query(
        `SELECT local_order_id, table_id, table_name, status, service_type, user_id, user_name,
                cart_json, source_device_id, updated_at
         FROM floor_table_orders
         WHERE tenant_id = $1 AND updated_at > $2
         ORDER BY updated_at ASC`,
        [tenantId, sinceDate]
      )
    ).rows;
    res.json({ serverTime: Date.now(), orders: rows });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Orders fetch failed' });
  }
});

router.put('/orders/:localOrderId', async (req, res) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    const localOrderId = req.params.localOrderId;
    const body = req.body ?? {};
    if (!localOrderId) return res.status(400).json({ error: 'localOrderId required' });
    await query(
      `INSERT INTO floor_table_orders
         (tenant_id, local_order_id, table_id, table_name, status, service_type, user_id, user_name, cart_json, source_device_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, NOW())
       ON CONFLICT (tenant_id, local_order_id) DO UPDATE SET
         table_id = EXCLUDED.table_id,
         table_name = EXCLUDED.table_name,
         status = EXCLUDED.status,
         service_type = EXCLUDED.service_type,
         user_id = EXCLUDED.user_id,
         user_name = EXCLUDED.user_name,
         cart_json = EXCLUDED.cart_json,
         source_device_id = EXCLUDED.source_device_id,
         updated_at = NOW()`,
      [
        tenantId,
        localOrderId,
        Number(body.tableId ?? 0),
        body.tableName ?? '',
        body.status ?? 'OPEN',
        body.serviceType ?? 'DINE_IN',
        Number(body.userId ?? 0),
        body.userName ?? '',
        JSON.stringify(body.cart ?? {}),
        body.sourceDeviceId ?? '',
      ]
    );
    res.json({ ok: true, serverTime: Date.now() });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Order upsert failed' });
  }
});

router.post('/print-jobs', async (req, res) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    const { jobType, payload, sourceDeviceId, orderId } = req.body ?? {};
    if (!jobType || !payload) return res.status(400).json({ error: 'jobType and payload required' });
    const safeType = jobType === 'RECEIPT' ? 'RECEIPT' : 'KITCHEN';
    const row = (
      await query(
        `INSERT INTO floor_print_jobs (tenant_id, job_type, payload, source_device_id, order_id)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         RETURNING id, created_at`,
        [tenantId, safeType, JSON.stringify(payload), sourceDeviceId ?? '', orderId ?? null]
      )
    ).rows[0];
    res.json({ ok: true, jobId: row.id, createdAt: row.created_at });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Print job create failed' });
  }
});

router.get('/print-jobs/pending', async (req, res) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const rows = (
      await query(
        `SELECT id, job_type, payload, source_device_id, order_id, created_at
         FROM floor_print_jobs
         WHERE tenant_id = $1 AND status = 'PENDING'
         ORDER BY created_at ASC
         LIMIT $2`,
        [tenantId, limit]
      )
    ).rows;
    res.json({ serverTime: Date.now(), jobs: rows });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Print jobs fetch failed' });
  }
});

router.post('/print-jobs/:id/ack', async (req, res) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    const status = req.body?.status === 'FAILED' ? 'FAILED' : 'DONE';
    await query(
      `UPDATE floor_print_jobs SET status = $3, processed_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, req.params.id, status]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Ack failed' });
  }
});

export default router;
