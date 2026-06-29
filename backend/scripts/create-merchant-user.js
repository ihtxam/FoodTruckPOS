import dotenv from 'dotenv';
import { pool } from '../src/db.js';
import { createAdminUser } from '../src/services/authService.js';
import { getTenantBySlug } from '../src/services/tenantService.js';

dotenv.config();

function readArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

async function main() {
  const tenantSlug = readArg('tenantSlug');
  const email = readArg('email');
  const password = readArg('password');
  const name = readArg('name');

  if (!tenantSlug || !email || !password) {
    console.error('Usage: npm run create-merchant-user -- --tenantSlug=demo --email=owner@shop.com --password=Secret123 --name="Shop Owner"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    throw new Error(`Tenant '${tenantSlug}' not found`);
  }

  const user = await createAdminUser({
    email,
    password,
    role: 'MERCHANT',
    tenantId: tenant.id,
    name: name || tenant.name,
  });

  console.log('Merchant login created:');
  console.log('  email:', user.email);
  console.log('  tenant:', tenantSlug);
  console.log('  login URL: https://admin.chaslay.com');
  await pool.end();
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
