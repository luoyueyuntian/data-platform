import { Kafka, type EachMessagePayload, type Consumer } from 'kafkajs';
import { writeDataPoints } from '@ssas/storage';
import type { DataPoint } from '@ssas/core';

const TOPIC_RAW_EVENTS = 'ssas.raw.events';
const TOPIC_DEAD_LETTER = 'ssas.raw.events.dlq';

let consumer: Consumer | null = null;

async function main() {
  const broker = process.env.KAFKA_BROKER || 'localhost:9092';
  const concurrency = Number(process.env.WORKER_CONCURRENCY) || 5;

  const kafka = new Kafka({
    clientId: 'ssas-worker',
    brokers: [broker],
  });

  consumer = kafka.consumer({ groupId: 'ssas-ingest-group' });
  await consumer.connect();
  console.log('[worker] consumer connected to', broker);

  await consumer.subscribe({ topic: TOPIC_RAW_EVENTS, fromBeginning: false });
  console.log('[worker] subscribed to', TOPIC_RAW_EVENTS);

  await consumer.run({
    partitionsConsumedConcurrently: concurrency,
    eachMessage: async (payload: EachMessagePayload) => {
      const { message, topic, partition } = payload;

      try {
        const raw = message.value?.toString();
        if (!raw) return;

        const dataPoint: DataPoint = JSON.parse(raw);

        // Validate required fields
        if (!dataPoint.deviceId || !dataPoint.metricName || dataPoint.value === undefined) {
          throw new Error('Invalid data point: missing required fields');
        }

        // Write to TimescaleDB
        await writeDataPoints([dataPoint]);

        console.log(`[worker] ingested: ${dataPoint.deviceId}/${dataPoint.metricName} = ${dataPoint.value}`);
      } catch (err) {
        console.error(`[worker] error processing message from ${topic}[${partition}]:`, err);

        // Send to dead letter queue
        await sendToDLQ(kafka, message.value?.toString() || '', err);
      }
    },
  });

  console.log('[worker] started, waiting for messages...');
}

/**
 * Send failed messages to dead letter queue
 */
async function sendToDLQ(kafka: Kafka, rawMessage: string, error: unknown): Promise<void> {
  try {
    const dlqProducer = kafka.producer();
    await dlqProducer.connect();
    await dlqProducer.send({
      topic: TOPIC_DEAD_LETTER,
      messages: [{
        value: JSON.stringify({
          originalMessage: rawMessage,
          error: String(error),
          timestamp: new Date().toISOString(),
        }),
      }],
    });
    await dlqProducer.disconnect();
  } catch (dlqErr) {
    console.error('[worker] failed to send to DLQ:', dlqErr);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    console.log('[worker] consumer disconnected');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error('[worker] fatal error:', err);
  process.exit(1);
});
