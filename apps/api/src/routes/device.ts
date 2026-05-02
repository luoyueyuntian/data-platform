import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { DeviceRepository, SensorRepository, TagRepository } from '@ssas/database';
import { getTenantId, userAuthMiddleware } from '../middleware/auth.js';
import {
  createDeviceSchema, updateDeviceSchema, deviceListQuerySchema, createSensorSchema, createTagSchema,
} from '@ssas/api/validators/device';

const deviceRoutes = new Hono();
deviceRoutes.use('*', userAuthMiddleware);

// ======================
// Device CRUD
// ======================

/**
 * GET /api/v1/devices
 * List devices with pagination and filtering.
 */
deviceRoutes.get('/', zValidator('query', deviceListQuerySchema), async (c) => {
  const params = c.req.valid('query');
  const tenantId = getTenantId(c);

  const result = await DeviceRepository.findAll({ ...params, tenantId });

  return c.json({ code: 0, message: 'ok', ...result });
});

/**
 * GET /api/v1/devices/stats
 * Device statistics overview (placed before /:id to avoid route conflict)
 */
deviceRoutes.get('/stats', async (c) => {
  const tenantId = getTenantId(c);
  const stats = await DeviceRepository.getStats(tenantId);
  return c.json({ code: 0, message: 'ok', data: stats });
});

/**
 * GET /api/v1/devices/:id
 * Device detail with sensors and tags.
 */
deviceRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const tenantId = getTenantId(c);

  const device = await DeviceRepository.findById(id, tenantId);
  if (!device) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  return c.json({ code: 0, message: 'ok', data: device });
});

/**
 * POST /api/v1/devices
 * Create a new device.
 */
deviceRoutes.post('/', zValidator('json', createDeviceSchema), async (c) => {
  const data = c.req.valid('json');
  const tenantId = getTenantId(c);

  // Check deviceKey uniqueness within tenant
  const existing = await DeviceRepository.findByDeviceKey(data.deviceKey, tenantId);
  if (existing) {
    return c.json({ code: 409, message: `Device with key "${data.deviceKey}" already exists` }, 409);
  }

  const device = await DeviceRepository.create({ ...data, tenantId });

  return c.json({ code: 0, message: 'ok', data: device }, 201);
});

/**
 * PUT /api/v1/devices/:id
 * Update device properties.
 */
deviceRoutes.put('/:id', zValidator('json', updateDeviceSchema), async (c) => {
  const { id } = c.req.param();
  const data = c.req.valid('json');
  const tenantId = getTenantId(c);

  const result = await DeviceRepository.update(id, tenantId, data);
  if (result.count === 0) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  const device = await DeviceRepository.findById(id, tenantId);
  return c.json({ code: 0, message: 'ok', data: device });
});

/**
 * DELETE /api/v1/devices/:id
 * Delete a device.
 */
deviceRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const tenantId = getTenantId(c);

  const result = await DeviceRepository.delete(id, tenantId);
  if (result.count === 0) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  return c.json({ code: 0, message: 'ok' });
});

// ======================
// Sensor sub-resource
// ======================

/**
 * GET /api/v1/devices/:deviceId/sensors
 * List sensors for a device.
 */
deviceRoutes.get('/:deviceId/sensors', async (c) => {
  const { deviceId } = c.req.param();
  const tenantId = getTenantId(c);

  const device = await DeviceRepository.findById(deviceId, tenantId);
  if (!device) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  const sensors = await SensorRepository.findByDeviceId(deviceId);
  return c.json({ code: 0, message: 'ok', data: sensors });
});

/**
 * POST /api/v1/devices/:deviceId/sensors
 * Add a sensor to a device.
 */
deviceRoutes.post('/:deviceId/sensors', zValidator('json', createSensorSchema), async (c) => {
  const { deviceId } = c.req.param();
  const data = c.req.valid('json');
  const tenantId = getTenantId(c);

  const device = await DeviceRepository.findById(deviceId, tenantId);
  if (!device) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  const sensor = await SensorRepository.create({ ...data, deviceId });
  return c.json({ code: 0, message: 'ok', data: sensor }, 201);
});

/**
 * DELETE /api/v1/devices/:deviceId/sensors/:sensorId
 * Remove a sensor from a device.
 */
deviceRoutes.delete('/:deviceId/sensors/:sensorId', async (c) => {
  const { sensorId } = c.req.param();
  const tenantId = getTenantId(c);

  const sensor = await SensorRepository.findById(sensorId);
  if (!sensor) {
    return c.json({ code: 404, message: 'Sensor not found' }, 404);
  }

  // Verify the sensor belongs to a device within the tenant
  const device = await DeviceRepository.findById(sensor.deviceId, tenantId);
  if (!device) {
    return c.json({ code: 403, message: 'Forbidden' }, 403);
  }

  await SensorRepository.delete(sensorId);
  return c.json({ code: 0, message: 'ok' });
});

// ======================
// Tag sub-resource
// ======================

/**
 * GET /api/v1/devices/:deviceId/tags
 * List tags for a device.
 */
deviceRoutes.get('/:deviceId/tags', async (c) => {
  const { deviceId } = c.req.param();
  const tenantId = getTenantId(c);

  const device = await DeviceRepository.findById(deviceId, tenantId);
  if (!device) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  const tags = await TagRepository.findByDeviceId(deviceId);
  return c.json({ code: 0, message: 'ok', data: tags });
});

/**
 * POST /api/v1/devices/:deviceId/tags
 * Add a tag to a device.
 */
deviceRoutes.post('/:deviceId/tags', zValidator('json', createTagSchema), async (c) => {
  const { deviceId } = c.req.param();
  const data = c.req.valid('json');
  const tenantId = getTenantId(c);

  const device = await DeviceRepository.findById(deviceId, tenantId);
  if (!device) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  const tag = await TagRepository.create({ ...data, deviceId });
  return c.json({ code: 0, message: 'ok', data: tag }, 201);
});

/**
 * DELETE /api/v1/devices/:deviceId/tags/:tagId
 * Remove a tag from a device.
 */
deviceRoutes.delete('/:deviceId/tags/:tagId', async (c) => {
  const { tagId } = c.req.param();
  const tenantId = getTenantId(c);

  const deviceTag = await TagRepository.findById(tagId);
  if (!deviceTag) {
    return c.json({ code: 404, message: 'Tag not found' }, 404);
  }

  const device = await DeviceRepository.findById(deviceTag.deviceId, tenantId);
  if (!device) {
    return c.json({ code: 403, message: 'Forbidden' }, 403);
  }

  await TagRepository.delete(tagId);
  return c.json({ code: 0, message: 'ok' });
});

export { deviceRoutes };
