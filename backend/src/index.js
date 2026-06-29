import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import licenseRoutes from './routes/license.js';
import syncRoutes from './routes/sync.js';
import ordersRoutes from './routes/orders.js';
import shopRoutes from './routes/shop.js';
import adminRoutes from './routes/admin.js';
import merchantRoutes from './routes/merchant.js';
import { requireApiKey } from './middleware/auth.js';
import { registerShopSiteRoutes, registerAdminSiteRoutes } from './middleware/shopSite.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'chaslay-api', time: Date.now() });
});

/** Android POS licensing */
app.use('/v1/license', licenseRoutes);

/** POS sync  tenant resolved from X-Api-Key */
app.use('/v1/sync', requireApiKey, syncRoutes);

/** Public online shop API: /v1/shop/{clientName}/menu|orders */
app.use('/v1/shop', shopRoutes);

/** Legacy single-tenant order routes (default tenant) */
app.use('/v1/orders', ordersRoutes);

/** Superadmin API + panel at admin.chaslay.com */
app.use('/v1/admin', adminRoutes);

/** Merchant portal API (menu, orders, settings) */
app.use('/v1/admin/merchant', merchantRoutes);

/** Host-specific pages BEFORE static files (otherwise public/index.html hijacks /) */
registerAdminSiteRoutes(app);
registerShopSiteRoutes(app);

app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Chaslay API listening on :${port}`);
});
