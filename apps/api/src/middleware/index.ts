export { errorHandler } from './error.js';
export { authMiddleware, userAuthMiddleware, optionalAuth, requireRole, requirePermission, getAuth, requireAuth, requireUserAuth, getTenantId } from './auth.js';
export type { AuthPayload } from './auth.js';
export { auditMiddleware, logAudit, queryAuditLogs } from './audit.js';
export type { AuditLogEntry } from './audit.js';
export { rateLimit, RateLimitPresets } from './rate-limit.js';
