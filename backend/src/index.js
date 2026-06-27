import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import licenseRoutes from './routes/license.js';
import syncRoutes from './routes/sync.js';
import ordersRoutes from './routes/orders.js';
import { requireApiKey } from './middleware/auth.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'foodtruckpos-api', time: Date.now() });
});

/** Matches Android LicenseApi */
app.use('/v1/license', licenseRoutes);

/** POS sync  protected by API key */
app.use('/v1/sync', requireApiKey, syncRoutes);

/** Orders  incoming/ack protected; public menu + create order open for shop v1 */
app.use('/v1/orders', ordersRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`FoodTruck POS API listening on :${port}`);
});
