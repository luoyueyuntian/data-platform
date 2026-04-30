import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '@ssas/database';
import { getTenantId, userAuthMiddleware } from '../middleware/auth';

const dashboardRoutes = new Hono();
dashboardRoutes.use('*', userAuthMiddleware);

// ======================
// Validation
// ======================

const createDashboardSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
});

const updateDashboardSchema = createDashboardSchema.partial();

const createPanelSchema = z.object({
  title: z.string().min(1).max(255),
  type: z.enum(['line', 'bar', 'pie', 'gauge', 'table', 'heatmap', 'scatter', 'stat', 'area']),
  query: z.object({
    metricNames: z.array(z.string()),
    aggregation: z.string().default('avg'),
    granularity: z.string().default('1h'),
    filters: z.record(z.string()).optional(),
    timeRange: z.enum(['last_1h', 'last_6h', 'last_24h', 'last_7d', 'last_30d', 'custom']).default('last_24h'),
  }),
  position: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(1).max(12),
  }),
  style: z.record(z.unknown()).optional(),
});

// ======================
// Routes
// ======================

/**
 * GET /api/v1/dashboards
 * List dashboards.
 */
dashboardRoutes.get('/', async (c) => {
  const tenantId = getTenantId(c);
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  const [data, total] = await Promise.all([
    prisma.dashboard.findMany({
      where: { tenantId },
      include: { _count: { select: { panels: true } } },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dashboard.count({ where: { tenantId } }),
  ]);

  return c.json({ code: 0, message: 'ok', data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

/**
 * POST /api/v1/dashboards
 * Create a dashboard.
 */
dashboardRoutes.post('/', zValidator('json', createDashboardSchema), async (c) => {
  const data = c.req.valid('json');
  const tenantId = getTenantId(c);

  const dashboard = await prisma.dashboard.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description,
      isPublic: data.isPublic,
    },
  });

  return c.json({ code: 0, message: 'ok', data: dashboard }, 201);
});

/**
 * GET /api/v1/dashboards/:id
 * Dashboard detail with panels.
 */
dashboardRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const tenantId = getTenantId(c);

  const dashboard = await prisma.dashboard.findFirst({
    where: { id, tenantId },
    include: { panels: { orderBy: [{ position: 'asc' }] } },
  });

  if (!dashboard) return c.json({ code: 404, message: 'Dashboard not found' }, 404);

  return c.json({ code: 0, message: 'ok', data: dashboard });
});

/**
 * PUT /api/v1/dashboards/:id
 * Update a dashboard.
 */
dashboardRoutes.put('/:id', zValidator('json', updateDashboardSchema), async (c) => {
  const { id } = c.req.param();
  const data = c.req.valid('json');
  const tenantId = getTenantId(c);

  const result = await prisma.dashboard.updateMany({
    where: { id, tenantId },
    data,
  });

  if (result.count === 0) return c.json({ code: 404, message: 'Dashboard not found' }, 404);

  const dashboard = await prisma.dashboard.findFirst({ where: { id, tenantId }, include: { panels: true } });
  return c.json({ code: 0, message: 'ok', data: dashboard });
});

/**
 * DELETE /api/v1/dashboards/:id
 * Delete a dashboard (cascades panels).
 */
dashboardRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const tenantId = getTenantId(c);

  const result = await prisma.dashboard.deleteMany({ where: { id, tenantId } });
  if (result.count === 0) return c.json({ code: 404, message: 'Dashboard not found' }, 404);

  return c.json({ code: 0, message: 'ok' });
});

/**
 * POST /api/v1/dashboards/:id/panels
 * Add a panel to a dashboard.
 */
dashboardRoutes.post('/:id/panels', zValidator('json', createPanelSchema), async (c) => {
  const { id } = c.req.param();
  const data = c.req.valid('json');
  const tenantId = getTenantId(c);

  const dashboard = await prisma.dashboard.findFirst({ where: { id, tenantId } });
  if (!dashboard) return c.json({ code: 404, message: 'Dashboard not found' }, 404);

  const panel = await prisma.panel.create({
    data: {
      dashboardId: id,
      title: data.title,
      type: data.type,
      query: data.query as never,
      position: data.position as never,
      style: data.style as never ?? undefined,
    },
  });

  return c.json({ code: 0, message: 'ok', data: panel }, 201);
});

/**
 * DELETE /api/v1/dashboards/:id/panels/:panelId
 * Remove a panel from a dashboard.
 */
dashboardRoutes.delete('/:id/panels/:panelId', async (c) => {
  const { panelId } = c.req.param();
  const tenantId = getTenantId(c);

  // Verify the panel belongs to a dashboard within the tenant
  const panel = await prisma.panel.findUnique({
    where: { id: panelId },
    include: { dashboard: { select: { tenantId: true } } },
  });

  if (!panel) return c.json({ code: 404, message: 'Panel not found' }, 404);
  if (panel.dashboard.tenantId !== tenantId) return c.json({ code: 403, message: 'Forbidden' }, 403);

  await prisma.panel.delete({ where: { id: panelId } });
  return c.json({ code: 0, message: 'ok' });
});

export { dashboardRoutes };
