import mqtt, { type MqttClient, type IClientOptions } from 'mqtt';
import { handleIncomingMessage } from './router.js';

let client: MqttClient | null = null;

export interface MqttConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId?: string;
  /** Path to TLS cert if using mqtts:// */
  cert?: string;
  key?: string;
  ca?: string;
  /** Whether to use TLS */
  tls?: boolean;
}

const DEFAULT_TOPICS = [
  'ssas/v1/+/telemetry',
  'ssas/v1/+/telemetry/batch',
  'ssas/v1/+/status',
  'ssas/v1/gateway/+/telemetry',
];

/**
 * Start the MQTT ingest client.
 * Connects to the broker and subscribes to data topics.
 */
export async function startMqttIngest(config?: MqttConfig): Promise<MqttClient> {
  const brokerUrl = config?.brokerUrl || process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

  const opts: IClientOptions = {
    clientId: config?.clientId || `ssas-ingest-${Math.random().toString(36).slice(2, 8)}`,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 5000,
  };

  // Authentication
  if (config?.username || process.env.MQTT_USERNAME) {
    opts.username = config?.username || process.env.MQTT_USERNAME;
    opts.password = config?.password || process.env.MQTT_PASSWORD;
  }

  // TLS
  if (config?.tls || brokerUrl.startsWith('mqtts://')) {
    opts.protocol = 'mqtts';
    if (config?.ca) opts.ca = config.ca;
    if (config?.cert) opts.cert = config.cert;
    if (config?.key) opts.key = config.key;
    opts.rejectUnauthorized = true;
  }

  return new Promise((resolve, reject) => {
    client = mqtt.connect(brokerUrl, opts);

    client.on('connect', () => {
      console.log('[mqtt] connected to', brokerUrl);

      // Subscribe to data topics
      for (const topic of DEFAULT_TOPICS) {
        client?.subscribe(topic, { qos: 1 }, (err) => {
          if (err) {
            console.error(`[mqtt] failed to subscribe to ${topic}:`, err);
          } else {
            console.log(`[mqtt] subscribed to ${topic}`);
          }
        });
      }

      resolve(client!);
    });

    client.on('message', (topic, payload) => {
      handleIncomingMessage(topic, payload.toString()).catch((err) => {
        console.error(`[mqtt] error handling message on ${topic}:`, err);
      });
    });

    client.on('error', (err) => {
      console.error('[mqtt] error:', err);
      reject(err);
    });

    client.on('close', () => {
      console.log('[mqtt] connection closed');
    });

    client.on('reconnect', () => {
      console.log('[mqtt] reconnecting...');
    });

    client.on('offline', () => {
      console.warn('[mqtt] client went offline');
    });
  });
}

/**
 * Stop the MQTT ingest client gracefully.
 */
export async function stopMqttIngest(): Promise<void> {
  if (client) {
    client.end(true);
    client = null;
    console.log('[mqtt] ingest stopped');
  }
}

/**
 * Get the current MQTT client instance.
 */
export function getMqttClient(): MqttClient | null {
  return client;
}
