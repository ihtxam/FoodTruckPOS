import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { resolveTenantId } from './tenantService.js';
import {
  getPlatformSetting,
  setSuperadminPassword,
  SUPERADMIN_HASH_KEY,
  verifySuperadminPassword,
} from './platformSettingsService.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sessionSecret() {
  return process.env.LICENSE_SECRET || process.env.SUPERADMIN_PASSWORD || 'dev-session-secret-change-me';
}

export function signSession(payload) {
  const body = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', sessionSecret()).update(data).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function findAdminUserByEmail(email) {
  return (
    await query(
      `SELECT u.*, t.slug AS tenant_slug, t.name AS tenant_name, a.slug AS agency_slug, a.name AS agency_name
       FROM admin_users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN agencies a ON a.id = u.agency_id
       WHERE LOWER(u.email) = LOWER($1) AND u.is_active = TRUE
       LIMIT 1`,
      [email.trim()]
    )
  ).rows[0] ?? null;
}

export async function createAdminUser({ email, password, role, tenantId = null, agencyId = null, name = null }) {
  const passwordHash = await hashPassword(password);
  const row = (
    await query(
      `INSERT INTO admin_users (email, password_hash, role, tenant_id, agency_id, name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, tenant_id, agency_id, name, created_at`,
      [email.trim().toLowerCase(), passwordHash, role, tenantId, agencyId, name]
    )
  ).rows[0];
  return row;
}

export async function listAdminUsersForTenant(tenantId) {
  return (
    await query(
      `SELECT id, email, role, name, is_active, created_at, last_login_at
       FROM admin_users WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    )
  ).rows;
}

export async function touchLastLogin(userId) {
  await query(`UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`, [userId]);
}

export function formatSessionUser(userRow) {
  return {
    id: userRow.sub || userRow.id,
    role: userRow.role,
    email: userRow.email ?? null,
    name: userRow.name ?? null,
    tenantId: userRow.tenantId ?? userRow.tenant_id ?? null,
    tenantSlug: userRow.tenantSlug ?? userRow.tenant_slug ?? null,
    tenantName: userRow.tenantName ?? userRow.tenant_name ?? null,
    agencyId: userRow.agencyId ?? userRow.agency_id ?? null,
  };
}

export async function loginPosMerchant(email, password, tenantSlug) {
  const user = await findAdminUserByEmail(email);
  if (!user || user.role !== 'MERCHANT') throw new Error('Invalid email or password');

  if (tenantSlug) {
    const tenantId = await resolveTenantId({ tenantSlug, fallbackToDefault: false });
    if (!tenantId || user.tenant_id !== tenantId) throw new Error('Invalid email or password');
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw new Error('Invalid email or password');

  if (!user.tenant_id) throw new Error('Merchant account is not linked to a shop');

  await touchLastLogin(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? user.email,
      role: user.role,
      tenantSlug: user.tenant_slug,
      tenantName: user.tenant_name,
    },
  };
}

export async function loginWithEmail(email, password) {
  const user = await findAdminUserByEmail(email);
  if (!user) throw new Error('Invalid email or password');
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw new Error('Invalid email or password');

  if (user.role === 'MERCHANT' && !user.tenant_id) {
    throw new Error('Merchant account is not linked to a shop');
  }

  await touchLastLogin(user.id);

  const token = signSession({
    sub: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
    tenantId: user.tenant_id,
    tenantSlug: user.tenant_slug,
    tenantName: user.tenant_name,
    agencyId: user.agency_id,
  });

  return {
    token,
    user: formatSessionUser(user),
  };
}

export async function loginSuperadmin(password) {
  const ok = await verifySuperadminPassword(password);
  if (!ok) {
    throw new Error('Invalid password');
  }
  const hash = await getPlatformSetting(SUPERADMIN_HASH_KEY);
  if (!hash) {
    await setSuperadminPassword(password);
  }
  const token = signSession({
    sub: 'superadmin',
    role: 'SUPERADMIN',
    email: 'superadmin@chaslay.com',
    name: 'Chaslay Superadmin',
  });
  return {
    token,
    user: formatSessionUser({
      id: 'superadmin',
      role: 'SUPERADMIN',
      email: 'superadmin@chaslay.com',
      name: 'Chaslay Superadmin',
    }),
  };
}
