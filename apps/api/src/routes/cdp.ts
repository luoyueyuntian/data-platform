import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { EntityRepository, TagRepository } from '@ssas/database';
import { buildEntityProfile, scoreEntity, getTenantScoreDistribution } from '@ssas/cdp';
import { calculateEntityTags, addManualTag, removeTag } from '@ssas/cdp';
import { calculateSegment, PREDEFINED_SEGMENTS, type SegmentDefinition } from '@ssas/cdp';
import { evaluateLifecycleTransition, evaluateTenantLifecycles } from '@ssas/cdp';
import { getTenantId, userAuthMiddleware } from '../middleware/auth.js';

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
  eventName: z.string().min(1),
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
// Entity Profile
// ======================

cdpRoutes.get('/profile/:entityId', async (c) => {
  const { entityId } = c.req.param();
  const tenantId = getTenantId(c);
  const entity = await EntityRepository.findById(entityId, tenantId);
  if (!entity) {
    return c.json({ code: 404, message: 'Entity not found' }, 404);
  }

  const profile = await buildEntityProfile(entityId);
  if (!profile) {
    return c.json({ code: 404, message: 'Entity not found' }, 404);
  }

  return c.json({ code: 0, message: 'ok', data: profile });
});

cdpRoutes.get('/profile/:entityId/score', async (c) => {
  const { entityId } = c.req.param();
  const tenantId = getTenantId(c);
  const entity = await EntityRepository.findById(entityId, tenantId);
  if (!entity) {
    return c.json({ code: 404, message: 'Entity not found' }, 404);
  }

  const result = await scoreEntity(entityId);
  if (!result) {
    return c.json({ code: 404, message: 'Entity not found' }, 404);
  }

  return c.json({ code: 0, message: 'ok', data: result });
});

cdpRoutes.get('/stats', async (c) => {
  const tenantId = getTenantId(c);
  const dist = await getTenantScoreDistribution(tenantId);
  return c.json({ code: 0, message: 'ok', data: dist });
});

// ======================
// Tags
// ======================

cdpRoutes.post('/tags', zValidator('json', z.object({
  entityId: z.string().uuid(),
  key: z.string().min(1).max(128),
  value: z.string().max(255),
})), async (c) => {
  const { entityId, key, value } = c.req.valid('json');
  const tenantId = getTenantId(c);
  const entity = await EntityRepository.findById(entityId, tenantId);
  if (!entity) {
    return c.json({ code: 404, message: 'Entity not found' }, 404);
  }

  await addManualTag(entityId, key, value);
  return c.json({ code: 0, message: 'ok' }, 201);
});

cdpRoutes.delete('/tags/:tagId', async (c) => {
  const { tagId } = c.req.param();
  const tenantId = getTenantId(c);
  const tag = await TagRepository.findById(tagId);
  if (!tag) {
    return c.json({ code: 404, message: 'Tag not found' }, 404);
  }
  const entity = await EntityRepository.findById(tag.entityId, tenantId);
  if (!entity) {
    return c.json({ code: 403, message: 'Forbidden' }, 403);
  }

  await removeTag(tagId);
  return c.json({ code: 0, message: 'ok' });
});

cdpRoutes.post('/tags/calculate/:entityId', async (c) => {
  const { entityId } = c.req.param();
  const tenantId = getTenantId(c);
  const entity = await EntityRepository.findById(entityId, tenantId);
  if (!entity) {
    return c.json({ code: 404, message: 'Entity not found' }, 404);
  }

  const tags = await calculateEntityTags(entityId);
  return c.json({ code: 0, message: 'ok', data: { entityId, tags } });
});

// ======================
// Segments
// ======================

cdpRoutes.get('/segments', async (c) => {
  return c.json({ code: 0, message: 'ok', data: PREDEFINED_SEGMENTS });
});

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

cdpRoutes.post('/lifecycle/evaluate/:entityId', async (c) => {
  const { entityId } = c.req.param();
  const tenantId = getTenantId(c);
  const entity = await EntityRepository.findById(entityId, tenantId);
  if (!entity) {
    return c.json({ code: 404, message: 'Entity not found' }, 404);
  }

  const result = await evaluateLifecycleTransition(entityId);
  return c.json({ code: 0, message: 'ok', data: result });
});

cdpRoutes.post('/lifecycle/evaluate-all', async (c) => {
  const tenantId = getTenantId(c);
  const result = await evaluateTenantLifecycles(tenantId);
  return c.json({ code: 0, message: 'ok', data: result });
});

export { cdpRoutes };
