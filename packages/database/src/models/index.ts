/**
 * Database models — re-exported from Prisma-generated types
 *
 * Usage:
 *   import { prisma } from '@ssas/database';
 *   const devices = await prisma.device.findMany({ where: { tenantId } });
 */

// Type re-exports will be added as needed:
// export type { Device, Sensor, User, ... } from '@prisma/client';

export type {
  Tenant,
  User,
  Device,
  Sensor,
  DeviceGroup,
  DeviceTag,
  AlertRule,
  AlertRecord,
  Dashboard,
  Panel,
  DataPoint,
  ApiKey,
  AuditLog,
} from '@prisma/client';
