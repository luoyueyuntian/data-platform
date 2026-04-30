/**
 * @ssas/mqtt — Device-side MQTT SDK
 *
 * Lightweight client for IoT devices to publish data to the SSAS platform.
 * Usage:
 *   import { createDeviceClient } from '@ssas/mqtt';
 *
 *   const client = await createDeviceClient({
 *     deviceKey: 'sensor-t01',
 *     brokerUrl: 'mqtt://localhost:1883',
 *   });
 *
 *   // Report a single metric
 *   await client.reportTelemetry('temperature', 36.5);
 *
 *   // Report multiple metrics at once
 *   await client.reportBatch({ temperature: 36.5, humidity: 65.2 });
 *
 *   // Report device status
 *   await client.reportStatus('online');
 */

import mqtt, { type MqttClient, type IClientOptions } from 'mqtt';

export interface DeviceClientOptions {
  deviceKey: string;
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId?: string;
  /** Use TLS (mqtts://) */
  tls?: boolean;
}

export interface DeviceClient {
  /** Report a single sensor reading */
  reportTelemetry: (metric: string, value: number, options?: { quality?: number; tags?: Record<string, string> }) => Promise<void>;
  /** Report multiple sensor readings at once */
  reportBatch: (values: Record<string, number>, options?: { quality?: number }) => Promise<void>;
  /** Report device online/offline status */
  reportStatus: (status: 'online' | 'offline' | 'error' | 'maintenance', message?: string) => Promise<void>;
  /** Disconnect from MQTT broker */
  disconnect: () => Promise<void>;
  /** Check if connected */
  isConnected: () => boolean;
}

/**
 * Create a device client and connect to the SSAS platform.
 */
export function createDeviceClient(options: DeviceClientOptions): Promise<DeviceClient> {
  const { deviceKey, brokerUrl, username, password, tls } = options;

  const clientId = options.clientId || `device-${deviceKey}-${Math.random().toString(36).slice(2, 8)}`;

  const opts: IClientOptions = {
    clientId,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 5000,
  };

  if (username) opts.username = username;
  if (password) opts.password = password;
  if (tls || brokerUrl.startsWith('mqtts://')) {
    opts.protocol = 'mqtts';
    opts.rejectUnauthorized = true;
  }

  return new Promise((resolve, reject) => {
    const client = mqtt.connect(brokerUrl, opts);

    client.on('connect', () => {
      console.log(`[device:${deviceKey}] connected to ${brokerUrl}`);

      const deviceApi: DeviceClient = {
        async reportTelemetry(metric, value, { quality, tags } = {}) {
          const payload = JSON.stringify({
            ts: Date.now(),
            metric,
            value,
            quality: quality ?? 100,
            tags,
          });
          await client.publishAsync(`ssas/v1/${deviceKey}/telemetry`, payload, { qos: 1 });
        },

        async reportBatch(values, { quality } = {}) {
          const payload = JSON.stringify({
            ts: Date.now(),
            values,
            quality: quality ?? 100,
          });
          await client.publishAsync(`ssas/v1/${deviceKey}/telemetry/batch`, payload, { qos: 1 });
        },

        async reportStatus(status, message) {
          const payload = JSON.stringify({ status, message });
          await client.publishAsync(`ssas/v1/${deviceKey}/status`, payload, { qos: 1 });
        },

        async disconnect() {
          client.end(true);
          console.log(`[device:${deviceKey}] disconnected`);
        },

        isConnected() {
          return client.connected;
        },
      };

      resolve(deviceApi);
    });

    client.on('error', (err) => {
      console.error(`[device:${deviceKey}] connection error:`, err);
      reject(err);
    });

    client.on('reconnect', () => {
      console.log(`[device:${deviceKey}] reconnecting...`);
    });
  });
}

/**
 * Connect multiple devices as a gateway.
 * Gateway proxies data for child devices that cannot connect directly.
 */
export function createGatewayClient(options: DeviceClientOptions): Promise<DeviceClient> {
  // Gateway uses the gateway's own deviceKey but publishes on gateway topics
  const opts = { ...options, deviceKey: options.deviceKey };
  return createDeviceClient(opts);
}
