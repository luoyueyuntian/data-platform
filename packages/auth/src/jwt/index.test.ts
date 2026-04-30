import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type TokenClaims,
} from './index';

// Set JWT_SECRET for tests
const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('JWT Token Management', () => {
  const claims: TokenClaims = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    role: 'admin',
  };

  describe('signAccessToken', () => {
    it('should sign a valid access token', () => {
      const token = signAccessToken(claims);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('signRefreshToken', () => {
    it('should sign a valid refresh token', () => {
      const token = signRefreshToken(claims);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = signAccessToken(claims);
      const payload = verifyAccessToken(token);

      expect(payload.sub).toBe(claims.userId);
      expect(payload.tenantId).toBe(claims.tenantId);
      expect(payload.role).toBe(claims.role);
      expect(payload.type).toBe('access');
    });

    it('should reject a refresh token as access token', () => {
      const refreshToken = signRefreshToken(claims);
      expect(() => verifyAccessToken(refreshToken)).toThrow('Invalid access token');
    });

    it('should reject an invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = signRefreshToken(claims);
      const payload = verifyRefreshToken(token);

      expect(payload.sub).toBe(claims.userId);
      expect(payload.tenantId).toBe(claims.tenantId);
      expect(payload.role).toBe(claims.role);
      expect(payload.type).toBe('refresh');
    });

    it('should reject an access token as refresh token', () => {
      const accessToken = signAccessToken(claims);
      expect(() => verifyRefreshToken(accessToken)).toThrow('Invalid refresh token');
    });
  });

  describe('Token separation', () => {
    it('should not accept access token as refresh token and vice versa', () => {
      const accessToken = signAccessToken(claims);
      const refreshToken = signRefreshToken(claims);

      expect(accessToken).not.toBe(refreshToken);

      // Access token should fail as refresh
      expect(() => verifyRefreshToken(accessToken)).toThrow();

      // Refresh token should fail as access
      expect(() => verifyAccessToken(refreshToken)).toThrow();
    });
  });
});
