import { parseTopic } from './topics.js';
import { parseTelemetryPayload, parseBatchTelemetryPayload, parseStatusPayload } from './parser.js';
import { sendDataPoint, sendBatchDataPoints } from '../buffer/producer.js';
import type { DataPoint } from '@ssas/core';
import { prisma } from '@ssas/database';

/**
 * Route an incoming MQTT message to the appropriate handler.
 * Called by the MQTT client's 'message' event.
 *
 * Flow:
 *   MQTT message → Topic parsing → Payload parsing → Kafka producer
 */
export async function handleIncomingMessage(topic: string, payload: string): Promise<void> {
  const parsed = parseTopic(topic);
  if (!parsed) {
    console.warn(`[mqtt] unknown topic: ${topic}, ignored`);
    return;
  }

  const { deviceKey, dataType, isGateway, gatewayKey } = parsed;
  const effectiveDeviceKey = isGateway ? gatewayKey! : deviceKey;

  const device = await prisma.device.findUnique({
    where: { deviceKey: effectiveDeviceKey },
    select: { id: true },
  });
  if (!device) {
    console.warn(`[mqtt] unknown device key: ${effectiveDeviceKey}, ignored`);
    return;
  }
  const deviceId = device.id;

  let dataPoints: DataPoint[];

  switch (dataType) {
    case 'telemetry': {
      dataPoints = parseTelemetryPayload(payload, deviceId);
      break;
    }
    case 'telemetry_batch': {
      dataPoints = parseBatchTelemetryPayload(payload, deviceId);
      break;
    }
    case 'status': {
      const status = parseStatusPayload(payload);
      // Status changes are handled as system events, not data points
      console.log(`[mqtt] device ${deviceId} status → ${status.status}`, status.message || '');
      // TODO: Update device status in DB
      // TODO: Create system event for status change
      return; // Don't write status to TimescaleDB
    }
    default:
      return;
  }

  // Forward to Kafka for processing
  if (dataPoints.length === 0) {
    console.warn(`[mqtt] no data points parsed from ${topic}`);
    return;
  }

  await sendBatchDataPoints(dataPoints);
  console.log(`[mqtt] routed ${dataPoints.length} points from ${topic}`);
}
