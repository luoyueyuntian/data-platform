import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '@ssas/database';
import { sendDataPoint, sendBatchDataPoints, DataPointSchema, DataPointBatchSchema } from '@ssas/ingest';
import { writeDataPoints, queryDataPoints, getLatestDataPoints, buildTimeSeriesQuery } from '@ssas/storage';
import { authMiddleware, getTenantId, requirePermission } from '../middleware/auth.js';

const dataRoutes = new Hono();

// ======================
// Query validation
// ======================

const querySchema = z.object({
  deviceIds: z.string().transform((s) => s.split(',')),
  metricNames: z.string().optional().transform((s) => s?.split(',')),
  startTime: z.string(),
  endTime: z.string(),
  granularity: z.enum(['1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d']).optional().default('1h'),
  aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count', 'last']).optional().default('avg'),
  filters: z.string().optional(), // JSON string of Record<string, string>
  limit: z.coerce.number().int().min(1).max(10000).optional().default(1000),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ======================
// Routes
// ======================

async function assertTenantDevices(tenantId: string, deviceIds: string[]): Promise<boolean> {
  const count = await prisma.device.count({
    where: {
      tenantId,
      id: { in: deviceIds },
    },
  });
  return count === new Set(deviceIds).size;
}

async function resolveTenantDeviceIds(tenantId: string, requestedDeviceIds: string[]): Promise<string[]> {
  if (requestedDeviceIds.length === 1 && requestedDeviceIds[0] === '*') {
    const devices = await prisma.device.findMany({
      where: { tenantId },
      select: { id: true },
    });
    return devices.map((device) => device.id);
  }
  return [...new Set(requestedDeviceIds)];
}

/**
 * POST /api/v1/data/ingest
 * Single DataPoint ingestion.
 * Writes to Kafka (async) and directly to TimescaleDB (sync fallback).
 */
dataRoutes.post('/ingest', authMiddleware, requirePermission('data:write'), zValidator('json', DataPointSchema), async (c) => {
  const input = c.req.valid('json');
  const tenantId = getTenantId(c);

  if (!(await assertTenantDevices(tenantId, [input.deviceId]))) {
    return c.json({ code: 403, message: 'Device does not belong to the authenticated tenant' }, 403);
  }

  const point = {
    deviceId: input.deviceId,
    time: input.time ? new Date(input.time) : new Date(),
    metricName: input.metricName,
    value: input.value,
    sensorId: input.sensorId,
    tags: input.tags,
    quality: input.quality ?? 100,
  };

  // Primary path: send to Kafka (async, non-blocking)
  try {
    await sendDataPoint(point);
  } catch (err) {
    // Fallback: write directly to TimescaleDB
    console.warn('[data] Kafka unavailable, writing directly to DB:', err);
    await writeDataPoints([point]);
  }

  return c.json({ code: 0, message: 'ok', data: { deviceId: point.deviceId, metricName: point.metricName, value: point.value } }, 201);
});

/**
 * POST /api/v1/data/batch
 * Batch DataPoint ingestion.
 */
dataRoutes.post('/batch', authMiddleware, requirePermission('data:write'), zValidator('json', DataPointBatchSchema), async (c) => {
  const input = c.req.valid('json');
  const tenantId = getTenantId(c);

  if (!(await assertTenantDevices(tenantId, [input.deviceId]))) {
    return c.json({ code: 403, message: 'Device does not belong to the authenticated tenant' }, 403);
  }

  const points = input.dataPoints.map((dp) => ({
    deviceId: input.deviceId,
    time: dp.time ? new Date(dp.time) : new Date(),
    metricName: dp.metricName,
    value: dp.value,
    sensorId: dp.sensorId,
    tags: dp.tags,
    quality: dp.quality ?? 100,
  }));

  try {
    await sendBatchDataPoints(points);
  } catch (err) {
    console.warn('[data] Kafka unavailable, writing directly to DB:', err);
    await writeDataPoints(points);
  }

  return c.json({ code: 0, message: 'ok', data: { deviceId: input.deviceId, count: points.length } }, 201);
});

/**
 * GET /api/v1/data/query
 * Time-series data query from TimescaleDB.
 */
dataRoutes.get('/query', authMiddleware, requirePermission('data:read'), zValidator('query', querySchema), async (c) => {
  const params = c.req.valid('query');
  const tenantId = getTenantId(c);
  const deviceIds = await resolveTenantDeviceIds(tenantId, params.deviceIds);

  if (!(await assertTenantDevices(tenantId, deviceIds))) {
    return c.json({ code: 403, message: 'One or more devices do not belong to the authenticated tenant' }, 403);
  }

  try {
    const query = buildTimeSeriesQuery({
      deviceIds,
      metricNames: params.metricNames,
      startTime: params.startTime,
      endTime: params.endTime,
      granularity: params.granularity,
      aggregation: params.aggregation,
      filters: params.filters ? JSON.parse(params.filters) : undefined,
      limit: params.limit,
      offset: params.offset,
    });

    const data = await queryDataPoints(query);

    return c.json({ code: 0, message: 'ok', data, total: data.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid query parameters';
    return c.json({ code: 400, message }, 400);
  }
});

/**
 * GET /api/v1/data/latest/:deviceId
 * Latest data point values for a device.
 */
dataRoutes.get('/latest/:deviceId', authMiddleware, requirePermission('data:read'), async (c) => {
  const { deviceId } = c.req.param();
  const metricName = c.req.query('metricName');
  const tenantId = getTenantId(c);

  if (!(await assertTenantDevices(tenantId, [deviceId]))) {
    return c.json({ code: 403, message: 'Device does not belong to the authenticated tenant' }, 403);
  }

  try {
    const data = await getLatestDataPoints(deviceId, metricName);
    return c.json({ code: 0, message: 'ok', data });
  } catch (err) {
    return c.json({ code: 500, message: 'Failed to query latest data' }, 500);
  }
});

/**
 * GET /api/v1/data/export
 * Export time-series data as CSV or JSON.
 */
dataRoutes.get('/export', authMiddleware, requirePermission('data:read'), async (c) => {
  const requestedDeviceIds = c.req.query('deviceIds')?.split(',') || [];
  const metricNames = c.req.query('metricNames')?.split(',');
  const startTime = c.req.query('startTime');
  const endTime = c.req.query('endTime');
  const format = c.req.query('format') || 'csv';
  const tenantId = getTenantId(c);

  if (!requestedDeviceIds.length || !startTime || !endTime) {
    return c.json({ code: 400, message: 'deviceIds, startTime, endTime are required' }, 400);
  }
  const deviceIds = await resolveTenantDeviceIds(tenantId, requestedDeviceIds);
  if (!(await assertTenantDevices(tenantId, deviceIds))) {
    return c.json({ code: 403, message: 'One or more devices do not belong to the authenticated tenant' }, 403);
  }

  try {
    const query = buildTimeSeriesQuery({
      deviceIds, metricNames, startTime, endTime,
      granularity: '1m', aggregation: 'avg', limit: 100000,
    });

    const data = await queryDataPoints(query);

    if (format === 'csv') {
      const header = 'time,deviceId,metricName,value,count\n';
      const rows = data.map((d) =>
        `${d.time.toISOString()},${d.deviceId},${d.metricName},${d.avg ?? ''},${d.count}`
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

export { dataRoutes };
