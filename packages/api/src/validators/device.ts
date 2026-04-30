import { z } from 'zod';

const deviceTypeEnum = z.enum([
  'temperature', 'humidity', 'pressure', 'motion', 'vibration',
  'flow', 'level', 'gas', 'custom',
]);

const deviceStatusEnum = z.enum([
  'online', 'offline', 'error', 'disabled', 'maintenance',
]);

const devicePhaseEnum = z.enum([
  'registered', 'active', 'running', 'maintenance', 'retired',
]);

const locationSchema = z.object({
  name: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  address: z.string().optional(),
}).optional();

export const createDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  deviceKey: z.string().min(1).max(255)
    .regex(/^[a-zA-Z0-9_-]+$/, 'deviceKey must be alphanumeric, hyphens or underscores'),
  type: deviceTypeEnum.optional().default('custom'),
  status: deviceStatusEnum.optional().default('offline'),
  groupId: z.string().uuid().optional(),
  location: locationSchema,
  metadata: z.record(z.unknown()).optional(),
});

export const updateDeviceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: deviceTypeEnum.optional(),
  status: deviceStatusEnum.optional(),
  phase: devicePhaseEnum.optional(),
  groupId: z.string().uuid().nullable().optional(),
  location: locationSchema.nullable(),
  metadata: z.record(z.unknown()).nullable(),
});

export const deviceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  status: deviceStatusEnum.optional(),
  type: deviceTypeEnum.optional(),
  groupId: z.string().uuid().optional(),
  phase: devicePhaseEnum.optional(),
});

export const createSensorSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(50),
  unit: z.string().max(50),
  rangeMin: z.number().optional(),
  rangeMax: z.number().optional(),
  precision: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createTagSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.string().max(255),
  source: z.string().max(50).optional().default('manual'),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
