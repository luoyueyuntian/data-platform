import { describe, it, expect } from 'vitest';
import { validateDeviceKey, validateEmail } from './validation';

describe('validateDeviceKey', () => {
  it('should accept valid alphanumeric keys', () => {
    expect(validateDeviceKey('device001')).toBe(true);
    expect(validateDeviceKey('SENSOR-A')).toBe(true);
    expect(validateDeviceKey('temp_humidity_01')).toBe(true);
  });

  it('should reject keys with special characters', () => {
    expect(validateDeviceKey('device@001')).toBe(false);
    expect(validateDeviceKey('sensor key')).toBe(false);
    expect(validateDeviceKey('device#1')).toBe(false);
  });

  it('should reject empty keys', () => {
    expect(validateDeviceKey('')).toBe(false);
  });

  it('should reject keys longer than 64 characters', () => {
    const longKey = 'a'.repeat(65);
    expect(validateDeviceKey(longKey)).toBe(false);
  });

  it('should accept keys up to 64 characters', () => {
    const validKey = 'a'.repeat(64);
    expect(validateDeviceKey(validKey)).toBe(true);
  });
});

describe('validateEmail', () => {
  it('should accept valid email addresses', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user@domain.co.uk')).toBe(true);
    expect(validateEmail('name+tag@example.org')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
    expect(validateEmail('user@.com')).toBe(false);
  });

  it('should reject emails with spaces', () => {
    expect(validateEmail('user @example.com')).toBe(false);
    expect(validateEmail('user@ example.com')).toBe(false);
  });
});
