import { Kafka, type Producer } from 'kafkajs';
import type { DataPoint } from '@ssas/core';

const TOPIC_RAW_EVENTS = 'ssas.raw.events';

let producer: Producer | null = null;

/**
 * Initialize Kafka producer singleton
 */
export async function initProducer(broker: string = process.env.KAFKA_BROKER || 'localhost:9092'): Promise<Producer> {
  if (producer) return producer;

  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'ssas-platform',
    brokers: [broker],
  });

  producer = kafka.producer();
  await producer.connect();
  console.log('[kafka] producer connected to', broker);

  return producer;
}

/**
 * Send a single DataPoint to Kafka
 */
export async function sendDataPoint(data: DataPoint): Promise<void> {
  if (!producer) {
    await initProducer();
  }

  await producer!.send({
    topic: TOPIC_RAW_EVENTS,
    messages: [
      {
        key: data.deviceId,
        value: JSON.stringify(data),
      },
    ],
  });
}

/**
 * Send multiple DataPoints as a batch
 */
export async function sendBatchDataPoints(dataPoints: DataPoint[]): Promise<void> {
  if (!producer) {
    await initProducer();
  }

  const messages = dataPoints.map((dp) => ({
    key: dp.deviceId,
    value: JSON.stringify(dp),
  }));

  await producer!.send({
    topic: TOPIC_RAW_EVENTS,
    messages,
  });
}

/**
 * Disconnect Kafka producer (call on shutdown)
 */
export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    console.log('[kafka] producer disconnected');
  }
}
