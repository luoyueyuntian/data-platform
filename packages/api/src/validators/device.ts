import { z } from 'zod';

const entityStatusEnum = z.enum([
  'active', 'inactive', 'error', 'disabled', 'maintenance',
]);

const entityPhaseEnum = z.enum([
  'registered', 'active', 'running', 'maintenance', 'retired',
]);

const locationSchema = z.object({
  name: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  address: z.string().optional(),
}).optional();

export const createEntitySchema = z.object({
  name: z.string().min(1).max(255),
  entityKey: z.string().min(1).max(255)
    .regex(/^[a-zA-Z0-9_-]+$/, 'entityKey must be alphanumeric, hyphens or underscores'),
  type: z.string().optional().default('custom'),
  status: entityStatusEnum.optional().default('inactive'),
  groupId: z.string().uuid().optional(),
  location: locationSchema,
  metadata: z.record(z.unknown()).optional(),
});

export const updateEntitySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.string().optional(),
  status: entityStatusEnum.optional(),
  phase: entityPhaseEnum.optional(),
  groupId: z.string().uuid().nullable().optional(),
  location: locationSchema.nullable(),
  metadata: z.record(z.unknown()).nullable(),
});

export const entityListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  status: entityStatusEnum.optional(),
  type: z.string().optional(),
  groupId: z.string().uuid().optional(),
  phase: entityPhaseEnum.optional(),
});

export const createTagSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.string().max(255),
  source: z.string().max(50).optional().default('manual'),
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;

// Backward compatibility aliases
export const createDeviceSchema = createEntitySchema;
export const updateDeviceSchema = updateEntitySchema;
export const deviceListQuerySchema = entityListQuerySchema;
export const createSensorSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(50),
  unit: z.string().max(50),
  rangeMin: z.number().optional(),
  rangeMax: z.number().optional(),
  precision: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});
