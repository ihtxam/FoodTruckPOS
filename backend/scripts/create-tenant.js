import dotenv from 'dotenv';
import { pool } from '../src/db.js';
import { createTenant } from '../src/services/tenantService.js';

dotenv.config();

function readArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

async function main() {
  const slug = readArg('slug');
  const name = readArg('name');
  const currency = readArg('currency', 'CHF');

  if (!slug || !name) {
    console.error('Usage: npm run create-tenant -- --slug=client-name --name="Shop Name" [--currency=CHF]');
    process.exit(1);
  }

  const tenant = await createTenant({ slug, name, currencySymbol: currency });

  console.log('Tenant created:');
  console.log('  slug:', tenant.slug);
  console.log('  name:', tenant.name);
  console.log('  POS API key (SYNC_API_KEY):', tenant.api_key);
  console.log('  shop URL: https://shop.chaslay.com/' + tenant.slug);
  console.log('');
  console.log('Next: seed menu or sync from POS, then generate a license code for the device.');

  await pool.end();
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
