import type { DataPoint } from '@ssas/core';
import { MqttDataPointSchema, MqttBatchPayloadSchema } from '../http/validator.js';

/**
 * Parse a single MQTT telemetry message into a DataPoint.
 *
 * Payload format:
 *   { "ts": 1700000000000, "metric": "temperature", "value": 36.5, "quality": 100 }
 *   { "ts": 1700000000000, "metric": "temperature", "value": 36.5, "tags": { "unit": "celsius" } }
 */
export function parseTelemetryPayload(payload: string, deviceId: string): DataPoint[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error('Invalid JSON payload');
  }

  const result = MqttDataPointSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid telemetry format: ${result.error.message}`);
  }

  const { ts, metric, value, quality, tags } = result.data;

  return [{
    deviceId,
    time: ts ? new Date(ts) : new Date(),
    metricName: metric,
    value,
    quality: quality ?? 100,
    tags,
  }];
}

/**
 * Parse a batch MQTT telemetry message into multiple DataPoints.
 *
 * Payload formats:
 *   { "ts": 1700000000000, "values": { "temperature": 36.5, "humidity": 65.2 } }
 *   { "ts": 1700000000000, "metrics": [{ "name": "temperature", "value": 36.5 }, ...] }
 */
export function parseBatchTelemetryPayload(payload: string, deviceId: string): DataPoint[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error('Invalid JSON payload');
  }

  const result = MqttBatchPayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid batch telemetry format: ${result.error.message}`);
  }

  const data = result.data;
  const timestamp = data.ts ? new Date(data.ts) : new Date();
  const points: DataPoint[] = [];

  // Format 1: { "values": { "temp": 36.5, "hum": 65.2 } }
  if (data.values) {
    for (const [metricName, value] of Object.entries(data.values)) {
      points.push({
        deviceId,
        time: timestamp,
        metricName,
        value,
        quality: 100,
      });
    }
  }

  // Format 2: { "metrics": [{ "name": "temp", "value": 36.5, "tags": {} }] }
  if (data.metrics) {
    for (const m of data.metrics) {
      points.push({
        deviceId,
        time: timestamp,
        metricName: m.name,
        value: m.value,
        tags: m.tags,
        quality: 100,
      });
    }
  }

  return points;
}

/**
 * Parse a device status message.
 *
 * Payload format:
 *   { "status": "online" | "offline" | "error", "message"?: "..." }
 */
export function parseStatusPayload(payload: string): { status: string; message?: string } {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error('Invalid JSON payload');
  }

  const validStatuses = ['online', 'offline', 'error', 'maintenance'];
  const status = String(parsed.status || 'online');

  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  return {
    status,
    message: parsed.message as string | undefined,
  };
}
