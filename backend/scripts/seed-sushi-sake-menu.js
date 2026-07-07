import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db.js';
import { clearTenantCache } from '../src/services/tenantService.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const menu = JSON.parse(fs.readFileSync(path.join(__dirname, 'sushi-sake-menu-data.json'), 'utf8'));

function slugFromArgs() {
  const arg = process.argv.find((a) => a.startsWith('--slug='));
  return (arg?.split('=')[1] || process.env.SEED_TENANT_SLUG || 'sushi-sake').trim().toLowerCase();
}

async function main() {
  const slug = slugFromArgs();
  const tenant = (await pool.query(`SELECT id, slug, name FROM tenants WHERE slug = $1 LIMIT 1`, [slug])).rows[0];
  if (!tenant) {
    throw new Error(`Tenant "${slug}" not found. Run: npm run create-tenant -- --slug=${slug} --name="Sushi Sake"`);
  }

  await pool.query(`UPDATE tenants SET shop_enabled = TRUE WHERE id = $1`, [tenant.id]);
  clearTenantCache();

  const categoryIds = [];
  for (const cat of menu.categories) {
    let row = (
      await pool.query(
        `SELECT id FROM categories WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
        [tenant.id, cat.name]
      )
    ).rows[0];

    if (!row) {
      row = (
        await pool.query(
          `INSERT INTO categories (tenant_id, name, sort_order, color_hex, online_visible)
           VALUES ($1, $2, $3, $4, TRUE)
           RETURNING id`,
          [tenant.id, cat.name, cat.sort, cat.color]
        )
      ).rows[0];
    } else {
      await pool.query(
        `UPDATE categories SET sort_order = $2, color_hex = $3, online_visible = TRUE WHERE id = $1`,
        [row.id, cat.sort, cat.color]
      );
    }
    categoryIds[cat.sort] = row.id;
  }

  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < menu.items.length; i += 1) {
    const item = menu.items[i];
    const categoryId = categoryIds[item.cat];
    if (!categoryId) {
      console.warn('Skip (missing category):', item.name);
      continue;
    }
    const exists = (
      await pool.query(
        `SELECT 1 FROM products WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
        [tenant.id, item.name]
      )
    ).rows[0];
    if (exists) {
      skipped += 1;
      continue;
    }
    await pool.query(
      `INSERT INTO products (tenant_id, category_id, name, description, price, tax_rate, online_visible, in_stock, sort_order)
       VALUES ($1, $2, $3, '', $4, 2.6, TRUE, TRUE, $5)`,
      [tenant.id, categoryId, item.name, item.price, i + 1]
    );
    inserted += 1;
  }

  const diversCat = categoryIds[9];
  if (diversCat) {
    const diversExists = (
      await pool.query(
        `SELECT 1 FROM products WHERE tenant_id = $1 AND name = 'Divers' LIMIT 1`,
        [tenant.id]
      )
    ).rows[0];
    if (!diversExists) {
      await pool.query(
        `INSERT INTO products (tenant_id, category_id, name, description, price, tax_rate, online_visible, in_stock, sort_order)
         VALUES ($1, $2, 'Divers', '', 0, 2.6, FALSE, TRUE, 900)`,
        [tenant.id, diversCat]
      );
      inserted += 1;
    }
  }

  const counts = (
    await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM categories WHERE tenant_id = $1) AS categories,
         (SELECT COUNT(*)::int FROM products WHERE tenant_id = $1 AND online_visible = TRUE) AS online_products`,
      [tenant.id]
    )
  ).rows[0];

  console.log(`Menu seed complete for ${tenant.name} (${tenant.slug})`);
  console.log(`Inserted ${inserted} products, skipped ${skipped} existing`);
  console.log(`Totals: ${counts.categories} categories, ${counts.online_products} online-visible products`);
  console.log(`Shop: https://shop.chaslay.com/${tenant.slug}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
