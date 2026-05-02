import { serve, type ServerType } from '@hono/node-server';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { prisma } from '@ssas/database';
import { disconnectCache, initCache } from '@ssas/storage';
import { errorHandler } from './middleware/error.js';
import { auditMiddleware } from './middleware/audit.js';
import { rateLimit, RateLimitPresets, disconnectRateLimit } from './middleware/rate-limit.js';
import { dataRoutes } from './routes/data.js';
import { deviceRoutes } from './routes/device.js';
import { analyticsRoutes } from './routes/analytics.js';
import { alertRoutes } from './routes/alerts.js';
import { dashboardRoutes } from './routes/dashboards.js';
import { authRoutes } from './routes/auth.js';
import { cdpRoutes } from './routes/cdp.js';
import { settingsRoutes } from './routes/settings.js';

const app = new Hono();
const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? '0.0.0.0';

// Global middleware
app.use('*', cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
}));
app.use('*', logger());
app.use('*', secureHeaders());

// Rate limiting (global)
app.use('/api/*', rateLimit(RateLimitPresets.api));

// Audit logging for write operations
app.use('/api/*', auditMiddleware);

// Error handler (must be after middleware)
app.onError(errorHandler);

// Health check (no auth required)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Readiness probe — verifies DB connectivity
app.get('/ready', async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ status: 'ready' });
  } catch {
    return c.json({ status: 'not ready' }, 503);
  }
});

// Auth routes (stricter rate limit)
app.use('/api/v1/auth/*', rateLimit(RateLimitPresets.auth));
app.route('/api/v1/auth', authRoutes);

// Mount API routes
app.route('/api/v1/data', dataRoutes);
app.route('/api/v1/devices', deviceRoutes);

// Analytics routes (stricter rate limit - expensive queries)
app.use('/api/v1/analytics/*', rateLimit(RateLimitPresets.analytics));
app.route('/api/v1/analytics', analyticsRoutes);

app.route('/api/v1/alerts', alertRoutes);
app.route('/api/v1/dashboards', dashboardRoutes);
app.route('/api/v1/cdp', cdpRoutes);
app.route('/api/v1/settings', settingsRoutes);

// 404 handler
app.notFound((c) => c.json({ code: 404, message: 'Not found' }, 404));

export default app;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let server: ServerType;

  await initCache();

  server = serve({
    fetch: app.fetch,
    port,
    hostname: host,
  }, (info) => {
    console.log(`[api] listening on http://${info.address}:${info.port}`);
  });

  // Graceful shutdown
  async function shutdown() {
    console.log('[api] shutting down...');

    // Stop accepting new connections
    server.close(() => {
      console.log('[api] HTTP server closed');
    });

    // Disconnect resources
    await disconnectRateLimit();
    await disconnectCache();
    await prisma.$disconnect();
    console.log('[api] database disconnected');

    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
