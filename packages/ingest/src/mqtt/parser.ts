import type { Event } from '@ssas/core';
import { MqttDataPointSchema, MqttBatchPayloadSchema } from '../http/validator.js';

/**
 * Parse a single MQTT telemetry message into an Event.
 *
 * MQTT payload uses IoT naming (metric/value), converted to generic Event format.
 */
export function parseTelemetryPayload(payload: string, entityId: string): Event[] {
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
    entityId,
    time: ts ? new Date(ts) : new Date(),
    eventName: metric,
    value,
    quality: quality ?? 100,
    tags,
  }];
}

/**
 * Parse a batch MQTT telemetry message into multiple Events.
 */
export function parseBatchTelemetryPayload(payload: string, entityId: string): Event[] {
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
  const events: Event[] = [];

  if (data.values) {
    for (const [eventName, value] of Object.entries(data.values)) {
      events.push({
        entityId,
        time: timestamp,
        eventName,
        value,
        quality: 100,
      });
    }
  }

  if (data.metrics) {
    for (const m of data.metrics) {
      events.push({
        entityId,
        time: timestamp,
        eventName: m.name,
        value: m.value,
        tags: m.tags,
        quality: 100,
      });
    }
  }

  return events;
}

/**
 * Parse a device status message.
 */
export function parseStatusPayload(payload: string): { status: string; message?: string } {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error('Invalid JSON payload');
  }

  const validStatuses = ['active', 'inactive', 'error', 'maintenance'];
  const status = String(parsed.status || 'active');

  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  return {
    status,
    message: parsed.message as string | undefined,
  };
}
