import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { AnalyticsEngine } from '@ssas/analytics';
import { getTenantId, userAuthMiddleware } from '../middleware/auth.js';

const analyticsRoutes = new Hono();
analyticsRoutes.use('*', userAuthMiddleware);

const filterOperatorSchema = z.enum(['=', '!=', '>', '<', '>=', '<=', 'in', 'contains']);
const queryFilterSchema = z.object({
  field: z.string(),
  operator: filterOperatorSchema,
  value: z.any(),
}).required();

// ======================
// Validation schemas
// ======================

const eventSchema = z.object({
  eventName: z.string().min(1).max(100),
  aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count', 'last']).default('avg'),
  groupBy: z.array(z.string()).optional(),
  timeRange: z.object({ start: z.string().datetime(), end: z.string().datetime() }),
  granularity: z.enum(['1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d']).default('1h'),
  filters: z.array(queryFilterSchema).optional(),
});

const trendSchema = z.object({
  eventName: z.string().min(1).max(100),
  aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count']).default('avg'),
  timeRange: z.object({ start: z.string().datetime(), end: z.string().datetime() }),
  granularity: z.enum(['1h', '6h', '12h', '1d']).default('1d'),
  compareWith: z.enum(['prev_period', 'year_over_year']).default('prev_period'),
});

const distributionSchema = z.object({
  eventName: z.string().min(1).max(100),
  buckets: z.array(z.number()).optional(),
  timeRange: z.object({ start: z.string().datetime(), end: z.string().datetime() }),
});

const funnelSchema = z.object({
  steps: z.array(z.object({
    name: z.string(),
    eventName: z.string(),
    filters: z.array(queryFilterSchema).optional(),
  })).min(2).max(10),
  windowSeconds: z.number().int().default(3600),
  timeRange: z.object({ start: z.string().datetime(), end: z.string().datetime() }),
});

const retentionSchema = z.object({
  initialEvent: z.string(),
  returnEvent: z.string(),
  period: z.enum(['day', 'week', 'month']).default('day'),
  timeRange: z.object({ start: z.string().datetime(), end: z.string().datetime() }),
});

const attributionSchema = z.object({
  targetEvent: z.string(),
  attributionEvents: z.array(z.string()).min(1).max(10),
  lookbackSeconds: z.number().int().default(3600),
  model: z.enum(['first', 'last', 'linear', 'position', 'time_decay']).default('last'),
  timeRange: z.object({ start: z.string().datetime(), end: z.string().datetime() }),
});

// ======================
// Routes
// ======================

analyticsRoutes.post('/event', zValidator('json', eventSchema), async (c) => {
  const params = c.req.valid('json');
  const filters = params.filters as import('@ssas/core').QueryFilter[] | undefined;
  const result = await AnalyticsEngine.event({
    ...params,
    filters,
    tenantId: getTenantId(c),
    timeRange: { start: new Date(params.timeRange.start), end: new Date(params.timeRange.end) },
  });
  if (!result.success) return c.json({ code: 400, message: result.error! }, 400);
  return c.json({ code: 0, message: 'ok', data: result.data });
});

analyticsRoutes.post('/trend', zValidator('json', trendSchema), async (c) => {
  const params = c.req.valid('json');
  const result = await AnalyticsEngine.trend({
    ...params,
    tenantId: getTenantId(c),
    timeRange: { start: new Date(params.timeRange.start), end: new Date(params.timeRange.end) },
  });
  if (!result.success) return c.json({ code: 400, message: result.error! }, 400);
  return c.json({ code: 0, message: 'ok', data: result.data });
});

analyticsRoutes.post('/distribution', zValidator('json', distributionSchema), async (c) => {
  const params = c.req.valid('json');
  const result = await AnalyticsEngine.distribution({
    ...params,
    tenantId: getTenantId(c),
    timeRange: { start: new Date(params.timeRange.start), end: new Date(params.timeRange.end) },
  });
  if (!result.success) return c.json({ code: 400, message: result.error! }, 400);
  return c.json({ code: 0, message: 'ok', data: result.data });
});

analyticsRoutes.post('/funnel', zValidator('json', funnelSchema), async (c) => {
  const params = c.req.valid('json');
  const steps = params.steps as import('@ssas/core').FunnelStep[];
  const result = await AnalyticsEngine.funnel({
    steps,
    tenantId: getTenantId(c),
    windowSeconds: params.windowSeconds,
    timeRange: { start: new Date(params.timeRange.start), end: new Date(params.timeRange.end) },
  });
  if (!result.success) return c.json({ code: 400, message: result.error! }, 400);
  return c.json({ code: 0, message: 'ok', data: result.data });
});

analyticsRoutes.post('/retention', zValidator('json', retentionSchema), async (c) => {
  const params = c.req.valid('json');
  const result = await AnalyticsEngine.retention({
    initialEvent: params.initialEvent,
    returnEvent: params.returnEvent,
    tenantId: getTenantId(c),
    period: params.period,
    timeRange: { start: new Date(params.timeRange.start), end: new Date(params.timeRange.end) },
  });
  if (!result.success) return c.json({ code: 400, message: result.error! }, 400);
  return c.json({ code: 0, message: 'ok', data: result.data });
});

analyticsRoutes.post('/attribution', zValidator('json', attributionSchema), async (c) => {
  const params = c.req.valid('json');
  const result = await AnalyticsEngine.attribution({
    targetEvent: params.targetEvent,
    attributionEvents: params.attributionEvents,
    tenantId: getTenantId(c),
    lookbackSeconds: params.lookbackSeconds,
    model: params.model,
    timeRange: { start: new Date(params.timeRange.start), end: new Date(params.timeRange.end) },
  });
  if (!result.success) return c.json({ code: 400, message: result.error! }, 400);
  return c.json({ code: 0, message: 'ok', data: result.data });
});

export { analyticsRoutes };
