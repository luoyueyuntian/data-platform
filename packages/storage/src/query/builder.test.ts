import { describe, it, expect } from 'vitest';
import { buildEventQuery, buildExportQuery } from './builder';

describe('buildEventQuery', () => {
  const validParams = {
    entityIds: ['entity-1', 'entity-2'],
    eventNames: ['temperature', 'humidity'],
    startTime: '2026-04-01T00:00:00Z',
    endTime: '2026-04-30T00:00:00Z',
    granularity: '1h' as const,
    aggregation: 'avg' as const,
  };

  it('should build a valid query with all params', () => {
    const query = buildEventQuery(validParams);

    expect(query.entityIds).toEqual(['entity-1', 'entity-2']);
    expect(query.eventNames).toEqual(['temperature', 'humidity']);
    expect(query.startTime).toBeInstanceOf(Date);
    expect(query.endTime).toBeInstanceOf(Date);
    expect(query.granularity).toBe('1h');
    expect(query.aggregation).toBe('avg');
  });

  it('should use defaults for optional params', () => {
    const query = buildEventQuery({
      entityIds: ['entity-1'],
      startTime: '2026-04-01T00:00:00Z',
      endTime: '2026-04-30T00:00:00Z',
    });

    expect(query.granularity).toBe('1h');
    expect(query.aggregation).toBe('avg');
    expect(query.limit).toBe(1000);
    expect(query.offset).toBe(0);
  });

  it('should reject invalid startTime', () => {
    expect(() =>
      buildEventQuery({
        ...validParams,
        startTime: 'invalid-date',
      })
    ).toThrow('Invalid startTime');
  });

  it('should reject invalid endTime', () => {
    expect(() =>
      buildEventQuery({
        ...validParams,
        endTime: 'invalid-date',
      })
    ).toThrow('Invalid endTime');
  });

  it('should reject startTime >= endTime', () => {
    expect(() =>
      buildEventQuery({
        ...validParams,
        startTime: '2026-04-30T00:00:00Z',
        endTime: '2026-04-01T00:00:00Z',
      })
    ).toThrow('startTime must be before endTime');
  });

  it('should reject query range > 365 days', () => {
    expect(() =>
      buildEventQuery({
        ...validParams,
        startTime: '2025-01-01T00:00:00Z',
        endTime: '2026-12-31T00:00:00Z',
      })
    ).toThrow('Query range cannot exceed 365 days');
  });

  it('should cap limit to 10000', () => {
    const query = buildEventQuery({
      ...validParams,
      limit: 50000,
    });
    expect(query.limit).toBe(10000);
  });
});

describe('buildExportQuery', () => {
  it('should build export query with fixed settings', () => {
    const query = buildExportQuery({
      entityIds: ['entity-1'],
      startTime: '2026-04-01T00:00:00Z',
      endTime: '2026-04-30T00:00:00Z',
    });

    expect(query.granularity).toBe('1m');
    expect(query.aggregation).toBe('avg');
    expect(query.limit).toBeGreaterThan(0);
  });
});
