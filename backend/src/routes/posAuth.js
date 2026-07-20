import { Router } from 'express';
import { loginPosMerchant } from '../services/authService.js';

const router = Router();

/** Android POS email login — generic app matches merchant by email; optional tenantSlug for branded builds. */
router.post('/login', async (req, res) => {
  try {
    const { email, password, tenantSlug } = req.body ?? {};
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const slug = tenantSlug?.trim() || req.header('X-Tenant-Slug')?.trim() || null;
    const result = await loginPosMerchant(email.trim(), password, slug);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message ?? 'Invalid credentials' });
  }
});

export default router;
