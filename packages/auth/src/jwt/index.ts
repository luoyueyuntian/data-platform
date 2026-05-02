import jwt, { type SignOptions } from 'jsonwebtoken';
import type { UserRole } from '../rbac.js';

export interface TokenClaims {
  userId: string;
  tenantId: string;
  role: UserRole;
}

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
  type: 'refresh';
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.includes('change-me')) {
    throw new Error('JWT_SECRET must be set to a secure value with at least 32 characters');
  }
  return secret;
}

function getExpiry(name: 'JWT_EXPIRES_IN' | 'JWT_REFRESH_EXPIRES_IN', fallback: SignOptions['expiresIn']) {
  return (process.env[name] as SignOptions['expiresIn'] | undefined) ?? fallback;
}

export function signAccessToken(claims: TokenClaims): string {
  return jwt.sign(
    { sub: claims.userId, tenantId: claims.tenantId, role: claims.role, type: 'access' },
    getJwtSecret(),
    { expiresIn: getExpiry('JWT_EXPIRES_IN', '24h') },
  );
}

export function signRefreshToken(claims: TokenClaims): string {
  return jwt.sign(
    { sub: claims.userId, tenantId: claims.tenantId, role: claims.role, type: 'refresh' },
    getJwtSecret(),
    { expiresIn: getExpiry('JWT_REFRESH_EXPIRES_IN', '7d') },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
  if (payload.type !== 'access') {
    throw new Error('Invalid access token');
  }
  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, getJwtSecret()) as RefreshTokenPayload;
  if (payload.type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }
  return payload;
}
