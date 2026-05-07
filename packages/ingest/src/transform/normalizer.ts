import type { Event } from '@ssas/core';

/**
 * Normalize various input formats to standard Event
 */
export function normalizeEvent(input: {
  entityId: string;
  eventName: string;
  value?: number;
  properties?: Record<string, unknown>;
  time?: string;
  tags?: Record<string, string>;
  quality?: number;
}): Event {
  return {
    entityId: input.entityId,
    time: input.time ? new Date(input.time) : new Date(),
    eventName: input.eventName,
    value: input.value,
    properties: input.properties,
    tags: input.tags,
    quality: input.quality ?? 100,
  };
}

/**
 * Normalize MQTT-style payload to standard Event (IoT → generic conversion)
 */
export function normalizeMqttPayload(
  payload: { ts?: number; metric: string; value: number; quality?: number; tags?: Record<string, string> },
  entityId: string,
): Event {
  return {
    entityId,
    time: payload.ts ? new Date(payload.ts) : new Date(),
    eventName: payload.metric,
    value: payload.value,
    quality: payload.quality ?? 100,
    tags: payload.tags,
  };
}

// Backward compatibility alias
export const normalizeDataPoint = normalizeEvent;
