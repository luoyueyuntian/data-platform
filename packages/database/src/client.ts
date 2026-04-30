import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient instance.
 * In development, re-use the same instance across hot reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
