import { prisma } from '@ssas/database';
import type { Event } from '@ssas/core';

const COLUMNS = 'time, entity_id, event_name, value, properties, tags, quality';
const COL_COUNT = 7;
const BATCH_SIZE = 500;

/**
 * Batch insert events into TimescaleDB hypertable.
 * Uses fully parameterized queries to prevent SQL injection.
 * Large batches are split into sub-batches of BATCH_SIZE rows.
 */
export async function writeEvents(events: Event[]): Promise<number> {
  if (events.length === 0) return 0;

  let inserted = 0;

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    inserted += await insertBatch(batch);
  }

  return inserted;
}

/**
 * Insert a single batch using a parameterized multi-row INSERT.
 * Each row gets its own set of $N placeholders — no string interpolation.
 */
async function insertBatch(batch: Event[]): Promise<number> {
  const valueClauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const e of batch) {
    valueClauses.push(
      `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++}::jsonb, $${idx++})`,
    );
    params.push(
      e.time,
      e.entityId,
      e.eventName,
      e.value ?? null,
      e.properties ? JSON.stringify(e.properties) : null,
      e.tags ? JSON.stringify(e.tags) : null,
      e.quality ?? 100,
    );
  }

  const sql = `
    INSERT INTO timescale.events (${COLUMNS})
    VALUES ${valueClauses.join(', ')}
    ON CONFLICT (time, entity_id, event_name) DO NOTHING
  `;

  await prisma.$executeRawUnsafe(sql, ...params);
  return batch.length;
}

/**
 * Bulk insert — alias for writeEvents.
 * Retained for backward compatibility.
 */
export async function bulkWriteEvents(events: Event[]): Promise<number> {
  return writeEvents(events);
}
