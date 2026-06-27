import dotenv from 'dotenv';
import { pool } from '../src/db.js';
import { clearTenantCache } from '../src/services/tenantService.js';

dotenv.config();

async function main() {
  const slug = process.env.DEFAULT_TENANT_SLUG || 'demo';
  const tenant = (
    await pool.query(
      `INSERT INTO tenants (slug, name, currency_symbol)
       VALUES ($1, $2, 'CHF')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, slug, name`,
      [slug, 'Demo Food Truck']
    )
  ).rows[0];

  clearTenantCache();

  let categoryId = (
    await pool.query(`SELECT id FROM categories WHERE tenant_id = $1 AND name = 'Mains' LIMIT 1`, [tenant.id])
  ).rows[0]?.id;

  if (!categoryId) {
    categoryId = (
      await pool.query(
        `INSERT INTO categories (tenant_id, name, sort_order, color_hex, online_visible)
         VALUES ($1, 'Mains', 1, '#00897B', TRUE)
         RETURNING id`,
        [tenant.id]
      )
    ).rows[0].id;
  }

  if (categoryId) {
    await pool.query(
      `INSERT INTO products (tenant_id, category_id, name, description, price, tax_rate, online_visible, in_stock)
       SELECT $1, $2, 'Classic Burger', 'Demo product for online shop', 14.50, 2.6, TRUE, TRUE
       WHERE NOT EXISTS (
         SELECT 1 FROM products WHERE tenant_id = $1 AND name = 'Classic Burger'
       )`,
      [tenant.id, categoryId]
    );
  }

  console.log('Seed complete:', tenant);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
