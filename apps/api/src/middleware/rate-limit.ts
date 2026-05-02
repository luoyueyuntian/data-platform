import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getAuth } from './auth.js';

/**
 * Distributed rate limiter backed by Redis (sorted-set sliding window).
 * Falls back to in-memory Map when Redis is unavailable.
 */

interface RateLimitConfig {
  /** Maximum number of requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Optional key prefix for namespacing */
  prefix?: string;
}

// --- Redis client (lazy singleton) ---
let redis: Awaited<ReturnType<typeof createRedisClient>> | null = null;
let redisReady = false;

async function createRedisClient() {
  try {
    const { createClient } = await import('redis');
    const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    client.on('error', () => {}); // suppress noisy reconnect logs
    await client.connect();
    console.log('[rate-limit] connected to Redis');
    return client;
  } catch {
    return null;
  }
}

async function getRedis() {
  if (redisReady) return redis;
  redis = await createRedisClient();
  redisReady = redis !== null;
  return redis;
}

// --- In-memory fallback (single-instance only) ---
interface MemEntry {
  tokens: number;
  lastRefill: number;
}
const memStore = new Map<string, MemEntry>();

// Cleanup stale in-memory entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore.entries()) {
    if (now - entry.lastRefill > 300_000) memStore.delete(key);
  }
}, 300_000);

// --- Key derivation ---
function getRateLimitKey(c: Context, config: RateLimitConfig): string {
  const auth = getAuth(c);
  const prefix = config.prefix || 'rl';

  if (auth?.tenantId) {
    return `${prefix}:tenant:${auth.tenantId}`;
  }

  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  return `${prefix}:ip:${ip}`;
}

// --- Redis sliding-window check ---
async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const r = await getRedis();
  if (!r) return checkRateLimitMem(key, config);

  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const windowStart = now - windowMs;

  const multi = r.multi();
  multi.zRemRangeByScore(key, 0, windowStart);
  multi.zCard(key);
  multi.zAdd(key, { score: now, value: `${now}:${Math.random()}` });
  multi.pExpire(key, windowMs);

  const results = await multi.exec();
  const count = (results?.[1] as number) ?? 0;

  const allowed = count < config.limit;
  const remaining = Math.max(0, config.limit - count - 1);
  const resetAt = now + windowMs;

  if (!allowed) {
    // Remove the entry we just added since it's rejected
    await r.zRemRangeByRank(key, -1, -1);
  }

  return { allowed, remaining, resetAt };
}

// --- In-memory fallback ---
function checkRateLimitMem(
  key: string,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  let entry = memStore.get(key);

  if (!entry || now - entry.lastRefill > windowMs) {
    entry = { tokens: config.limit - 1, lastRefill: now };
    memStore.set(key, entry);
    return { allowed: true, remaining: entry.tokens, resetAt: now + windowMs };
  }

  if (entry.tokens <= 0) {
    return { allowed: false, remaining: 0, resetAt: entry.lastRefill + windowMs };
  }

  entry.tokens--;
  return { allowed: true, remaining: entry.tokens, resetAt: entry.lastRefill + windowMs };
}

/**
 * Rate limiting middleware factory.
 * Uses Redis when available for distributed rate limiting; falls back to
 * in-memory sliding window for single-instance deployments.
 */
export function rateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next): Promise<void> => {
    const key = getRateLimitKey(c, config);
    const { allowed, remaining, resetAt } = await checkRateLimitRedis(key, config);

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
 * Gracefully disconnect Redis on shutdown.
 */
export async function disconnectRateLimit(): Promise<void> {
  if (redis) {
    await redis.disconnect();
    redis = null;
    redisReady = false;
  }
}
