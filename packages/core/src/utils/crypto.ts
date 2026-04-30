import { createHash, randomUUID } from 'node:crypto';

/** 生成 UUID */
export function generateId(): string {
  return randomUUID();
}

/** 生成 API Key */
export function generateApiKey(): string {
  const raw = randomUUID().replace(/-/g, '');
  return `ssas_${raw}`;
}

/**
 * Persist only a short preview plus the irreversible digest of the full key.
 */
export function hashApiKey(rawKey: string): string {
  const preview = rawKey.slice(0, 12);
  const digest = createHash('sha256').update(rawKey).digest('hex');
  return `${preview}.${digest}`;
}

/**
 * Extract the non-sensitive preview portion from the stored API key hash.
 */
export function getApiKeyPreview(storedKey: string): string {
  const [preview] = storedKey.split('.', 1);
  return preview || 'hidden';
}
