import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getAuth } from './auth';

/**
 * In-memory rate limiter using sliding window algorithm.
 * For production, use Redis-based rate limiting.
 */

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  /** Maximum number of requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Optional key prefix for namespacing */
  prefix?: string;
}

// In-memory store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.lastRefill > 300000) {
      rateLimitStore.delete(key);
    }
  }
}, 300000);

/**
 * Get rate limit key for a request.
 */
function getRateLimitKey(c: Context, config: RateLimitConfig): string {
  const auth = getAuth(c);
  const prefix = config.prefix || 'rl';

  // Use tenant ID if available, otherwise fall back to IP
  if (auth?.tenantId) {
    return `${prefix}:tenant:${auth.tenantId}`;
  }

  // Fall back to IP address
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  return `${prefix}:ip:${ip}`;
}

/**
 * Check if a request is within rate limits.
 */
function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  let entry = rateLimitStore.get(key);

  if (!entry || now - entry.lastRefill > windowMs) {
    // New entry or window expired, reset
    entry = {
      tokens: config.limit - 1,
      lastRefill: now,
    };
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      remaining: entry.tokens,
      resetAt: now + windowMs,
    };
  }

  // Check if tokens available
  if (entry.tokens <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.lastRefill + windowMs,
    };
  }

  // Consume a token
  entry.tokens--;
  return {
    allowed: true,
    remaining: entry.tokens,
    resetAt: entry.lastRefill + windowMs,
  };
}

/**
 * Rate limiting middleware factory.
 *
 * @example
 * // 100 requests per minute
 * app.use('/api/*', rateLimit({ limit: 100, windowSeconds: 60 }));
 *
 * // 3 requests per second for auth endpoints
 * app.use('/api/v1/auth/*', rateLimit({ limit: 3, windowSeconds: 1, prefix: 'auth' }));
 */
export function rateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next): Promise<void> => {
    const key = getRateLimitKey(c, config);
    const { allowed, remaining, resetAt } = checkRateLimit(key, config);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(config.limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      c.header('Retry-After', String(retryAfter));

      throw new HTTPException(429, {
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      });
    }

    await next();
  };
}

/**
 * Predefined rate limit configurations.
 */
export const RateLimitPresets = {
  /** General API: 100 requests per minute */
  api: { limit: 100, windowSeconds: 60, prefix: 'api' },

  /** Auth endpoints: 5 requests per minute (prevent brute force) */
  auth: { limit: 5, windowSeconds: 60, prefix: 'auth' },

  /** Data ingestion: 1000 requests per minute */
  ingest: { limit: 1000, windowSeconds: 60, prefix: 'ingest' },

  /** Analytics queries: 30 requests per minute (expensive operations) */
  analytics: { limit: 30, windowSeconds: 60, prefix: 'analytics' },

  /** Export operations: 10 requests per hour */
  export: { limit: 10, windowSeconds: 3600, prefix: 'export' },
} as const;

/**
 * Get rate limit stats for monitoring.
 */
export function getRateLimitStats(): {
  totalKeys: number;
  keys: Array<{ key: string; tokens: number; lastRefill: number }>;
} {
  const keys: Array<{ key: string; tokens: number; lastRefill: number }> = [];

  for (const [key, entry] of rateLimitStore.entries()) {
    keys.push({
      key,
      tokens: entry.tokens,
      lastRefill: entry.lastRefill,
    });
  }

  return {
    totalKeys: keys.length,
    keys,
  };
}
