import bcrypt from 'bcryptjs';
import { query } from '../db.js';

export const SUPERADMIN_HASH_KEY = 'superadmin_password_hash';

export async function getPlatformSetting(key) {
  const row = (await query(`SELECT value FROM platform_settings WHERE key = $1 LIMIT 1`, [key])).rows[0];
  return row?.value ?? null;
}

export async function setPlatformSetting(key, value) {
  await query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
}

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 12);
}

async function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

/** Saves SUPERADMIN_PASSWORD from .env into Postgres once — survives redeploys and .env resets. */
export async function ensureSuperadminPasswordFromEnv() {
  const existing = await getPlatformSetting(SUPERADMIN_HASH_KEY);
  if (existing) return false;
  const plain = process.env.SUPERADMIN_PASSWORD?.trim();
  if (!plain) return false;
  await setPlatformSetting(SUPERADMIN_HASH_KEY, await hashPassword(plain));
  console.log('[platform] Superadmin password stored in database.');
  return true;
}

export async function setSuperadminPassword(plainPassword) {
  const password = plainPassword?.trim();
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  await setPlatformSetting(SUPERADMIN_HASH_KEY, await hashPassword(password));
}

export async function verifySuperadminPassword(password) {
  const hash = await getPlatformSetting(SUPERADMIN_HASH_KEY);
  if (hash) {
    return verifyPassword(password, hash);
  }
  const expected = process.env.SUPERADMIN_PASSWORD?.trim();
  if (!expected) return false;
  return password === expected;
}
