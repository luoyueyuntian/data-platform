import { describe, it, expect, vi } from 'vitest';
import { sleep, getTimeRange, toISO } from './time';

describe('sleep', () => {
  it('should resolve after specified time', async () => {
    vi.useFakeTimers();
    const promise = sleep(1000);

    vi.advanceTimersByTime(1000);
    await promise;

    vi.useRealTimers();
  });
});

describe('getTimeRange', () => {
  it('should calculate time range for minutes', () => {
    const now = new Date('2026-04-30T12:00:00Z');
    vi.setSystemTime(now);

    const { start, end } = getTimeRange('5m', 1);

    expect(end).toEqual(now);
    expect(start.getTime()).toBe(now.getTime() - 5 * 60 * 1000);

    vi.useRealTimers();
  });

  it('should calculate time range for hours', () => {
    const now = new Date('2026-04-30T12:00:00Z');
    vi.setSystemTime(now);

    const { start, end } = getTimeRange('1h', 3);

    expect(end).toEqual(now);
    expect(start.getTime()).toBe(now.getTime() - 3 * 60 * 60 * 1000);

    vi.useRealTimers();
  });

  it('should calculate time range for days', () => {
    const now = new Date('2026-04-30T12:00:00Z');
    vi.setSystemTime(now);

    const { start, end } = getTimeRange('1d', 7);

    expect(end).toEqual(now);
    expect(start.getTime()).toBe(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    vi.useRealTimers();
  });

  it('should default to 24 hours for unknown unit', () => {
    const now = new Date('2026-04-30T12:00:00Z');
    vi.setSystemTime(now);

    const { start, end } = getTimeRange('1x', 1);

    expect(end).toEqual(now);
    expect(start.getTime()).toBe(now.getTime() - 24 * 60 * 60 * 1000);

    vi.useRealTimers();
  });
});

describe('toISO', () => {
  it('should convert Date to ISO string', () => {
    const date = new Date('2026-04-30T12:00:00Z');
    expect(toISO(date)).toBe('2026-04-30T12:00:00.000Z');
  });
});
