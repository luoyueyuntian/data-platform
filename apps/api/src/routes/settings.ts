import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '@ssas/database';
import { generateApiKey, getApiKeyPreview, hashApiKey } from '@ssas/core';
import { getTenantId, requireRole, userAuthMiddleware } from '../middleware/auth';

const settingsRoutes = new Hono();
settingsRoutes.use('*', userAuthMiddleware);
settingsRoutes.use('*', requireRole('admin'));

const createKeySchema = z.object({
  name: z.string().min(1).max(255),
});

/**
 * GET /api/v1/settings/api-keys
 * List all API keys for the tenant.
 */
settingsRoutes.get('/api-keys', async (c) => {
  const tenantId = getTenantId(c);

  const keys = await prisma.apiKey.findMany({
    where: { tenantId },
    select: {
      id: true, name: true, key: true,
      lastUsedAt: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return c.json({
    code: 0,
    message: 'ok',
    data: keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPreview: getApiKeyPreview(key.key),
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
    })),
  });
});

/**
 * POST /api/v1/settings/api-keys
 * Create a new API key.
 */
settingsRoutes.post('/api-keys', zValidator('json', createKeySchema), async (c) => {
  const { name } = c.req.valid('json');
  const tenantId = getTenantId(c);

  const rawKey = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      tenantId,
      name,
      key: hashApiKey(rawKey),
      permissions: ['data:read', 'data:write'],
    },
  });

  // Return the raw key only on creation
  return c.json({
    code: 0, message: 'ok',
    data: { id: apiKey.id, name: apiKey.name, key: rawKey },
  }, 201);
});

/**
 * DELETE /api/v1/settings/api-keys/:id
 * Delete an API key.
 */
settingsRoutes.delete('/api-keys/:id', async (c) => {
  const { id } = c.req.param();
  const tenantId = getTenantId(c);

  const result = await prisma.apiKey.deleteMany({
    where: { id, tenantId },
  });

  if (result.count === 0) {
    return c.json({ code: 404, message: 'API key not found' }, 404);
  }

  return c.json({ code: 0, message: 'ok' });
});

export { settingsRoutes };
