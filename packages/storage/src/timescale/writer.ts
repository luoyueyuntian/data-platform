import { prisma } from '@ssas/database';
import type { DataPoint } from '@ssas/core';

const COLUMNS = 'time, device_id, metric_name, value, sensor_id, tags, quality';
const COL_COUNT = 7;
const BATCH_SIZE = 500;

/**
 * Batch insert data points into TimescaleDB hypertable.
 * Uses fully parameterized queries to prevent SQL injection.
 * Large batches are split into sub-batches of BATCH_SIZE rows.
 */
export async function writeDataPoints(points: DataPoint[]): Promise<number> {
  if (points.length === 0) return 0;

  let inserted = 0;

  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    inserted += await insertBatch(batch);
  }

  return inserted;
}

/**
 * Insert a single batch using a parameterized multi-row INSERT.
 * Each row gets its own set of $N placeholders — no string interpolation.
 */
async function insertBatch(batch: DataPoint[]): Promise<number> {
  const valueClauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const p of batch) {
    valueClauses.push(
      `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++})`,
    );
    params.push(
      p.time,
      p.deviceId,
      p.metricName,
      p.value,
      p.sensorId ?? null,
      p.tags ? JSON.stringify(p.tags) : null,
      p.quality ?? 100,
    );
  }

  const sql = `
    INSERT INTO timescale.data_points (${COLUMNS})
    VALUES ${valueClauses.join(', ')}
    ON CONFLICT (time, device_id, metric_name) DO NOTHING
  `;

  await prisma.$executeRawUnsafe(sql, ...params);
  return batch.length;
}

/**
 * Bulk insert — alias for writeDataPoints.
 * Retained for backward compatibility.
 */
export async function bulkWriteDataPoints(points: DataPoint[]): Promise<number> {
  return writeDataPoints(points);
}
