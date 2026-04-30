import type { DataPoint } from '@ssas/core';

/**
 * Normalize various input formats to standard DataPoint
 */
export function normalizeDataPoint(input: {
  deviceId: string;
  metricName: string;
  value: number;
  time?: string;
  sensorId?: string;
  tags?: Record<string, string>;
  quality?: number;
}): DataPoint {
  return {
    deviceId: input.deviceId,
    time: input.time ? new Date(input.time) : new Date(),
    metricName: input.metricName,
    value: input.value,
    sensorId: input.sensorId,
    tags: input.tags,
    quality: input.quality ?? 100,
  };
}

/**
 * Normalize MQTT-style payload to standard DataPoint
 */
export function normalizeMqttPayload(
  payload: { ts?: number; metric: string; value: number; quality?: number; tags?: Record<string, string> },
  deviceId: string,
): DataPoint {
  return {
    deviceId,
    time: payload.ts ? new Date(payload.ts) : new Date(),
    metricName: payload.metric,
    value: payload.value,
    quality: payload.quality ?? 100,
    tags: payload.tags,
  };
}
