export function requireSuperadmin(req, res, next) {
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!password) {
    return res.status(503).json({
      error: 'Superadmin is not configured. Set SUPERADMIN_PASSWORD in backend/.env and restart.',
    });
  }

  const authHeader = req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || token !== password) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
