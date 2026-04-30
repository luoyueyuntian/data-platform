import { z } from 'zod';

/**
 * Single DataPoint ingestion schema
 */
export const DataPointSchema = z.object({
  deviceId: z.string().uuid(),
  metricName: z.string().min(1).max(100),
  value: z.number(),
  time: z.string().datetime().optional(),
  sensorId: z.string().uuid().optional(),
  tags: z.record(z.string().max(255)).optional(),
  quality: z.number().int().min(0).max(100).optional().default(100),
});

/**
 * Batch DataPoint ingestion schema
 */
export const DataPointBatchSchema = z.object({
  deviceId: z.string().uuid(),
  dataPoints: z.array(DataPointSchema).min(1).max(1000),
});

/**
 * MQTT DataPoint payload schema (without deviceId, set by topic)
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

export type DataPointInput = z.infer<typeof DataPointSchema>;
export type DataPointBatchInput = z.infer<typeof DataPointBatchSchema>;
