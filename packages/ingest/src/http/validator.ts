import { z } from 'zod';

/**
 * Single Event ingestion schema
 */
export const EventSchema = z.object({
  entityId: z.string().uuid(),
  eventName: z.string().min(1).max(100),
  value: z.number().optional(),
  properties: z.record(z.unknown()).optional(),
  time: z.string().datetime().optional(),
  tags: z.record(z.string().max(255)).optional(),
  quality: z.number().int().min(0).max(100).optional().default(100),
});

/**
 * Batch Event ingestion schema
 */
export const EventBatchSchema = z.object({
  entityId: z.string().uuid(),
  events: z.array(EventSchema).min(1).max(1000),
});

/**
 * MQTT DataPoint payload schema (IoT-specific, converted to Event internally)
 */
export const MqttDataPointSchema = z.object({
  ts: z.number().positive().optional(),
  metric: z.string().min(1).max(100),
  value: z.number(),
  quality: z.number().int().min(0).max(100).optional().default(100),
  tags: z.record(z.string()).optional(),
});

/**
 * MQTT batch payload schema
 */
export const MqttBatchPayloadSchema = z.object({
  ts: z.number().positive().optional(),
  values: z.record(z.number()).optional(),
  metrics: z.array(z.object({
    name: z.string().min(1).max(100),
    value: z.number(),
    tags: z.record(z.string()).optional(),
  })).optional(),
}).refine((data) => data.values !== undefined || data.metrics !== undefined, {
  message: 'Either "values" or "metrics" must be provided',
});

export type EventInput = z.infer<typeof EventSchema>;
export type EventBatchInput = z.infer<typeof EventBatchSchema>;

// Backward compatibility aliases
export const DataPointSchema = EventSchema;
export const DataPointBatchSchema = EventBatchSchema;
export type DataPointInput = EventInput;
export type DataPointBatchInput = EventBatchInput;
