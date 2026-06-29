import { verifySession } from '../services/authService.js';

function legacySuperadminToken(token) {
  const password = process.env.SUPERADMIN_PASSWORD;
  return password && token === password;
}

export function requireAdminSession(req, res, next) {
  const authHeader = req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (legacySuperadminToken(token)) {
    req.adminSession = {
      sub: 'superadmin',
      role: 'SUPERADMIN',
      email: 'superadmin@chaslay.com',
      name: 'Chaslay Superadmin',
    };
    return next();
  }

  const session = verifySession(token);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
  req.adminSession = session;
  next();
}

export function requireSuperadmin(req, res, next) {
  requireAdminSession(req, res, () => {
    if (req.adminSession?.role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    next();
  });
}

export function requireMerchant(req, res, next) {
  requireAdminSession(req, res, () => {
    if (req.adminSession?.role !== 'MERCHANT') {
      return res.status(403).json({ error: 'Merchant access required' });
    }
    if (!req.adminSession.tenantId) {
      return res.status(403).json({ error: 'Merchant account has no shop linked' });
    }
    req.tenantId = req.adminSession.tenantId;
    next();
  });
}
