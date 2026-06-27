export function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) {
    return res.status(500).json({ error: 'API_KEY is not configured on server' });
  }
  const provided = req.header('X-Api-Key');
  if (provided !== expected) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}
