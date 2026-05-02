import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '@ssas/database';
import { getTenantId, userAuthMiddleware } from '../middleware/auth.js';

const alertRoutes = new Hono();
alertRoutes.use('*', userAuthMiddleware);

// ======================
// Validation schemas
// ======================

const conditionSchema = z.object({
  metricName: z.string().min(1).max(100),
  operator: z.enum(['>', '>=', '<', '<=', '==', '!=', 'change_pct', 'anomaly']),
  threshold: z.number(),
  duration: z.number().int().optional(),     // consecutive evaluations
  window: z.string().optional(),              // evaluation window, e.g. "5m", "1h"
});

const channelSchema = z.object({
  type: z.enum(['webhook', 'email', 'sms', 'app_push']),
  config: z.record(z.string()),
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  conditions: z.array(conditionSchema).min(1).max(20),
  conditionLogic: z.enum(['all', 'any']).default('all'),
  channels: z.array(channelSchema).min(1),
  silenceSeconds: z.number().int().default(300),
  enabled: z.boolean().default(true),
});

const updateRuleSchema = createRuleSchema.partial();

// ======================
// Routes
// ======================

/**
 * GET /api/v1/alerts/rules
 * List alert rules.
 */
alertRoutes.get('/rules', async (c) => {
  const tenantId = getTenantId(c);
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  const [data, total] = await Promise.all([
    prisma.alertRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.alertRule.count({ where: { tenantId } }),
  ]);

  return c.json({
    code: 0, message: 'ok',
    data, total, page, pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

/**
 * POST /api/v1/alerts/rules
 * Create an alert rule.
 */
alertRoutes.post('/rules', zValidator('json', createRuleSchema), async (c) => {
  const data = c.req.valid('json');
  const tenantId = getTenantId(c);

  const rule = await prisma.alertRule.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description,
      conditions: data.conditions as never,
      conditionLogic: data.conditionLogic,
      channels: data.channels as never,
      silenceSeconds: data.silenceSeconds,
      enabled: data.enabled,
    },
  });

  return c.json({ code: 0, message: 'ok', data: rule }, 201);
});

/**
 * GET /api/v1/alerts/rules/:id
 * Get alert rule detail.
 */
alertRoutes.get('/rules/:id', async (c) => {
  const { id } = c.req.param();
  const tenantId = getTenantId(c);

  const rule = await prisma.alertRule.findFirst({ where: { id, tenantId } });
  if (!rule) return c.json({ code: 404, message: 'Rule not found' }, 404);

  return c.json({ code: 0, message: 'ok', data: rule });
});

/**
 * PUT /api/v1/alerts/rules/:id
 * Update an alert rule.
 */
alertRoutes.put('/rules/:id', zValidator('json', updateRuleSchema), async (c) => {
  const { id } = c.req.param();
  const data = c.req.valid('json');
  const tenantId = getTenantId(c);

  const result = await prisma.alertRule.updateMany({
    where: { id, tenantId },
    data: {
      ...data,
      conditions: data.conditions as never | undefined,
      channels: data.channels as never | undefined,
    },
  });

  if (result.count === 0) return c.json({ code: 404, message: 'Rule not found' }, 404);

  const rule = await prisma.alertRule.findFirst({ where: { id, tenantId } });
  return c.json({ code: 0, message: 'ok', data: rule });
});

/**
 * DELETE /api/v1/alerts/rules/:id
 * Delete an alert rule.
 */
alertRoutes.delete('/rules/:id', async (c) => {
  const { id } = c.req.param();
  const tenantId = getTenantId(c);

  const result = await prisma.alertRule.deleteMany({ where: { id, tenantId } });
  if (result.count === 0) return c.json({ code: 404, message: 'Rule not found' }, 404);

  return c.json({ code: 0, message: 'ok' });
});

/**
 * GET /api/v1/alerts/records
 * List alert records (history).
 */
alertRoutes.get('/records', async (c) => {
  const tenantId = getTenantId(c);
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;
  const status = c.req.query('status');
  const ruleId = c.req.query('ruleId');

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (ruleId) where.ruleId = ruleId;

  // AlertRecord doesn't have tenantId directly; join through rule
  const [data, total] = await Promise.all([
    prisma.alertRecord.findMany({
      where: {
        ...where,
        rule: { tenantId },
      },
      include: { rule: { select: { name: true } } },
      orderBy: { triggeredAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.alertRecord.count({
      where: { ...where, rule: { tenantId } },
    }),
  ]);

  return c.json({
    code: 0, message: 'ok',
    data, total, page, pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

export { alertRoutes };
