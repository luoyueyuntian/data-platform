import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { EntityRepository, TagRepository } from '@ssas/database';
import { getTenantId, userAuthMiddleware } from '../middleware/auth.js';
import {
  createEntitySchema, updateEntitySchema, entityListQuerySchema, createTagSchema,
} from '@ssas/api/validators/device';

const entityRoutes = new Hono();
entityRoutes.use('*', userAuthMiddleware);

// ======================
// Entity CRUD
// ======================

entityRoutes.get('/', zValidator('query', entityListQuerySchema), async (c) => {
  const params = c.req.valid('query');
  const tenantId = getTenantId(c);
  const result = await EntityRepository.findAll({ ...params, tenantId });
  return c.json({ code: 0, message: 'ok', ...result });
});

entityRoutes.get('/stats', async (c) => {
  const tenantId = getTenantId(c);
  const stats = await EntityRepository.getStats(tenantId);
  return c.json({ code: 0, message: 'ok', data: stats });
});

entityRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const tenantId = getTenantId(c);
  const entity = await EntityRepository.findById(id, tenantId);
  if (!entity) {
    return c.json({ code: 404, message: 'Entity not found' }, 404);
  }
  return c.json({ code: 0, message: 'ok', data: entity });
});

entityRoutes.post('/', zValidator('json', createEntitySchema), async (c) => {
  const data = c.req.valid('json');
  const tenantId = getTenantId(c);

  const existing = await EntityRepository.findByEntityKey(data.entityKey, tenantId);
  if (existing) {
    return c.json({ code: 409, message: `Entity with key "${data.entityKey}" already exists` }, 409);
  }

  const entity = await EntityRepository.create({ ...data, tenantId });
  return c.json({ code: 0, message: 'ok', data: entity }, 201);
});

entityRoutes.put('/:id', zValidator('json', updateEntitySchema), async (c) => {
  const { id } = c.req.param();
  const data = c.req.valid('json');
  const tenantId = getTenantId(c);

  const result = await EntityRepository.update(id, tenantId, data);
  if (result.count === 0) {
    return c.json({ code: 404, message: 'Entity not found' }, 404);
  }

  const entity = await EntityRepository.findById(id, tenantId);
  return c.json({ code: 0, message: 'ok', data: entity });
});

entityRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const tenantId = getTenantId(c);

  const result = await EntityRepository.delete(id, tenantId);
  if (result.count === 0) {
    return c.json({ code: 404, message: 'Entity not found' }, 404);
  }

  return c.json({ code: 0, message: 'ok' });
});

// ======================
// Tag sub-resource
// ======================

entityRoutes.get('/:entityId/tags', async (c) => {
  const { entityId } = c.req.param();
  const tenantId = getTenantId(c);

  const entity = await EntityRepository.findById(entityId, tenantId);
  if (!entity) {
    return c.json({ code: 404, message: 'Entity not found' }, 404);
  }

  const tags = await TagRepository.findByEntityId(entityId);
  return c.json({ code: 0, message: 'ok', data: tags });
});

entityRoutes.post('/:entityId/tags', zValidator('json', createTagSchema), async (c) => {
  const { entityId } = c.req.param();
  const data = c.req.valid('json');
  const tenantId = getTenantId(c);

  const entity = await EntityRepository.findById(entityId, tenantId);
  if (!entity) {
    return c.json({ code: 404, message: 'Entity not found' }, 404);
  }

  const tag = await TagRepository.create({ ...data, entityId });
  return c.json({ code: 0, message: 'ok', data: tag }, 201);
});

entityRoutes.delete('/:entityId/tags/:tagId', async (c) => {
  const { tagId } = c.req.param();
  const tenantId = getTenantId(c);

  const entityTag = await TagRepository.findById(tagId);
  if (!entityTag) {
    return c.json({ code: 404, message: 'Tag not found' }, 404);
  }

  const entity = await EntityRepository.findById(entityTag.entityId, tenantId);
  if (!entity) {
    return c.json({ code: 403, message: 'Forbidden' }, 403);
  }

  await TagRepository.delete(tagId);
  return c.json({ code: 0, message: 'ok' });
});

export { entityRoutes };
