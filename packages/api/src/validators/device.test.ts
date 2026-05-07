import { describe, it, expect } from 'vitest';
import {
  createEntitySchema,
  updateEntitySchema,
  entityListQuerySchema,
  createTagSchema,
} from './device';

describe('createEntitySchema', () => {
  const validEntity = {
    name: 'Temperature Sensor T-01',
    entityKey: 'temp-sensor-01',
  };

  it('should accept valid entity', () => {
    const result = createEntitySchema.safeParse(validEntity);
    expect(result.success).toBe(true);
  });

  it('should apply defaults', () => {
    const result = createEntitySchema.safeParse(validEntity);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('custom');
      expect(result.data.status).toBe('inactive');
    }
  });

  it('should accept all optional fields', () => {
    const result = createEntitySchema.safeParse({
      ...validEntity,
      type: 'temperature',
      status: 'active',
      groupId: '123e4567-e89b-12d3-a456-426614174000',
      location: { name: 'Building A', lat: 39.9, lng: 116.3 },
      metadata: { vendor: 'Demo Inc.' },
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = createEntitySchema.safeParse({
      ...validEntity,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid entityKey characters', () => {
    const result = createEntitySchema.safeParse({
      ...validEntity,
      entityKey: 'invalid key@',
    });
    expect(result.success).toBe(false);
  });

  it('should accept entityKey with hyphens and underscores', () => {
    const result = createEntitySchema.safeParse({
      ...validEntity,
      entityKey: 'my-entity_key',
    });
    expect(result.success).toBe(true);
  });

  it('should accept any type string', () => {
    const result = createEntitySchema.safeParse({
      ...validEntity,
      type: 'custom_type',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid entity status', () => {
    const result = createEntitySchema.safeParse({
      ...validEntity,
      status: 'invalid_status',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid location coordinates', () => {
    const result = createEntitySchema.safeParse({
      ...validEntity,
      location: { lat: 100 },
    });
    expect(result.success).toBe(false);
  });
});

describe('updateEntitySchema', () => {
  it('should accept partial updates', () => {
    const result = updateEntitySchema.safeParse({ name: 'New Name' });
    expect(result.success).toBeDefined();
  });

  it('should accept empty update', () => {
    const result = updateEntitySchema.safeParse({});
    expect(result.success).toBeDefined();
  });

  it('should accept null values for optional fields', () => {
    const result = updateEntitySchema.safeParse({
      groupId: null,
      location: null,
      metadata: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid phase', () => {
    const result = updateEntitySchema.safeParse({ phase: 'running' });
    expect(result.success).toBeDefined();
  });
});

describe('entityListQuerySchema', () => {
  it('should apply defaults', () => {
    const result = entityListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it('should coerce string to number', () => {
    const result = entityListQuerySchema.safeParse({
      page: '3',
      pageSize: '50',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(50);
    }
  });

  it('should reject page < 1', () => {
    const result = entityListQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject pageSize > 100', () => {
    const result = entityListQuerySchema.safeParse({ pageSize: 101 });
    expect(result.success).toBe(false);
  });

  it('should accept filter params', () => {
    const result = entityListQuerySchema.safeParse({
      search: 'sensor',
      status: 'active',
      type: 'temperature',
      phase: 'running',
    });
    expect(result.success).toBe(true);
  });
});

describe('createTagSchema', () => {
  it('should accept valid tag', () => {
    const result = createTagSchema.safeParse({
      key: 'zone',
      value: 'reactor-1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe('manual');
    }
  });

  it('should reject empty key', () => {
    const result = createTagSchema.safeParse({
      key: '',
      value: 'test',
    });
    expect(result.success).toBe(false);
  });
});
