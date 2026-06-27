import crypto from 'crypto';
import { query } from '../db.js';

function hashCode(code) {
  const secret = process.env.LICENSE_SECRET || 'dev-secret-change-me';
  return crypto.createHash('sha256').update(`${secret}:${code.trim().toUpperCase()}`).digest('hex');
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
  await query(
    `INSERT INTO activation_codes (tenant_id, code_hash, label, valid_days, bound_device_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [tenantId, codeHash, label ?? null, validDays, boundDeviceId]
  );
  return code;
}

export async function activateLicense({ tenantId, deviceId, activationCode, appVersion, deviceModel }) {
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
  if (codeRow.bound_device_id && codeRow.bound_device_id !== deviceId) {
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
    [tenantId, deviceId, deviceModel ?? null, appVersion, customerName, planLabel, expiresAt]
  );

  await query(`UPDATE activation_codes SET used_at = NOW(), bound_device_id = $2 WHERE id = $1`, [
    codeRow.id,
    deviceId,
  ]);

  return { status: 'ACTIVE', expiresAt, customerName, planLabel };
}

export async function validateLicense({ tenantId, deviceId, appVersion }) {
  const device = (
    await query(`SELECT * FROM devices WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`, [tenantId, deviceId])
  ).rows[0];

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
