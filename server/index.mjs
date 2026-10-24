import express from 'express';
import { Readable } from 'node:stream';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from './api-handler.mjs';

// Optional standalone adapter for CLI/tests. Production Next.js calls the same handler directly.
export function createApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  const handle = createApiHandler(options);
  app.use(async (req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      const body = !['GET', 'HEAD'].includes(req.method) ? Readable.toWeb(req) : undefined;
      const request = new Request(`http://${req.headers.host}${req.originalUrl}`, {
        method: req.method,
        headers,
        ...(body ? { body, duplex: 'half' } : {}),
      });
      const response = await handle(request, { ip: req.ip });
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  });
  app.use((error, _req, res, _next) => res.status(500).json({ error: 'Server belum siap.' }));
  return app;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1');
}
