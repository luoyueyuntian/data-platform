import type { Context, Next } from 'hono';
import { prisma } from '@ssas/database';
import { getAuth } from './auth.js';

export interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  detail?: Record<string, unknown>;
  ip?: string;
}

/**
 * Extract resource info from request path and method.
 */
function extractResourceInfo(path: string, method: string): { resource: string; resourceId?: string } {
  // Parse API path: /api/v1/{resource}/{id?}/{sub-resource?}
  const parts = path.split('/').filter(Boolean);
  const apiIndex = parts.indexOf('v1');

  if (apiIndex === -1 || apiIndex + 1 >= parts.length) {
    return { resource: 'unknown' };
  }

  const resource = parts[apiIndex + 1] || 'unknown';
  const resourceId = parts[apiIndex + 2] && !parts[apiIndex + 2].startsWith(':') ? parts[apiIndex + 2] : undefined;

  return { resource, resourceId };
}

/**
 * Build action string from HTTP method and resource.
 */
function buildAction(method: string, resource: string, resourceId?: string, subResource?: string): string {
  const methodMap: Record<string, string> = {
    GET: 'read',
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };

  const action = methodMap[method] || method.toLowerCase();
  const target = subResource ? `${resource}.${subResource}` : resource;

  return `${target}.${action}`;
}

/**
 * Audit logging middleware.
 * Records all write operations (POST, PUT, PATCH, DELETE) to the AuditLog table.
 */
export async function auditMiddleware(c: Context, next: Next): Promise<void> {
  // Only audit write operations
  const method = c.req.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    await next();
    return;
  }

  const startTime = Date.now();

  // Execute the request
  await next();

  // Log after request completes
  const duration = Date.now() - startTime;
  const path = c.req.path;
  const { resource, resourceId } = extractResourceInfo(path, method);

  // Get auth context if available
  const auth = getAuth(c);

  // Build action string
  const action = buildAction(method, resource, resourceId);

  // Get client IP
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';

  // Build detail object
  const detail: Record<string, unknown> = {
    method,
    path,
    statusCode: c.res.status,
    durationMs: duration,
  };

  // Add request body for create/update operations (excluding sensitive data)
  if (method !== 'DELETE') {
    try {
      const contentType = c.req.header('content-type');
      if (contentType?.includes('application/json')) {
        // We can't re-read the body after it's been consumed, so we skip it
        // In production, you'd clone the request before processing
      }
    } catch {
      // Ignore body parsing errors
    }
  }

  // Write audit log asynchronously (don't block the response)
  const tenantId = auth?.tenantId;
  if (tenantId) {
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: auth?.userId,
        action,
        resource,
        resourceId,
        detail: JSON.parse(JSON.stringify(detail)),
        ip,
      },
    }).catch((err) => {
      console.error('[audit] failed to write log:', err);
    });
  }
}

/**
 * Audit a specific action manually.
 * Use this for custom audit logging outside of middleware.
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        detail: entry.detail ? JSON.parse(JSON.stringify(entry.detail)) : {},
        ip: entry.ip,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write log:', err);
  }
}

/**
 * Query audit logs for a tenant.
 */
export async function queryAuditLogs(params: {
  tenantId: string;
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  startTime?: Date;
  endTime?: Date;
  page?: number;
  pageSize?: number;
}) {
  const {
    tenantId,
    userId,
    action,
    resource,
    resourceId,
    startTime,
    endTime,
    page = 1,
    pageSize = 50,
  } = params;

  const where: Record<string, unknown> = { tenantId };

  if (userId) where.userId = userId;
  if (action) where.action = { contains: action };
  if (resource) where.resource = resource;
  if (resourceId) where.resourceId = resourceId;

  if (startTime || endTime) {
    where.createdAt = {};
    if (startTime) (where.createdAt as Record<string, Date>).gte = startTime;
    if (endTime) (where.createdAt as Record<string, Date>).lte = endTime;
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data, total };
}
