import { describe, it, expect } from 'vitest';
import { generateId, generateApiKey, hashApiKey, getApiKeyPreview } from './crypto';

describe('generateId', () => {
  it('should generate a UUID', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
});

describe('generateApiKey', () => {
  it('should generate API key with ssas_ prefix', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^ssas_[a-f0-9]{32}$/);
  });

  it('should generate unique keys', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
  });
});

describe('hashApiKey', () => {
  it('should hash API key with preview and digest', () => {
    const key = generateApiKey();
    const hash = hashApiKey(key);

    expect(hash).toContain('.');
    const [preview, digest] = hash.split('.');
    expect(preview).toHaveLength(12);
    expect(digest).toHaveLength(64); // SHA-256 hex
  });

  it('should produce consistent hashes for same input', () => {
    const key = 'ssas_abcdef1234567890abcdef1234567890';
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const key1 = 'ssas_abcdef1234567890abcdef1234567890';
    const key2 = 'ssas_0987654321fedcba0987654321fedcba';
    const hash1 = hashApiKey(key1);
    const hash2 = hashApiKey(key2);
    expect(hash1).not.toBe(hash2);
  });
});

describe('getApiKeyPreview', () => {
  it('should extract preview from stored key', () => {
    const key = 'ssas_abcdef1234567890abcdef1234567890';
    const hash = hashApiKey(key);
    const preview = getApiKeyPreview(hash);
    expect(preview).toBe('ssas_abcdef1');
  });

  it('should return "hidden" for invalid input', () => {
    expect(getApiKeyPreview('')).toBe('hidden');
  });
});
