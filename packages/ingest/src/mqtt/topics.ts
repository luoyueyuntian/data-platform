/**
 * MQTT topic parsing and routing.
 *
 * Topic format (参考 ThingsBoard):
 *   ssas/v1/{deviceKey}/telemetry
 *   ssas/v1/{deviceKey}/telemetry/batch
 *   ssas/v1/{deviceKey}/status
 *   ssas/v1/gateway/{gatewayKey}/telemetry
 */

export interface ParsedTopic {
  /** The device or gateway key parsed from the topic */
  deviceKey: string;
  /** Data type: telemetry | telemetry/batch | status */
  dataType: 'telemetry' | 'telemetry_batch' | 'status';
  /** Whether this is a gateway topic */
  isGateway: boolean;
  /** Gateway device key (only when isGateway) */
  gatewayKey?: string;
}

/**
 * Parse an MQTT topic into structured components.
 * Returns null for unrecognized topics.
 */
export function parseTopic(topic: string): ParsedTopic | null {
  // Gateway telemetry: ssas/v1/gateway/{gatewayKey}/telemetry
  const gatewayMatch = topic.match(/^ssas\/v1\/gateway\/([^/]+)\/telemetry$/);
  if (gatewayMatch) {
    return {
      deviceKey: gatewayMatch[1], // gateway device key
      dataType: 'telemetry',
      isGateway: true,
      gatewayKey: gatewayMatch[1],
    };
  }

  // Direct device topics
  const directMatch = topic.match(/^ssas\/v1\/([^/]+)\/(.+)$/);
  if (directMatch) {
    const deviceKey = directMatch[1];
    const suffix = directMatch[2];

    switch (suffix) {
      case 'telemetry':
        return { deviceKey, dataType: 'telemetry', isGateway: false };
      case 'telemetry/batch':
        return { deviceKey, dataType: 'telemetry_batch', isGateway: false };
      case 'status':
        return { deviceKey, dataType: 'status', isGateway: false };
      default:
        return null;
    }
  }

  return null;
}

/**
 * Build a telemetry topic for a device.
 */
export function buildTelemetryTopic(deviceKey: string): string {
  return `ssas/v1/${deviceKey}/telemetry`;
}

/**
 * Build a batch telemetry topic for a device.
 */
export function buildBatchTelemetryTopic(deviceKey: string): string {
  return `ssas/v1/${deviceKey}/telemetry/batch`;
}

/**
 * Build a status topic for a device.
 */
export function buildStatusTopic(deviceKey: string): string {
  return `ssas/v1/${deviceKey}/status`;
}
