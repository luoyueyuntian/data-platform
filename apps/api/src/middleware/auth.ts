import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { prisma } from '@ssas/database';
import { hashApiKey } from '@ssas/core';
import { hasRequiredRole, verifyAccessToken } from '@ssas/auth';

export interface AuthPayload {
  authType: 'user' | 'api_key';
  userId?: string;
  apiKeyId?: string;
  tenantId: string;
  role: string;
  permissions?: string[];
}

async function resolveAuthPayload(c: Context): Promise<AuthPayload | undefined> {
  const authHeader = c.req.header('Authorization');
  const apiKeyHeader = c.req.header('X-API-Key');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    return {
      authType: 'user',
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
    };
  }

  if (apiKeyHeader) {
    const apiKey = await prisma.apiKey.findUnique({
      where: { key: hashApiKey(apiKeyHeader) },
    });

    if (!apiKey) {
      throw new HTTPException(401, { message: 'Invalid API key' });
    }
    if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
      throw new HTTPException(401, { message: 'API key expired' });
    }

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      authType: 'api_key',
      apiKeyId: apiKey.id,
      tenantId: apiKey.tenantId,
      role: 'service',
      permissions: apiKey.permissions,
    };
  }

  return undefined;
}

/**
 * Required authentication middleware.
 */
export async function authMiddleware(c: Context, next: Next): Promise<void> {
  const auth = await resolveAuthPayload(c);
  if (!auth) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  c.set('auth', auth);
  await next();
}

export async function userAuthMiddleware(c: Context, next: Next): Promise<void> {
  await authMiddleware(c, async () => {
    requireUserAuth(c);
    await next();
  });
}

/**
 * Optional auth middleware — extracts user if token present, but doesn't block.
 */
export async function optionalAuth(c: Context, next: Next): Promise<void> {
  try {
    const auth = await resolveAuthPayload(c);
    if (auth) {
      c.set('auth', auth);
    }
  } catch {
    // Ignore invalid optional credentials.
  }
  await next();
}

/**
 * Read the normalized auth context from the request.
 */
export function getAuth(c: Context): AuthPayload | undefined {
  return c.get('auth') as AuthPayload | undefined;
}

export function requireAuth(c: Context): AuthPayload {
  const auth = getAuth(c);
  if (!auth) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  return auth;
}

export function requireUserAuth(c: Context): AuthPayload {
  const auth = requireAuth(c);
  if (auth.authType !== 'user' || !auth.userId) {
    throw new HTTPException(403, { message: 'User credentials required' });
  }
  return auth;
}

export function getTenantId(c: Context): string {
  return requireAuth(c).tenantId;
}

export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const auth = requireUserAuth(c);
    if (!hasRequiredRole(auth.role, roles)) {
      throw new HTTPException(403, { message: 'Insufficient permissions' });
    }
    await next();
  };
}

export function requirePermission(...permissions: string[]) {
  return async (c: Context, next: Next) => {
    const auth = requireAuth(c);
    if (auth.authType === 'user') {
      await next();
      return;
    }

    const granted = auth.permissions ?? [];
    const allowed = permissions.every((permission) => granted.includes(permission));
    if (!allowed) {
      throw new HTTPException(403, { message: 'Insufficient permissions' });
    }
    await next();
  };
}
