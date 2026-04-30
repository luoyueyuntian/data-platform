import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { DeviceRepository, TagRepository } from '@ssas/database';
import { buildDeviceProfile, scoreDevice, getTenantScoreDistribution } from '@ssas/cdp';
import { calculateDeviceTags, addManualTag, removeTag } from '@ssas/cdp';
import { calculateSegment, PREDEFINED_SEGMENTS, type SegmentDefinition } from '@ssas/cdp';
import { evaluateLifecycleTransition, evaluateTenantLifecycles } from '@ssas/cdp';
import { getTenantId, userAuthMiddleware } from '../middleware/auth';

const cdpRoutes = new Hono();
cdpRoutes.use('*', userAuthMiddleware);

const profileRuleSchema = z.object({
  type: z.literal('profile'),
  field: z.enum(['status', 'type', 'phase', 'location']),
  operator: z.enum(['=', '!=', 'in', 'contains']),
  value: z.union([z.string(), z.array(z.string())]),
});

const metricRuleSchema = z.object({
  type: z.literal('metric'),
  metricName: z.string().min(1),
  aggregation: z.enum(['avg', 'sum', 'max', 'min', 'count']),
  operator: z.enum(['>', '<', '>=', '<=', 'between']),
  value: z.union([z.number(), z.tuple([z.number(), z.number()])]),
  windowHours: z.number().positive(),
});

const tagRuleSchema = z.object({
  type: z.literal('tag'),
  key: z.string().min(1),
  operator: z.enum(['=', '!=', 'exists']),
  value: z.string().optional(),
});

const segmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  relation: z.enum(['and', 'or']).default('and'),
  rules: z.array(z.discriminatedUnion('type', [profileRuleSchema, metricRuleSchema, tagRuleSchema])).min(1),
});

// ======================
// Device Profile
// ======================

/**
 * GET /api/v1/cdp/profile/:deviceId
 * Build a device profile with health score.
 */
cdpRoutes.get('/profile/:deviceId', async (c) => {
  const { deviceId } = c.req.param();
  const tenantId = getTenantId(c);
  const device = await DeviceRepository.findById(deviceId, tenantId);
  if (!device) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  const profile = await buildDeviceProfile(deviceId);

  if (!profile) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  return c.json({ code: 0, message: 'ok', data: profile });
});

/**
 * GET /api/v1/cdp/profile/:deviceId/score
 * Get device score with interpretation.
 */
cdpRoutes.get('/profile/:deviceId/score', async (c) => {
  const { deviceId } = c.req.param();
  const tenantId = getTenantId(c);
  const device = await DeviceRepository.findById(deviceId, tenantId);
  if (!device) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  const result = await scoreDevice(deviceId);

  if (!result) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  return c.json({ code: 0, message: 'ok', data: result });
});

/**
 * GET /api/v1/cdp/stats
 * Score distribution across all devices in tenant.
 */
cdpRoutes.get('/stats', async (c) => {
  const tenantId = getTenantId(c);
  const dist = await getTenantScoreDistribution(tenantId);
  return c.json({ code: 0, message: 'ok', data: dist });
});

// ======================
// Tags
// ======================

/**
 * POST /api/v1/cdp/tags
 * Add a manual tag to a device.
 */
cdpRoutes.post('/tags', zValidator('json', z.object({
  deviceId: z.string().uuid(),
  key: z.string().min(1).max(128),
  value: z.string().max(255),
})), async (c) => {
  const { deviceId, key, value } = c.req.valid('json');
  const tenantId = getTenantId(c);
  const device = await DeviceRepository.findById(deviceId, tenantId);
  if (!device) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  await addManualTag(deviceId, key, value);
  return c.json({ code: 0, message: 'ok' }, 201);
});

/**
 * DELETE /api/v1/cdp/tags/:tagId
 * Remove a tag.
 */
cdpRoutes.delete('/tags/:tagId', async (c) => {
  const { tagId } = c.req.param();
  const tenantId = getTenantId(c);
  const tag = await TagRepository.findById(tagId);
  if (!tag) {
    return c.json({ code: 404, message: 'Tag not found' }, 404);
  }
  const device = await DeviceRepository.findById(tag.deviceId, tenantId);
  if (!device) {
    return c.json({ code: 403, message: 'Forbidden' }, 403);
  }

  await removeTag(tagId);
  return c.json({ code: 0, message: 'ok' });
});

/**
 * POST /api/v1/cdp/tags/calculate/:deviceId
 * Calculate computed tags for a device.
 */
cdpRoutes.post('/tags/calculate/:deviceId', async (c) => {
  const { deviceId } = c.req.param();
  const tenantId = getTenantId(c);
  const device = await DeviceRepository.findById(deviceId, tenantId);
  if (!device) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  const tags = await calculateDeviceTags(deviceId);
  return c.json({ code: 0, message: 'ok', data: { deviceId, tags } });
});

// ======================
// Segments
// ======================

/**
 * GET /api/v1/cdp/segments
 * List predefined segments.
 */
cdpRoutes.get('/segments', async (c) => {
  return c.json({ code: 0, message: 'ok', data: PREDEFINED_SEGMENTS });
});

/**
 * POST /api/v1/cdp/segments/calculate
 * Execute a segment query.
 */
cdpRoutes.post('/segments/calculate', zValidator('json', segmentSchema), async (c) => {
  const tenantId = getTenantId(c);
  const data = c.req.valid('json');
  const segment: SegmentDefinition = data;

  const result = await calculateSegment(tenantId, segment);
  return c.json({ code: 0, message: 'ok', data: result });
});

// ======================
// Lifecycle
// ======================

/**
 * POST /api/v1/cdp/lifecycle/evaluate/:deviceId
 * Evaluate lifecycle transition for a device.
 */
cdpRoutes.post('/lifecycle/evaluate/:deviceId', async (c) => {
  const { deviceId } = c.req.param();
  const tenantId = getTenantId(c);
  const device = await DeviceRepository.findById(deviceId, tenantId);
  if (!device) {
    return c.json({ code: 404, message: 'Device not found' }, 404);
  }

  const result = await evaluateLifecycleTransition(deviceId);
  return c.json({ code: 0, message: 'ok', data: result });
});

/**
 * POST /api/v1/cdp/lifecycle/evaluate-all
 * Evaluate lifecycle transitions for all devices in tenant.
 */
cdpRoutes.post('/lifecycle/evaluate-all', async (c) => {
  const tenantId = getTenantId(c);
  const result = await evaluateTenantLifecycles(tenantId);
  return c.json({ code: 0, message: 'ok', data: result });
});

export { cdpRoutes };
