import { query } from '../db.js';

let cachedTenantId = null;

export async function getDefaultTenantId() {
  if (cachedTenantId) return cachedTenantId;
  const slug = process.env.DEFAULT_TENANT_SLUG || 'demo';
  const row = (await query(`SELECT id FROM tenants WHERE slug = $1 LIMIT 1`, [slug])).rows[0];
  if (!row) {
    throw new Error(`Tenant '${slug}' not found. Run npm run seed`);
  }
  cachedTenantId = row.id;
  return cachedTenantId;
}

export function clearTenantCache() {
  cachedTenantId = null;
}
