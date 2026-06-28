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
