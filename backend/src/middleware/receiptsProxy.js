const RECEIPTS_INTERNAL_URL = (
  process.env.RECEIPTS_INTERNAL_URL || 'http://receipts:8080'
).replace(/\/$/, '');

/** Forward /v1/receipts* to the receipts container (same Docker network). */
export function proxyReceiptsRoutes(req, res, next) {
  if (!req.path.startsWith('/v1/receipts')) {
    return next();
  }

  const targetUrl = `${RECEIPTS_INTERNAL_URL}${req.originalUrl}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null || key === 'host' || key === 'content-length') continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, value);
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  if (hasBody) {
    headers.set('content-type', 'application/json');
  }
  fetch(targetUrl, {
    method: req.method,
    headers,
    body: hasBody ? JSON.stringify(req.body ?? {}) : undefined
  })
    .then(async (upstream) => {
      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'transfer-encoding') return;
        res.setHeader(key, value);
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      res.send(body);
    })
    .catch((error) => {
      console.error('Receipts proxy failed:', error);
      res.status(502).json({
        error: 'Receipts service unavailable',
        detail: error.message
      });
    });
}
