import dotenv from 'dotenv';
import { pool } from '../src/db.js';
import { generateActivationCode } from '../src/services/licenseService.js';
import { getDefaultTenantId } from '../src/services/tenantService.js';

dotenv.config();

function readArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

async function main() {
  const tenantId = await getDefaultTenantId();
  const validDays = Number(readArg('days', '365'));
  const label = readArg('label', 'Annual license');
  const deviceId = readArg('deviceId', null);

  const code = await generateActivationCode({
    tenantId,
    label,
    validDays,
    boundDeviceId: deviceId,
  });

  console.log('Activation code:', code);
  if (deviceId) console.log('Bound to device:', deviceId);
  console.log('Valid for days:', validDays);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
