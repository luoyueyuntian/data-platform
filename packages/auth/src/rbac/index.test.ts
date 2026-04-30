import { describe, it, expect } from 'vitest';
import { USER_ROLES, isUserRole, hasRequiredRole } from './index';

describe('USER_ROLES', () => {
  it('should define 4 roles', () => {
    expect(USER_ROLES).toEqual(['admin', 'operator', 'analyst', 'viewer']);
  });
});

describe('isUserRole', () => {
  it('should return true for valid roles', () => {
    expect(isUserRole('admin')).toBe(true);
    expect(isUserRole('operator')).toBe(true);
    expect(isUserRole('analyst')).toBe(true);
    expect(isUserRole('viewer')).toBe(true);
  });

  it('should return false for invalid roles', () => {
    expect(isUserRole('superadmin')).toBe(false);
    expect(isUserRole('user')).toBe(false);
    expect(isUserRole('')).toBe(false);
  });
});

describe('hasRequiredRole', () => {
  it('should return true when user has required role', () => {
    expect(hasRequiredRole('admin', ['admin'])).toBe(true);
    expect(hasRequiredRole('operator', ['admin', 'operator'])).toBe(true);
    expect(hasRequiredRole('viewer', ['admin', 'operator', 'analyst', 'viewer'])).toBe(true);
  });

  it('should return false when user does not have required role', () => {
    expect(hasRequiredRole('viewer', ['admin'])).toBe(false);
    expect(hasRequiredRole('analyst', ['admin', 'operator'])).toBe(false);
  });

  it('should handle empty allowed roles', () => {
    expect(hasRequiredRole('admin', [])).toBe(false);
  });
});
