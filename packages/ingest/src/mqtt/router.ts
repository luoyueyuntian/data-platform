import { parseTopic } from './topics.js';
import { parseTelemetryPayload, parseBatchTelemetryPayload, parseStatusPayload } from './parser.js';
import { sendEvent, sendBatchEvents } from '../buffer/producer.js';
import type { Event } from '@ssas/core';
import { prisma } from '@ssas/database';

/**
 * Route an incoming MQTT message to the appropriate handler.
 * Called by the MQTT client's 'message' event.
 *
 * Flow:
 *   MQTT message → Topic parsing → Payload parsing → Kafka producer
 *
 * MQTT is IoT-specific: deviceKey maps to entityId, metric maps to eventName.
 */
export async function handleIncomingMessage(topic: string, payload: string): Promise<void> {
  const parsed = parseTopic(topic);
  if (!parsed) {
    console.warn(`[mqtt] unknown topic: ${topic}, ignored`);
    return;
  }

  const { deviceKey, dataType, isGateway, gatewayKey } = parsed;
  const effectiveDeviceKey = isGateway ? gatewayKey! : deviceKey;

  const entity = await prisma.entity.findUnique({
    where: { entityKey: effectiveDeviceKey },
    select: { id: true },
  });
  if (!entity) {
    console.warn(`[mqtt] unknown entity key: ${effectiveDeviceKey}, ignored`);
    return;
  }
  const entityId = entity.id;

  let events: Event[];

  switch (dataType) {
    case 'telemetry': {
      events = parseTelemetryPayload(payload, entityId);
      break;
    }
    case 'telemetry_batch': {
      events = parseBatchTelemetryPayload(payload, entityId);
      break;
    }
    case 'status': {
      const status = parseStatusPayload(payload);
      console.log(`[mqtt] entity ${entityId} status → ${status.status}`, status.message || '');
      return;
    }
    default:
      return;
  }

  if (events.length === 0) {
    console.warn(`[mqtt] no events parsed from ${topic}`);
    return;
  }

  await sendBatchEvents(events);
  console.log(`[mqtt] routed ${events.length} events from ${topic}`);
}
