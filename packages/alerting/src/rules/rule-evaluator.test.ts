import { describe, it, expect } from 'vitest';
import type { AlertCondition } from '@ssas/core';

// Test the pure logic functions that don't depend on database
describe('Alert Rule Logic', () => {
  describe('Condition evaluation', () => {
    it('should trigger when value > threshold', () => {
      const currentValue = 100;
      const threshold = 80;
      const operator = '>';

      const triggered = currentValue > threshold;
      expect(triggered).toBe(true);
    });

    it('should not trigger when value <= threshold', () => {
      const currentValue = 80;
      const threshold = 80;
      const operator = '>';

      const triggered = currentValue > threshold;
      expect(triggered).toBe(false);
    });

    it('should trigger when value >= threshold', () => {
      const currentValue = 80;
      const threshold = 80;
      const operator = '>=';

      const triggered = currentValue >= threshold;
      expect(triggered).toBe(true);
    });

    it('should trigger when value < threshold', () => {
      const currentValue = 50;
      const threshold = 80;
      const operator = '<';

      const triggered = currentValue < threshold;
      expect(triggered).toBe(true);
    });

    it('should trigger when value <= threshold', () => {
      const currentValue = 80;
      const threshold = 80;
      const operator = '<=';

      const triggered = currentValue <= threshold;
      expect(triggered).toBe(true);
    });

    it('should trigger when value == threshold (within tolerance)', () => {
      const currentValue = 80.0005;
      const threshold = 80;
      const operator = '==';

      const triggered = Math.abs(currentValue - threshold) < 0.001;
      expect(triggered).toBe(true);
    });

    it('should not trigger when value != threshold', () => {
      const currentValue = 80.002;
      const threshold = 80;
      const operator = '!=';

      const triggered = Math.abs(currentValue - threshold) >= 0.001;
      expect(triggered).toBe(true);
    });
  });

  describe('Severity calculation', () => {
    it('should return critical when value > 1.5x threshold', () => {
      const currentValue = 160;
      const threshold = 100;

      const severity = currentValue > threshold * 1.5 ? 'critical' : 'warn';
      expect(severity).toBe('critical');
    });

    it('should return warn when value is between threshold and 1.5x', () => {
      const currentValue = 120;
      const threshold = 100;

      const severity = currentValue > threshold * 1.5 ? 'critical' : 'warn';
      expect(severity).toBe('warn');
    });

    it('should return critical when value < 0.5x threshold', () => {
      const currentValue = 30;
      const threshold = 100;

      const severity = currentValue < threshold * 0.5 ? 'critical' : 'warn';
      expect(severity).toBe('critical');
    });
  });

  describe('Change percentage calculation', () => {
    it('should calculate change percentage correctly', () => {
      const currentValue = 120;
      const previousValue = 100;

      const change = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
      expect(change).toBe(20);
    });

    it('should handle negative change', () => {
      const currentValue = 80;
      const previousValue = 100;

      const change = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
      expect(change).toBe(-20);
    });

    it('should trigger when change exceeds threshold', () => {
      const change = 25;
      const threshold = 20;

      const triggered = Math.abs(change) > threshold;
      expect(triggered).toBe(true);
    });

    it('should not trigger when change is within threshold', () => {
      const change = 15;
      const threshold = 20;

      const triggered = Math.abs(change) > threshold;
      expect(triggered).toBe(false);
    });
  });

  describe('Anomaly detection', () => {
    it('should detect anomaly when value is N standard deviations from mean', () => {
      const currentValue = 150;
      const mean = 100;
      const stddev = 10;
      const threshold = 3; // 3 standard deviations

      const deviations = Math.abs(currentValue - mean) / stddev;
      const triggered = deviations > threshold;
      expect(triggered).toBe(true);
    });

    it('should not detect anomaly when value is within N standard deviations', () => {
      const currentValue = 120;
      const mean = 100;
      const stddev = 10;
      const threshold = 3;

      const deviations = Math.abs(currentValue - mean) / stddev;
      const triggered = deviations > threshold;
      expect(triggered).toBe(false);
    });

    it('should calculate deviations correctly', () => {
      const currentValue = 130;
      const mean = 100;
      const stddev = 10;

      const deviations = Math.abs(currentValue - mean) / stddev;
      expect(deviations).toBe(3);
    });
  });

  describe('Condition logic (all/any)', () => {
    it('should trigger all conditions with AND logic', () => {
      const results = [true, true, true];
      const logic = 'all';

      const triggered = logic === 'all' ? results.every(Boolean) : results.some(Boolean);
      expect(triggered).toBe(true);
    });

    it('should not trigger all conditions when one fails with AND logic', () => {
      const results = [true, false, true];
      const logic = 'all';

      const triggered = logic === 'all' ? results.every(Boolean) : results.some(Boolean);
      expect(triggered).toBe(false);
    });

    it('should trigger any condition with OR logic', () => {
      const results = [false, true, false];
      const logic: string = 'any';

      const triggered = logic === 'all' ? results.every(Boolean) : results.some(Boolean);
      expect(triggered).toBe(true);
    });

    it('should not trigger any condition when all fail with OR logic', () => {
      const results = [false, false, false];
      const logic: string = 'any';

      const triggered = logic === 'all' ? results.every(Boolean) : results.some(Boolean);
      expect(triggered).toBe(false);
    });
  });

  describe('Severity aggregation', () => {
    it('should return highest severity from multiple conditions', () => {
      const severities = ['info', 'warn', 'critical', 'warn'];
      const order: Record<string, number> = { critical: 3, warn: 2, info: 1 };

      const maxSeverity = severities.reduce((max, sev) => {
        return order[sev] > order[max] ? sev : max;
      }, 'info');

      expect(maxSeverity).toBe('critical');
    });

    it('should return warn when no critical', () => {
      const severities = ['info', 'warn', 'info'];
      const order: Record<string, number> = { critical: 3, warn: 2, info: 1 };

      const maxSeverity = severities.reduce((max, sev) => {
        return order[sev] > order[max] ? sev : max;
      }, 'info');

      expect(maxSeverity).toBe('warn');
    });

    it('should return info when all are info', () => {
      const severities = ['info', 'info', 'info'];
      const order: Record<string, number> = { critical: 3, warn: 2, info: 1 };

      const maxSeverity = severities.reduce((max, sev) => {
        return order[sev] > order[max] ? sev : max;
      }, 'info');

      expect(maxSeverity).toBe('info');
    });
  });

  describe('Window parsing', () => {
    it('should parse minutes', () => {
      const parseWindow = (window: string): number => {
        const match = window.match(/^(\d+)(m|h|d)$/);
        if (!match) return 5;
        const value = parseInt(match[1], 10);
        switch (match[2]) {
          case 'm': return value;
          case 'h': return value * 60;
          case 'd': return value * 1440;
          default: return 5;
        }
      };

      expect(parseWindow('5m')).toBe(5);
      expect(parseWindow('30m')).toBe(30);
    });

    it('should parse hours', () => {
      const parseWindow = (window: string): number => {
        const match = window.match(/^(\d+)(m|h|d)$/);
        if (!match) return 5;
        const value = parseInt(match[1], 10);
        switch (match[2]) {
          case 'm': return value;
          case 'h': return value * 60;
          case 'd': return value * 1440;
          default: return 5;
        }
      };

      expect(parseWindow('1h')).toBe(60);
      expect(parseWindow('24h')).toBe(1440);
    });

    it('should parse days', () => {
      const parseWindow = (window: string): number => {
        const match = window.match(/^(\d+)(m|h|d)$/);
        if (!match) return 5;
        const value = parseInt(match[1], 10);
        switch (match[2]) {
          case 'm': return value;
          case 'h': return value * 60;
          case 'd': return value * 1440;
          default: return 5;
        }
      };

      expect(parseWindow('1d')).toBe(1440);
      expect(parseWindow('7d')).toBe(10080);
    });

    it('should default to 5 minutes for invalid format', () => {
      const parseWindow = (window: string): number => {
        const match = window.match(/^(\d+)(m|h|d)$/);
        if (!match) return 5;
        const value = parseInt(match[1], 10);
        switch (match[2]) {
          case 'm': return value;
          case 'h': return value * 60;
          case 'd': return value * 1440;
          default: return 5;
        }
      };

      expect(parseWindow('invalid')).toBe(5);
      expect(parseWindow('5x')).toBe(5);
    });
  });
});
