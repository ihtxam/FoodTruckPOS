import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import licenseRoutes from './routes/license.js';
import posAuthRoutes from './routes/posAuth.js';
import syncRoutes from './routes/sync.js';
import floorRoutes from './routes/floor.js';
import ordersRoutes from './routes/orders.js';
import shopRoutes from './routes/shop.js';
import adminRoutes from './routes/admin.js';
import merchantRoutes from './routes/merchant.js';
import { requireApiKey } from './middleware/auth.js';
import { proxyReceiptsRoutes } from './middleware/receiptsProxy.js';
import { registerShopSiteRoutes, registerAdminSiteRoutes } from './middleware/shopSite.js';
import { ensureSuperadminPasswordFromEnv } from './services/platformSettingsService.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const adminDir = path.join(publicDir, 'admin');

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'chaslay-api', time: Date.now() });
});

/** Digital receipts � proxy to receipts container (POST from POS lands here too). */
app.use(proxyReceiptsRoutes);

/** Android POS licensing */
app.use('/v1/license', licenseRoutes);

/** Android POS merchant login (cloud) */
app.use('/v1/pos/auth', posAuthRoutes);

/** POS sync � tenant resolved from X-Api-Key */
app.use('/v1/sync', requireApiKey, syncRoutes);

/** Floor sync � waiter ? main POS */
app.use('/v1/floor', requireApiKey, floorRoutes);

/** Public online shop API: /v1/shop/{clientName}/menu|orders */
app.use('/v1/shop', shopRoutes);

/** Legacy single-tenant order routes (default tenant) */
app.use('/v1/orders', ordersRoutes);

/** Merchant portal API � must be BEFORE /v1/admin (more specific path first) */
app.use('/v1/admin/merchant', merchantRoutes);

/** Superadmin API + panel at admin.chaslay.com */
app.use('/v1/admin', adminRoutes);

/** Admin panel static files � always at /admin/* (works on localhost and admin.chaslay.com) */
app.use('/admin', express.static(adminDir, { index: 'index.html', maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

/** Host-specific root pages (shop landing, admin login at / on admin domain) */
registerAdminSiteRoutes(app);
registerShopSiteRoutes(app);

app.use(express.static(publicDir, { index: false }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, '0.0.0.0', async () => {
  console.log(`Chaslay API listening on :${port}`);
  try {
    await ensureSuperadminPasswordFromEnv();
  } catch (err) {
    console.error('[platform] Could not sync superadmin password:', err.message ?? err);
  }
});
