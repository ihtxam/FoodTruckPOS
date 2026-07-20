#!/usr/bin/env node
/**
 * Set superadmin password permanently in the database (survives API redeploys).
 * Usage: npm run set-superadmin-password -- "YourNewPassword123"
 */
import dotenv from 'dotenv';
import { pool } from '../src/db.js';
import { setSuperadminPassword } from '../src/services/platformSettingsService.js';

dotenv.config();

const password = process.argv[2]?.trim();
if (!password) {
  console.error('Usage: npm run set-superadmin-password -- "YourPassword123"');
  process.exit(1);
}

try {
  await setSuperadminPassword(password);
  console.log('Superadmin password updated in database. It will persist across deploys.');
} catch (err) {
  console.error(err.message ?? err);
  process.exit(1);
} finally {
  await pool.end();
}
