import crypto from 'crypto';
import { query } from '../db.js';

function hashCode(code) {
  const secret = process.env.LICENSE_SECRET || 'dev-secret-change-me';
  const normalized = normalizeCode(code).replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(`${secret}:${normalized}`).digest('hex');
}

export function normalizeDeviceId(deviceId) {
  if (!deviceId) return '';
  const clean = deviceId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
  }
  return deviceId.trim().toUpperCase();
}

function deviceIdsMatch(stored, incoming) {
  if (!stored) return true;
  const a = normalizeDeviceId(stored);
  const b = normalizeDeviceId(incoming);
  if (a === b) return true;
  return stored.trim().toUpperCase() === incoming.trim().toUpperCase();
}

export function normalizeCode(code) {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function formatCodeForDisplay(raw) {
  const clean = normalizeCode(raw).replace(/[^A-Z0-9]/g, '');
  return clean.match(/.{1,4}/g)?.join('-') ?? clean;
}

export async function generateActivationCode({ tenantId, label, validDays = 365, boundDeviceId = null }) {
  const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
  const code = formatCodeForDisplay(raw);
  const codeHash = hashCode(code);
  const boundId = boundDeviceId ? normalizeDeviceId(boundDeviceId) : null;
  await query(
    `INSERT INTO activation_codes (tenant_id, code_hash, label, valid_days, bound_device_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [tenantId, codeHash, label ?? null, validDays, boundId]
  );
  return code;
}

export async function activateLicense({ tenantId, deviceId, activationCode, appVersion, deviceModel }) {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const codeHash = hashCode(activationCode);
  const codeRow = (
    await query(
      `SELECT * FROM activation_codes
       WHERE tenant_id = $1 AND code_hash = $2 AND used_at IS NULL
       LIMIT 1`,
      [tenantId, codeHash]
    )
  ).rows[0];

  if (!codeRow) {
    throw new Error('Invalid or already used activation code');
  }
  if (codeRow.bound_device_id && !deviceIdsMatch(codeRow.bound_device_id, deviceId)) {
    throw new Error('This activation code is bound to another device');
  }
  if (codeRow.expires_at && new Date(codeRow.expires_at).getTime() < Date.now()) {
    throw new Error('Activation code has expired');
  }

  const expiresAt = Date.now() + codeRow.valid_days * 24 * 60 * 60 * 1000;
  const customerName = codeRow.label || 'Licensed merchant';
  const planLabel = `${codeRow.valid_days}-day license`;

  await query(
    `INSERT INTO devices (tenant_id, device_id, device_model, app_version, customer_name, plan_label, status, expires_at, activated_at, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, NOW(), NOW())
     ON CONFLICT (tenant_id, device_id) DO UPDATE SET
       device_model = EXCLUDED.device_model,
       app_version = EXCLUDED.app_version,
       customer_name = EXCLUDED.customer_name,
       plan_label = EXCLUDED.plan_label,
       status = 'ACTIVE',
       expires_at = EXCLUDED.expires_at,
       activated_at = COALESCE(devices.activated_at, NOW()),
       last_seen_at = NOW()`,
    [tenantId, normalizedDeviceId, deviceModel ?? null, appVersion, customerName, planLabel, expiresAt]
  );

  await query(`UPDATE activation_codes SET used_at = NOW(), bound_device_id = $2 WHERE id = $1`, [
    codeRow.id,
    normalizedDeviceId,
  ]);

  return { status: 'ACTIVE', expiresAt, customerName, planLabel };
}

export async function validateLicense({ tenantId, deviceId, appVersion }) {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  let device = (
    await query(`SELECT * FROM devices WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`, [tenantId, normalizedDeviceId])
  ).rows[0];

  if (!device && deviceId.trim() !== normalizedDeviceId) {
    device = (
      await query(`SELECT * FROM devices WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`, [tenantId, deviceId.trim()])
    ).rows[0];
  }

  if (!device) {
    throw new Error('Device is not activated');
  }

  await query(`UPDATE devices SET app_version = $2, last_seen_at = NOW() WHERE id = $1`, [device.id, appVersion]);

  if (Number(device.expires_at) <= Date.now()) {
    await query(`UPDATE devices SET status = 'EXPIRED' WHERE id = $1`, [device.id]);
    throw new Error('License expired');
  }

  return {
    status: device.status,
    expiresAt: Number(device.expires_at),
    customerName: device.customer_name,
    planLabel: device.plan_label,
  };
}

export async function listDevicesByTenant(tenantId) {
  return (
    await query(
      `SELECT id, device_id, device_model, app_version, customer_name, plan_label, status,
              expires_at, activated_at, last_seen_at
       FROM devices
       WHERE tenant_id = $1
       ORDER BY activated_at DESC NULLS LAST, last_seen_at DESC NULLS LAST`,
      [tenantId]
    )
  ).rows;
}

export async function listActivationCodesByTenant(tenantId) {
  return (
    await query(
      `SELECT id, label, valid_days, bound_device_id, expires_at, used_at, created_at
       FROM activation_codes
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [tenantId]
    )
  ).rows;
}

export async function extendDeviceLicense({ tenantId, deviceRowId, extraDays }) {
  const days = Number(extraDays);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('extraDays must be a positive number');
  }
  const device = (
    await query(`SELECT * FROM devices WHERE id = $1 AND tenant_id = $2`, [deviceRowId, tenantId])
  ).rows[0];
  if (!device) throw new Error('Device not found');

  const base = Math.max(Number(device.expires_at), Date.now());
  const expiresAt = base + days * 24 * 60 * 60 * 1000;
  await query(
    `UPDATE devices SET expires_at = $2, status = 'ACTIVE', last_seen_at = NOW() WHERE id = $1`,
    [deviceRowId, expiresAt]
  );
  return { expiresAt, status: 'ACTIVE' };
}

export async function updateDeviceStatus({ tenantId, deviceRowId, status }) {
  if (!['ACTIVE', 'EXPIRED'].includes(status)) {
    throw new Error('status must be ACTIVE or EXPIRED');
  }
  const row = (
    await query(
      `UPDATE devices SET status = $3, last_seen_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, status, expires_at`,
      [deviceRowId, tenantId, status]
    )
  ).rows[0];
  if (!row) throw new Error('Device not found');
  return { status: row.status, expiresAt: Number(row.expires_at) };
}

export function formatDevice(row) {
  return {
    id: row.id,
    deviceId: row.device_id,
    deviceModel: row.device_model,
    appVersion: row.app_version,
    customerName: row.customer_name,
    planLabel: row.plan_label,
    status: row.status,
    expiresAt: Number(row.expires_at),
    activatedAt: row.activated_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function formatActivationCode(row) {
  return {
    id: row.id,
    label: row.label,
    validDays: row.valid_days,
    boundDeviceId: row.bound_device_id,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
    isUsed: Boolean(row.used_at),
  };
}
