import { describe, it, expect } from 'vitest';
import { validateEntityKey, validateEmail } from './validation';

describe('validateEntityKey', () => {
  it('should accept valid alphanumeric keys', () => {
    expect(validateEntityKey('entity001')).toBe(true);
    expect(validateEntityKey('SENSOR-A')).toBe(true);
    expect(validateEntityKey('temp_humidity_01')).toBe(true);
  });

  it('should reject keys with special characters', () => {
    expect(validateEntityKey('entity@001')).toBe(false);
    expect(validateEntityKey('entity key')).toBe(false);
    expect(validateEntityKey('entity#1')).toBe(false);
  });

  it('should reject empty keys', () => {
    expect(validateEntityKey('')).toBe(false);
  });

  it('should reject keys longer than 64 characters', () => {
    const longKey = 'a'.repeat(65);
    expect(validateEntityKey(longKey)).toBe(false);
  });

  it('should accept keys up to 64 characters', () => {
    const validKey = 'a'.repeat(64);
    expect(validateEntityKey(validKey)).toBe(true);
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
