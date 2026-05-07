import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '@ssas/database';
import { writeEvents, queryEvents, getLatestEvents, buildEventQuery } from '@ssas/storage';
import { authMiddleware, getTenantId, requirePermission } from '../middleware/auth.js';

const eventRoutes = new Hono();

// ======================
// Query validation
// ======================

const querySchema = z.object({
  entityIds: z.string().transform((s) => s.split(',')),
  eventNames: z.string().optional().transform((s) => s?.split(',')),
  startTime: z.string(),
  endTime: z.string(),
  granularity: z.enum(['1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d']).optional().default('1h'),
  aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count', 'last']).optional().default('avg'),
  filters: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional().default(1000),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ======================
// Routes
// ======================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function assertTenantEntities(tenantId: string, entityIds: string[]): Promise<boolean> {
  const count = await prisma.entity.count({
    where: {
      tenantId,
      id: { in: entityIds },
    },
  });
  return count === new Set(entityIds).size;
}

async function resolveTenantEntityIds(tenantId: string, requestedEntityIds: string[]): Promise<string[]> {
  if (requestedEntityIds.length === 1 && requestedEntityIds[0] === '*') {
    const entities = await prisma.entity.findMany({
      where: { tenantId },
      select: { id: true },
    });
    return entities.map((entity) => entity.id);
  }

  const resolved: string[] = [];
  for (const raw of requestedEntityIds) {
    if (UUID_RE.test(raw)) {
      resolved.push(raw);
    } else {
      const entity = await prisma.entity.findFirst({
        where: { tenantId, entityKey: raw },
        select: { id: true },
      });
      if (entity) resolved.push(entity.id);
    }
  }
  return [...new Set(resolved)];
}

/**
 * POST /api/v1/events/ingest
 * Single Event ingestion.
 */
eventRoutes.post('/ingest', authMiddleware, requirePermission('data:write'), async (c) => {
  const input = await c.req.json();
  const tenantId = getTenantId(c);

  const entityId = input.entityId;
  if (!entityId) {
    return c.json({ code: 400, message: 'entityId is required' }, 400);
  }

  if (!(await assertTenantEntities(tenantId, [entityId]))) {
    return c.json({ code: 403, message: 'Entity does not belong to the authenticated tenant' }, 403);
  }

  const event = {
    entityId,
    time: input.time ? new Date(input.time) : new Date(),
    eventName: input.eventName,
    value: input.value,
    properties: input.properties,
    tags: input.tags,
    quality: input.quality ?? 100,
  };

  try {
    await writeEvents([event]);
  } catch (err) {
    return c.json({ code: 500, message: 'Failed to write event' }, 500);
  }

  return c.json({ code: 0, message: 'ok', data: { entityId: event.entityId, eventName: event.eventName } }, 201);
});

/**
 * POST /api/v1/events/batch
 * Batch Event ingestion.
 */
eventRoutes.post('/batch', authMiddleware, requirePermission('data:write'), async (c) => {
  const input = await c.req.json();
  const tenantId = getTenantId(c);

  const entityId = input.entityId;
  if (!entityId) {
    return c.json({ code: 400, message: 'entityId is required' }, 400);
  }

  if (!(await assertTenantEntities(tenantId, [entityId]))) {
    return c.json({ code: 403, message: 'Entity does not belong to the authenticated tenant' }, 403);
  }

  const events = (input.events || []).map((e: Record<string, unknown>) => ({
    entityId,
    time: e.time ? new Date(e.time as string) : new Date(),
    eventName: e.eventName as string,
    value: e.value as number | undefined,
    properties: e.properties as Record<string, unknown> | undefined,
    tags: e.tags as Record<string, string> | undefined,
    quality: (e.quality as number) ?? 100,
  }));

  try {
    await writeEvents(events);
  } catch (err) {
    return c.json({ code: 500, message: 'Failed to write events' }, 500);
  }

  return c.json({ code: 0, message: 'ok', data: { entityId, count: events.length } }, 201);
});

/**
 * GET /api/v1/events/query
 * Time-series event query from TimescaleDB.
 */
eventRoutes.get('/query', authMiddleware, requirePermission('data:read'), zValidator('query', querySchema), async (c) => {
  const params = c.req.valid('query');
  const tenantId = getTenantId(c);
  const entityIds = await resolveTenantEntityIds(tenantId, params.entityIds);

  if (!(await assertTenantEntities(tenantId, entityIds))) {
    return c.json({ code: 403, message: 'One or more entities do not belong to the authenticated tenant' }, 403);
  }

  try {
    const query = buildEventQuery({
      entityIds,
      eventNames: params.eventNames,
      startTime: params.startTime,
      endTime: params.endTime,
      granularity: params.granularity,
      aggregation: params.aggregation,
      filters: params.filters ? JSON.parse(params.filters) : undefined,
      limit: params.limit,
      offset: params.offset,
    });

    const data = await queryEvents(query);

    return c.json({ code: 0, message: 'ok', data, total: data.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid query parameters';
    return c.json({ code: 400, message }, 400);
  }
});

/**
 * GET /api/v1/events/latest/:entityId
 * Latest event values for an entity.
 */
eventRoutes.get('/latest/:entityId', authMiddleware, requirePermission('data:read'), async (c) => {
  const { entityId } = c.req.param();
  const eventName = c.req.query('eventName');
  const tenantId = getTenantId(c);

  if (!(await assertTenantEntities(tenantId, [entityId]))) {
    return c.json({ code: 403, message: 'Entity does not belong to the authenticated tenant' }, 403);
  }

  try {
    const data = await getLatestEvents(entityId, eventName);
    return c.json({ code: 0, message: 'ok', data });
  } catch (err) {
    return c.json({ code: 500, message: 'Failed to query latest events' }, 500);
  }
});

/**
 * GET /api/v1/events/export
 * Export event data as CSV or JSON.
 */
eventRoutes.get('/export', authMiddleware, requirePermission('data:read'), async (c) => {
  const requestedEntityIds = c.req.query('entityIds')?.split(',') || [];
  const eventNames = c.req.query('eventNames')?.split(',');
  const startTime = c.req.query('startTime');
  const endTime = c.req.query('endTime');
  const format = c.req.query('format') || 'csv';
  const tenantId = getTenantId(c);

  if (!requestedEntityIds.length || !startTime || !endTime) {
    return c.json({ code: 400, message: 'entityIds, startTime, endTime are required' }, 400);
  }
  const entityIds = await resolveTenantEntityIds(tenantId, requestedEntityIds);
  if (!(await assertTenantEntities(tenantId, entityIds))) {
    return c.json({ code: 403, message: 'One or more entities do not belong to the authenticated tenant' }, 403);
  }

  try {
    const query = buildEventQuery({
      entityIds, eventNames, startTime, endTime,
      granularity: '1m', aggregation: 'avg', limit: 100000,
    });

    const data = await queryEvents(query);

    if (format === 'csv') {
      const header = 'time,entityId,eventName,value,count\n';
      const rows = data.map((d) =>
        `${d.time.toISOString()},${d.entityId},${d.eventName},${d.avg ?? ''},${d.count}`
      ).join('\n');
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', `attachment; filename="export-${Date.now()}.csv"`);
      return c.body(header + rows);
    }

    return c.json({ code: 0, message: 'ok', data, total: data.length });
  } catch (err) {
    return c.json({ code: 400, message: String(err) }, 400);
  }
});

export { eventRoutes };
