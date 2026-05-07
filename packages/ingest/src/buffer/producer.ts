import { Kafka, type Producer } from 'kafkajs';
import type { Event } from '@ssas/core';

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
 * Send a single Event to Kafka
 */
export async function sendEvent(event: Event): Promise<void> {
  if (!producer) {
    await initProducer();
  }

  await producer!.send({
    topic: TOPIC_RAW_EVENTS,
    messages: [
      {
        key: event.entityId,
        value: JSON.stringify(event),
      },
    ],
  });
}

/**
 * Send multiple Events as a batch
 */
export async function sendBatchEvents(events: Event[]): Promise<void> {
  if (!producer) {
    await initProducer();
  }

  const messages = events.map((e) => ({
    key: e.entityId,
    value: JSON.stringify(e),
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

// Backward compatibility aliases
export const sendDataPoint = sendEvent;
export const sendBatchDataPoints = sendBatchEvents;
