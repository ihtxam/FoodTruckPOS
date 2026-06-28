import { getDefaultTenantId, getTenantByApiKey } from '../services/tenantService.js';

export async function requireApiKey(req, res, next) {
  try {
    const expectedGlobal = process.env.API_KEY;
    const provided = req.header('X-Api-Key');
    if (!provided) {
      return res.status(401).json({ error: 'Missing X-Api-Key header' });
    }

    const tenant = await getTenantByApiKey(provided);
    if (tenant) {
      req.tenantId = tenant.id;
      req.tenantSlug = tenant.slug;
      return next();
    }

    if (expectedGlobal && provided === expectedGlobal) {
      req.tenantId = await getDefaultTenantId();
      return next();
    }

    return res.status(401).json({ error: 'Invalid API key' });
  } catch (err) {
    return res.status(500).json({ error: err.message ?? 'Auth failed' });
  }
}
