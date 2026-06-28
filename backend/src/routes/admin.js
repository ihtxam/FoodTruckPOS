import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTenantBySlug } from '../services/tenantService.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminHtml = path.join(__dirname, '..', '..', 'public', 'admin', 'index.html');

router.get('/', (_req, res) => {
  res.sendFile(adminHtml);
});

router.get('/tenants/:tenantSlug', async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json({
      slug: tenant.slug,
      name: tenant.name,
      currencySymbol: tenant.currency_symbol,
      shopEnabled: tenant.shop_enabled,
      shopUrl: `https://shop.chaslay.com/${tenant.slug}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message ?? 'Lookup failed' });
  }
});

export default router;
