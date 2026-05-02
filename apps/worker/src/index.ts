import { Kafka, type EachMessagePayload, type Consumer, type Producer } from 'kafkajs';
import { disconnectCache, initCache, writeDataPoints } from '@ssas/storage';
import { startAlertScheduler, stopAlertScheduler } from '@ssas/alerting';
import { startMqttIngest, stopMqttIngest } from '@ssas/ingest';
import { runLifecycleEvaluation } from './jobs/lifecycle-eval.js';
import { runSegmentCalculation } from './jobs/segment-calc.js';
import type { DataPoint } from '@ssas/core';
import { prisma } from '@ssas/database';

const TOPIC_RAW_EVENTS = 'ssas.raw.events';
const TOPIC_DEAD_LETTER = 'ssas.raw.events.dlq';

// Shared Kafka producer for DLQ (reused across the worker lifetime)
let dlqProducer: Producer | null = null;
let consumer: Consumer | null = null;

async function main() {
  const broker = process.env.KAFKA_BROKER || 'localhost:9092';
  const concurrency = Number(process.env.WORKER_CONCURRENCY) || 5;

  await initCache();

  const kafka = new Kafka({
    clientId: 'ssas-worker',
    brokers: [broker],
  });

  // Create a shared DLQ producer
  dlqProducer = kafka.producer();
  await dlqProducer.connect();
  console.log('[worker] DLQ producer connected');

  // --- Kafka Consumer ---
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

        if (!dataPoint.deviceId || !dataPoint.metricName || dataPoint.value === undefined) {
          throw new Error('Invalid data point: missing required fields');
        }

        await writeDataPoints([dataPoint]);
        console.log(`[worker] ingested: ${dataPoint.deviceId}/${dataPoint.metricName} = ${dataPoint.value}`);
      } catch (err) {
        console.error(`[worker] error processing message from ${topic}[${partition}]:`, err);
        await sendToDLQ(message.value?.toString() || '', err);
      }
    },
  });
  console.log('[worker] Kafka consumer started');

  // --- Alert Scheduler ---
  const alertInterval = Number(process.env.ALERT_EVAL_INTERVAL_MS) || 60_000;
  startAlertScheduler(alertInterval);
  console.log(`[worker] alert scheduler started (interval=${alertInterval}ms)`);

  // --- MQTT Ingest ---
  try {
    await startMqttIngest();
    console.log('[worker] MQTT ingest started');
  } catch (err) {
    console.warn('[worker] MQTT ingest failed to start (will continue without MQTT):', err);
  }

  // --- Periodic Lifecycle & Segment Jobs ---
  const jobInterval = Number(process.env.JOB_INTERVAL_MS) || 300_000; // 5 min default
  const jobTimer = setInterval(async () => {
    try {
      const tenants = await prisma.tenant.findMany({ select: { id: true } });
      for (const tenant of tenants) {
        try {
          await runLifecycleEvaluation(tenant.id);
        } catch (err) {
          console.error(`[worker] lifecycle eval failed for tenant ${tenant.id}:`, err);
        }
        try {
          await runSegmentCalculation(tenant.id);
        } catch (err) {
          console.error(`[worker] segment calc failed for tenant ${tenant.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[worker] periodic job error:', err);
    }
  }, jobInterval);
  console.log(`[worker] periodic jobs scheduled (interval=${jobInterval}ms)`);

  console.log('[worker] all subsystems started, waiting for messages...');

  // Store timer for cleanup
  (globalThis as Record<string, unknown>).__jobTimer = jobTimer;
}

/**
 * Send failed messages to dead letter queue using the shared producer.
 */
async function sendToDLQ(rawMessage: string, error: unknown): Promise<void> {
  if (!dlqProducer) {
    console.error('[worker] DLQ producer not available');
    return;
  }
  try {
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
  } catch (dlqErr) {
    console.error('[worker] failed to send to DLQ:', dlqErr);
  }
}

/**
 * Graceful shutdown — disconnect all subsystems in order.
 */
async function shutdown(): Promise<void> {
  console.log('[worker] shutting down...');

  stopAlertScheduler();
  await stopMqttIngest();

  const jobTimer = (globalThis as Record<string, unknown>).__jobTimer as ReturnType<typeof setInterval> | undefined;
  if (jobTimer) clearInterval(jobTimer);

  if (consumer) {
    await consumer.disconnect();
    console.log('[worker] Kafka consumer disconnected');
  }
  if (dlqProducer) {
    await dlqProducer.disconnect();
    console.log('[worker] DLQ producer disconnected');
  }

  await disconnectCache();
  await prisma.$disconnect();
  console.log('[worker] database disconnected');

  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error('[worker] fatal error:', err);
  process.exit(1);
});
