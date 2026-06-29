import path from 'path';
import { fileURLToPath } from 'url';
import { getTenantBySlug, isValidTenantSlug } from '../services/tenantService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shopHtml = path.join(__dirname, '..', '..', 'public', 'shop.html');
const landingHtml = path.join(__dirname, '..', '..', 'public', 'shop-landing.html');

const SHOP_HOST = process.env.SHOP_HOST || 'shop.chaslay.com';
const RESERVED = new Set(['v1', 'health', 'admin', 'assets', 'favicon.ico', 'shop.html']);

function isShopHost(hostname) {
  if (!hostname) return false;
  return hostname === SHOP_HOST || hostname.startsWith('shop.');
}

export function registerShopSiteRoutes(app) {
  app.get('/', async (req, res, next) => {
    if (!isShopHost(req.hostname)) return next();
    return res.sendFile(landingHtml);
  });

  app.get('/:tenantSlug', async (req, res, next) => {
    if (!isShopHost(req.hostname)) return next();

    const { tenantSlug } = req.params;
    if (RESERVED.has(tenantSlug)) return next();

    if (!isValidTenantSlug(tenantSlug)) {
      return res.status(404).send('Shop not found');
    }

    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant || !tenant.shop_enabled) {
      return res.status(404).send('Shop not found');
    }

    return res.sendFile(shopHtml);
  });
}

const ADMIN_HOST = process.env.ADMIN_HOST || 'admin.chaslay.com';
const adminDir = path.join(__dirname, '..', '..', 'public', 'admin');
const adminHtml = path.join(adminDir, 'index.html');

function isAdminHost(hostname) {
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  return hostname === ADMIN_HOST || hostname.startsWith('admin.');
}

export function registerAdminSiteRoutes(app) {
  app.get('/', (req, res, next) => {
    if (!isAdminHost(req.hostname)) return next();
    return res.sendFile(adminHtml);
  });
}
