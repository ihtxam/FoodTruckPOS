import { query } from '../db.js';

export async function listCategories(tenantId) {
  return (
    await query(
      `SELECT id, name, sort_order, color_hex, online_visible, kiosk_visible, updated_at
       FROM categories
       WHERE tenant_id = $1 AND deleted_at IS NULL
       ORDER BY sort_order, name`,
      [tenantId]
    )
  ).rows;
}

export async function createCategory(tenantId, data) {
  return (
    await query(
      `INSERT INTO categories (tenant_id, name, sort_order, color_hex, online_visible, kiosk_visible)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, sort_order, color_hex, online_visible, kiosk_visible, updated_at`,
      [
        tenantId,
        data.name,
        data.sortOrder ?? 0,
        data.colorHex ?? '#00897B',
        data.onlineVisible ?? true,
        data.kioskVisible ?? true,
      ]
    )
  ).rows[0];
}

export async function updateCategory(tenantId, categoryId, data) {
  const row = (
    await query(
      `UPDATE categories SET
         name = COALESCE($3, name),
         sort_order = COALESCE($4, sort_order),
         color_hex = COALESCE($5, color_hex),
         online_visible = COALESCE($6, online_visible),
         kiosk_visible = COALESCE($7, kiosk_visible),
         updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id, name, sort_order, color_hex, online_visible, kiosk_visible, updated_at`,
      [
        tenantId,
        categoryId,
        data.name ?? null,
        data.sortOrder ?? null,
        data.colorHex ?? null,
        data.onlineVisible ?? null,
        data.kioskVisible ?? null,
      ]
    )
  ).rows[0];
  if (!row) throw new Error('Category not found');
  return row;
}

export async function deleteCategory(tenantId, categoryId) {
  const row = (
    await query(
      `UPDATE categories SET deleted_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [tenantId, categoryId]
    )
  ).rows[0];
  if (!row) throw new Error('Category not found');
}

export async function listProducts(tenantId) {
  return (
    await query(
      `SELECT id, category_id, name, description, price::float8, tax_rate::float8, sku, image_url,
              sort_order, in_stock, online_visible, kiosk_visible, updated_at
       FROM products
       WHERE tenant_id = $1 AND deleted_at IS NULL
       ORDER BY sort_order, name`,
      [tenantId]
    )
  ).rows;
}

export async function createProduct(tenantId, data) {
  return (
    await query(
      `INSERT INTO products (
         tenant_id, category_id, name, description, price, tax_rate, sku, image_url,
         sort_order, in_stock, online_visible, kiosk_visible
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, category_id, name, description, price::float8, tax_rate::float8, sku, image_url,
                 sort_order, in_stock, online_visible, kiosk_visible, updated_at`,
      [
        tenantId,
        data.categoryId ?? null,
        data.name,
        data.description ?? null,
        data.price ?? 0,
        data.taxRate ?? 0,
        data.sku ?? null,
        data.imageUrl ?? null,
        data.sortOrder ?? 0,
        data.inStock ?? true,
        data.onlineVisible ?? true,
        data.kioskVisible ?? true,
      ]
    )
  ).rows[0];
}

export async function updateProduct(tenantId, productId, data) {
  const row = (
    await query(
      `UPDATE products SET
         category_id = COALESCE($3, category_id),
         name = COALESCE($4, name),
         description = COALESCE($5, description),
         price = COALESCE($6, price),
         tax_rate = COALESCE($7, tax_rate),
         sku = COALESCE($8, sku),
         image_url = COALESCE($9, image_url),
         sort_order = COALESCE($10, sort_order),
         in_stock = COALESCE($11, in_stock),
         online_visible = COALESCE($12, online_visible),
         kiosk_visible = COALESCE($13, kiosk_visible),
         updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id, category_id, name, description, price::float8, tax_rate::float8, sku, image_url,
                 sort_order, in_stock, online_visible, kiosk_visible, updated_at`,
      [
        tenantId,
        productId,
        data.categoryId ?? null,
        data.name ?? null,
        data.description ?? null,
        data.price ?? null,
        data.taxRate ?? null,
        data.sku ?? null,
        data.imageUrl ?? null,
        data.sortOrder ?? null,
        data.inStock ?? null,
        data.onlineVisible ?? null,
        data.kioskVisible ?? null,
      ]
    )
  ).rows[0];
  if (!row) throw new Error('Product not found');
  return row;
}

export async function deleteProduct(tenantId, productId) {
  const row = (
    await query(
      `UPDATE products SET deleted_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [tenantId, productId]
    )
  ).rows[0];
  if (!row) throw new Error('Product not found');
}

export function formatCategory(row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    colorHex: row.color_hex,
    onlineVisible: row.online_visible,
    kioskVisible: row.kiosk_visible,
    updatedAt: row.updated_at,
  };
}

export function formatProduct(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    price: row.price,
    taxRate: row.tax_rate,
    sku: row.sku,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    inStock: row.in_stock,
    onlineVisible: row.online_visible,
    kioskVisible: row.kiosk_visible,
    updatedAt: row.updated_at,
  };
}
