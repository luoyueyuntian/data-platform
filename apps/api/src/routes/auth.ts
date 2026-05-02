import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '@ssas/database';
import bcrypt from 'bcryptjs';
import { isUserRole, signAccessToken, signRefreshToken, verifyRefreshToken } from '@ssas/auth';
import { authMiddleware, getAuth, requireUserAuth, optionalAuth } from '../middleware/auth.js';

const authRoutes = new Hono();
const DEFAULT_BOOTSTRAP_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ======================
// Validation
// ======================

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  password: z.string().min(6).max(128),
  role: z.enum(['admin', 'operator', 'analyst', 'viewer']).default('viewer'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

authRoutes.use('*', optionalAuth);

// ======================
// Routes
// ======================

/**
 * POST /api/v1/auth/login
 * Authenticate and return JWT token.
 */
authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) {
    return c.json({ code: 401, message: 'Invalid email or password' }, 401);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return c.json({ code: 401, message: 'Invalid email or password' }, 401);
  }

  if (user.status === 'disabled') {
    return c.json({ code: 403, message: 'Account disabled' }, 403);
  }

  if (!isUserRole(user.role)) {
    return c.json({ code: 500, message: 'Unsupported user role' }, 500);
  }

  const token = signAccessToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  });
  const refreshToken = signRefreshToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  });

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return c.json({
    code: 0,
    message: 'ok',
    data: {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    },
  });
});

/**
 * POST /api/v1/auth/register
 * Create a new user. The first user can bootstrap the tenant; subsequent
 * registrations require an authenticated admin in the same tenant.
 */
authRoutes.post('/register', zValidator('json', createUserSchema), async (c) => {
  const data = c.req.valid('json');
  const userCount = await prisma.user.count();

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return c.json({ code: 409, message: 'Email already registered' }, 409);
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);
  let tenantId: string;
  let role = data.role;

  if (userCount === 0) {
    await prisma.tenant.upsert({
      where: { id: DEFAULT_BOOTSTRAP_TENANT_ID },
      update: {},
      create: {
        id: DEFAULT_BOOTSTRAP_TENANT_ID,
        name: 'Default Organization',
        plan: 'free',
      },
    });
    tenantId = DEFAULT_BOOTSTRAP_TENANT_ID;
    role = 'admin';
  } else {
    const auth = requireUserAuth(c);
    if (auth.role !== 'admin') {
      return c.json({ code: 403, message: 'Admin role required' }, 403);
    }
    tenantId = auth.tenantId;
  }

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: data.email,
      name: data.name,
      password: hashedPassword,
      role,
    },
    select: { id: true, email: true, name: true, role: true, tenantId: true, createdAt: true },
  });

  return c.json({ code: 0, message: 'ok', data: user }, 201);
});

/**
 * POST /api/v1/auth/verify
 * Verify JWT token and return user info.
 */
authRoutes.post('/verify', authMiddleware, async (c) => {
  const auth = requireUserAuth(c);

  const user = await prisma.user.findFirst({
    where: {
      id: auth.userId,
      tenantId: auth.tenantId,
    },
    select: {
      id: true,
      tenantId: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    return c.json({ code: 404, message: 'User not found' }, 404);
  }

  return c.json({ code: 0, message: 'ok', data: user });
});

/**
 * POST /api/v1/auth/refresh
 * Exchange a valid refresh token for a new access + refresh token pair.
 */
authRoutes.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken: rawRefreshToken } = c.req.valid('json');

  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    return c.json({ code: 401, message: 'Invalid or expired refresh token' }, 401);
  }

  // Verify user still exists and is active
  const user = await prisma.user.findFirst({
    where: {
      id: payload.sub,
      tenantId: payload.tenantId,
      status: 'active',
    },
    select: { id: true, tenantId: true, role: true, email: true, name: true },
  });

  if (!user) {
    return c.json({ code: 401, message: 'User not found or disabled' }, 401);
  }

  if (!isUserRole(user.role)) {
    return c.json({ code: 500, message: 'Unsupported user role' }, 500);
  }

  const newToken = signAccessToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  });
  const newRefreshToken = signRefreshToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  });

  return c.json({
    code: 0,
    message: 'ok',
    data: {
      token: newToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    },
  });
});

export { authRoutes };
