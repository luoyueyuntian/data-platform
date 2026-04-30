/**
 * Optional Redis cache layer.
 * If redis is not installed, caching is silently disabled.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redis: any = null;
let redisAvailable = false;

const DEFAULT_TTL = 60;

async function createRedisClient() {
  try {
    const { createClient } = await import('redis');
    const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    await client.connect();
    console.log('[cache] redis connected');
    return client;
  } catch (err) {
    console.warn('[cache] redis not available, caching disabled:', (err as Error).message);
    return null;
  }
}

/**
 * Initialize Redis connection (optional).
 */
export async function initCache(): Promise<void> {
  if (redis || redisAvailable) return;
  redis = await createRedisClient();
  redisAvailable = redis !== null;
}

/**
 * Get cached value.
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Set cached value with TTL.
 */
export async function setCache<T>(key: string, value: T, ttl: number = DEFAULT_TTL): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), { EX: ttl });
  } catch {
    // Silently fail
  }
}

/**
 * Generate cache key for a query.
 */
export function buildCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return `cache:${prefix}:${sorted}`;
}

/**
 * Disconnect Redis.
 */
export async function disconnectCache(): Promise<void> {
  if (redis) {
    await redis.disconnect();
    redis = null;
    redisAvailable = false;
    console.log('[cache] redis disconnected');
  }
}
