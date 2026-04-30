import { serve } from '@hono/node-server';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { errorHandler } from './middleware/error';
import { auditMiddleware } from './middleware/audit';
import { rateLimit, RateLimitPresets } from './middleware/rate-limit';
import { dataRoutes } from './routes/data';
import { deviceRoutes } from './routes/device';
import { analyticsRoutes } from './routes/analytics';
import { alertRoutes } from './routes/alerts';
import { dashboardRoutes } from './routes/dashboards';
import { authRoutes } from './routes/auth';
import { cdpRoutes } from './routes/cdp';
import { settingsRoutes } from './routes/settings';

const app = new Hono();
const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? '0.0.0.0';

// Global middleware
app.use('*', cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
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
  serve({
    fetch: app.fetch,
    port,
    hostname: host,
  }, (info) => {
    console.log(`[api] listening on http://${info.address}:${info.port}`);
  });
}
