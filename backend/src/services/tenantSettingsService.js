import { query } from '../db.js';

const DEFAULT_OPENING_HOURS = {
  monday: { open: '09:00', close: '22:00', closed: false },
  tuesday: { open: '09:00', close: '22:00', closed: false },
  wednesday: { open: '09:00', close: '22:00', closed: false },
  thursday: { open: '09:00', close: '22:00', closed: false },
  friday: { open: '09:00', close: '22:00', closed: false },
  saturday: { open: '10:00', close: '23:00', closed: false },
  sunday: { open: '10:00', close: '21:00', closed: false },
};

export async function getTenantSettings(tenantId) {
  let row = (await query(`SELECT * FROM tenant_settings WHERE tenant_id = $1`, [tenantId])).rows[0];
  if (!row) {
    row = (
      await query(
        `INSERT INTO tenant_settings (tenant_id, opening_hours, delivery_zones, order_settings)
         VALUES ($1, $2, '[]', '{}')
         RETURNING *`,
        [tenantId, JSON.stringify(DEFAULT_OPENING_HOURS)]
      )
    ).rows[0];
  }
  return formatSettings(row);
}

export async function updateTenantSettings(tenantId, patch) {
  await getTenantSettings(tenantId);
  const row = (
    await query(
      `UPDATE tenant_settings SET
         opening_hours = COALESCE($2, opening_hours),
         delivery_zones = COALESCE($3, delivery_zones),
         order_settings = COALESCE($4, order_settings),
         updated_at = NOW()
       WHERE tenant_id = $1
       RETURNING *`,
      [
        tenantId,
        patch.openingHours ? JSON.stringify(patch.openingHours) : null,
        patch.deliveryZones ? JSON.stringify(patch.deliveryZones) : null,
        patch.orderSettings ? JSON.stringify(patch.orderSettings) : null,
      ]
    )
  ).rows[0];
  return formatSettings(row);
}

function formatSettings(row) {
  return {
    openingHours: row.opening_hours,
    deliveryZones: row.delivery_zones,
    orderSettings: row.order_settings,
    updatedAt: row.updated_at,
  };
}
