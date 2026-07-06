import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createReceiptStorage } from './lib/storage.js';
import { sendReceiptEmail } from './lib/smtp.js';
import { renderReceiptPage } from './lib/receiptHtml.js';

const app = express();
const port = Number(process.env.PORT || 8080);
const apiKey = (process.env.API_KEY || '').trim();
const publicBase = (process.env.PUBLIC_RECEIPT_BASE_URL || 'https://pay.chaslay.com/receipts').replace(/\/$/, '');
const storage = createReceiptStorage(process.env.RECEIPTS_DATA_DIR || './data/receipts');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

function requireApiKey(req, res, next) {
  if (!apiKey) return next();
  const provided = (req.header('X-Api-Key') || req.header('x-api-key') || '').trim();
  if (provided !== apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function publicUrl(id) {
  return `${publicBase}/${id}`;
}

function normalizeReceipt(body) {
  const id = String(body.id || '').trim();
  if (!id) throw new Error('id is required');

  return {
    id,
    transaction_number: String(body.transaction_number || id.slice(-8)),
    total: Number(body.total || 0),
    currency: String(body.currency || 'CHF'),
    payment_method: String(body.payment_method || 'UNKNOWN'),
    card_reference: body.card_reference || null,
    business_name: String(body.business_name || 'Chaslay'),
    created_at: Number(body.created_at || Date.now()),
    subtotal: body.subtotal != null ? Number(body.subtotal) : null,
    tax_total: body.tax_total != null ? Number(body.tax_total) : null,
    discount_amount: body.discount_amount != null ? Number(body.discount_amount) : null,
    item_discount_total: body.item_discount_total != null ? Number(body.item_discount_total) : null,
    items: Array.isArray(body.items) ? body.items.map((item) => ({
      product_name: String(item.product_name || 'Item'),
      variant_name: item.variant_name || null,
      quantity: Number(item.quantity || 1),
      line_total: Number(item.line_total || 0),
      line_subtotal: item.line_subtotal != null ? Number(item.line_subtotal) : null,
      line_discount: item.line_discount != null ? Number(item.line_discount) : null,
      unit_price: item.unit_price != null ? Number(item.unit_price) : null
    })) : []
  };
}

/** POS app publishes receipts here */
app.post('/v1/receipts', requireApiKey, async (req, res) => {
  try {
    const receipt = normalizeReceipt(req.body);
    await storage.save(receipt);
    const url = publicUrl(receipt.id);
    res.json({ id: receipt.id, url });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Invalid receipt payload' });
  }
});

/** POS app asks server to email receipt via SMTP */
app.post('/v1/receipts/:id/email', requireApiKey, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    if (!email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }

    const receipt = await storage.get(req.params.id);
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    const url = publicUrl(receipt.id);
    await sendReceiptEmail({
      toEmail: email,
      customerName: req.body.customer_name,
      receiptUrl: url,
      businessName: receipt.business_name,
      transactionNumber: receipt.transaction_number,
      total: receipt.total,
      currency: receipt.currency
    });

    res.json({ success: true, message: `Receipt sent to ${email}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Email failed' });
  }
});

/** JSON API for integrations */
app.get('/v1/receipts/:id', async (req, res) => {
  const receipt = await storage.get(req.params.id);
  if (!receipt) return res.status(404).json({ error: 'Not found' });
  res.json({ ...receipt, url: publicUrl(receipt.id) });
});

/** Public customer-facing receipt page (reverse-proxy pay.chaslay.com/receipts/:id here) */
app.get('/receipts/:id', async (req, res) => {
  const receipt = await storage.get(req.params.id);
  if (!receipt) return res.status(404).send('Receipt not found');
  res.type('html').send(renderReceiptPage(receipt));
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`Chaslay receipts API listening on :${port}`);
  console.log(`Public receipts: ${publicBase}/:id`);
});
