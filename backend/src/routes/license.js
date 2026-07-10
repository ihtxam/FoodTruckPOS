import { Router } from 'express';
import { activateLicense, validateLicense } from '../services/licenseService.js';
import { resolveTenantId } from '../services/tenantService.js';

const router = Router();

async function tenantIdFromRequest(req) {
  if (req.tenantId) return req.tenantId;
  const slug = req.body?.tenantSlug ?? req.header('X-Tenant-Slug');
  return resolveTenantId({ tenantSlug: slug, fallbackToDefault: true });
}

router.post('/activate', async (req, res) => {
  try {
    const tenantId = await tenantIdFromRequest(req);
    const { deviceId, activationCode, appVersion, deviceModel } = req.body ?? {};
    if (!deviceId || !activationCode) {
      return res.status(400).json({ error: 'deviceId and activationCode are required' });
    }
    const result = await activateLicense({
      tenantId,
      deviceId,
      activationCode,
      appVersion: appVersion ?? 'unknown',
      deviceModel,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message ?? 'Activation failed' });
  }
});

router.post('/validate', async (req, res) => {
  try {
    const tenantId = await tenantIdFromRequest(req);
    const { deviceId, appVersion } = req.body ?? {};
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }
    const result = await validateLicense({
      tenantId,
      deviceId,
      appVersion: appVersion ?? 'unknown',
    });
    res.json(result);
  } catch (err) {
    res.status(403).json({ error: err.message ?? 'Validation failed' });
  }
});

export default router;
