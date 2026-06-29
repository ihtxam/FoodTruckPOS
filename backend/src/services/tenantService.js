import crypto from 'crypto';
import { query } from '../db.js';

let cachedDefaultTenantId = null;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidTenantSlug(slug) {
  return typeof slug === 'string' && SLUG_PATTERN.test(slug);
}

export function generateTenantApiKey() {
  return crypto.randomBytes(24).toString('base64url');
}

export async function getDefaultTenantId() {
  if (cachedDefaultTenantId) return cachedDefaultTenantId;
  const slug = process.env.DEFAULT_TENANT_SLUG || 'demo';
  const row = (await query(`SELECT id FROM tenants WHERE slug = $1 LIMIT 1`, [slug])).rows[0];
  if (!row) {
    throw new Error(`Tenant '${slug}' not found. Run npm run seed`);
  }
  cachedDefaultTenantId = row.id;
  return cachedDefaultTenantId;
}

export async function getTenantBySlug(slug) {
  if (!isValidTenantSlug(slug)) return null;
  return (await query(
    `SELECT id, slug, name, currency_symbol, shop_enabled
     FROM tenants WHERE slug = $1 LIMIT 1`,
    [slug.toLowerCase()]
  )).rows[0] ?? null;
}

export async function getTenantByApiKey(apiKey) {
  if (!apiKey) return null;
  return (await query(
    `SELECT id, slug, name, currency_symbol, shop_enabled
     FROM tenants WHERE api_key = $1 LIMIT 1`,
    [apiKey]
  )).rows[0] ?? null;
}

export async function resolveTenantId({ tenantSlug, apiKey, fallbackToDefault = true }) {
  if (tenantSlug) {
    const tenant = await getTenantBySlug(tenantSlug);
    if (tenant) return tenant.id;
  }
  if (apiKey) {
    const tenant = await getTenantByApiKey(apiKey);
    if (tenant) return tenant.id;
  }
  if (fallbackToDefault) {
    return getDefaultTenantId();
  }
  return null;
}

export async function createTenant({ slug, name, currencySymbol = 'CHF', apiKey = null }) {
  const normalizedSlug = slug.toLowerCase();
  if (!isValidTenantSlug(normalizedSlug)) {
    throw new Error('Slug must be lowercase letters, numbers, and hyphens only');
  }
  const key = apiKey ?? generateTenantApiKey();
  const row = (
    await query(
      `INSERT INTO tenants (slug, name, currency_symbol, api_key, shop_enabled)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, slug, name, currency_symbol, api_key`,
      [normalizedSlug, name, currencySymbol, key]
    )
  ).rows[0];
  clearTenantCache();
  return row;
}

export function clearTenantCache() {
  cachedDefaultTenantId = null;
}

export async function listTenants() {
  return (
    await query(
      `SELECT t.id, t.slug, t.name, t.currency_symbol, t.api_key, t.shop_enabled, t.created_at,
              (SELECT COUNT(*)::int FROM devices d WHERE d.tenant_id = t.id) AS device_count,
              (SELECT COUNT(*)::int FROM devices d WHERE d.tenant_id = t.id AND d.status = 'ACTIVE' AND d.expires_at > $1) AS active_device_count,
              (SELECT COUNT(*)::int FROM activation_codes ac WHERE ac.tenant_id = t.id AND ac.used_at IS NULL) AS unused_code_count
       FROM tenants t
       ORDER BY t.created_at DESC`,
      [Date.now()]
    )
  ).rows;
}

export async function getTenantById(id) {
  return (await query(
    `SELECT id, slug, name, currency_symbol, api_key, shop_enabled, created_at
     FROM tenants WHERE id = $1 LIMIT 1`,
    [id]
  )).rows[0] ?? null;
}

export async function updateTenant(id, { name, currencySymbol, shopEnabled }) {
  const row = (
    await query(
      `UPDATE tenants SET
         name = COALESCE($2, name),
         currency_symbol = COALESCE($3, currency_symbol),
         shop_enabled = COALESCE($4, shop_enabled)
       WHERE id = $1
       RETURNING id, slug, name, currency_symbol, api_key, shop_enabled, created_at`,
      [id, name ?? null, currencySymbol ?? null, shopEnabled ?? null]
    )
  ).rows[0];
  if (!row) throw new Error('Tenant not found');
  clearTenantCache();
  return row;
}

export async function regenerateTenantApiKey(id) {
  const apiKey = generateTenantApiKey();
  const row = (
    await query(
      `UPDATE tenants SET api_key = $2 WHERE id = $1
       RETURNING id, slug, name, currency_symbol, api_key, shop_enabled, created_at`,
      [id, apiKey]
    )
  ).rows[0];
  if (!row) throw new Error('Tenant not found');
  return row;
}

export function formatTenant(row) {
  if (!row) return null;
  const shopHost = process.env.SHOP_HOST || 'shop.chaslay.com';
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    currencySymbol: row.currency_symbol,
    apiKey: row.api_key,
    shopEnabled: row.shop_enabled,
    createdAt: row.created_at,
    shopUrl: `https://${shopHost}/${row.slug}`,
    deviceCount: row.device_count ?? undefined,
    activeDeviceCount: row.active_device_count ?? undefined,
    unusedCodeCount: row.unused_code_count ?? undefined,
  };
}
