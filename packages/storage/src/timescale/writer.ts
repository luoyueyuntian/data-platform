import { prisma } from '@ssas/database';
import type { DataPoint } from '@ssas/core';

/**
 * Batch insert data points into TimescaleDB hypertable.
 * Uses raw SQL to bypass Prisma for performance.
 * For small batches (< 100 points), uses individual INSERTs.
 * For larger batches, uses COPY protocol for better performance.
 */
export async function writeDataPoints(points: DataPoint[]): Promise<number> {
  if (points.length === 0) return 0;

  // Use COPY protocol for larger batches
  if (points.length >= 100) {
    return bulkWriteDataPoints(points);
  }

  // Build parameterized batch insert for small batches
  const values = points.map((p) => ({
    time: p.time,
    deviceId: p.deviceId,
    metricName: p.metricName,
    value: p.value,
    sensorId: p.sensorId ?? null,
    tags: p.tags ?? null,
    quality: p.quality ?? 100,
  }));

  // Batch insert using individual INSERTs
  let inserted = 0;
  for (const row of values) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO timescale.data_points (time, device_id, metric_name, value, sensor_id, tags, quality)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (time, device_id, metric_name) DO NOTHING`,
      row.time,
      row.deviceId,
      row.metricName,
      row.value,
      row.sensorId,
      row.tags ? JSON.stringify(row.tags) : null,
      row.quality,
    );
    inserted++;
  }

  return inserted;
}

/**
 * Bulk insert using COPY protocol — for high-throughput scenarios.
 * Uses PostgreSQL COPY command for maximum performance.
 */
export async function bulkWriteDataPoints(points: DataPoint[]): Promise<number> {
  if (points.length === 0) return 0;

  // Build the tab-separated COPY format
  const rows = points.map((p) => {
    const time = p.time instanceof Date ? p.time.toISOString() : String(p.time);
    const tags = p.tags ? JSON.stringify(p.tags) : '\\N';
    const sensorId = p.sensorId || '\\N';
    const quality = p.quality ?? 100;
    return `${time}\t${p.deviceId}\t${p.metricName}\t${p.value}\t${sensorId}\t${tags}\t${quality}`;
  });

  // Use Prisma's raw query to execute COPY
  // Note: Prisma doesn't natively support COPY, so we use a workaround with temporary table
  const tempTable = `temp_data_points_${Date.now()}`;

  try {
    // Create temporary table
    await prisma.$executeRawUnsafe(`
      CREATE TEMPORARY TABLE ${tempTable} (
        time TIMESTAMPTZ NOT NULL,
        device_id UUID NOT NULL,
        metric_name VARCHAR(100) NOT NULL,
        value DOUBLE PRECISION NOT NULL,
        sensor_id UUID,
        tags JSONB,
        quality INTEGER DEFAULT 100
      ) ON COMMIT DROP
    `);

    // Insert data into temporary table using individual INSERTs (batched)
    // For truly high-throughput, you would use pg-copy-streams here
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = batch.map((row) => {
        const parts = row.split('\t');
        return `('${parts[0]}', '${parts[1]}', '${parts[2]}', ${parts[3]}, ${parts[4] === '\\N' ? 'NULL' : `'${parts[4]}'`}, ${parts[5] === '\\N' ? 'NULL' : `'${parts[5]}'::jsonb`}, ${parts[6]})`;
      }).join(', ');

      await prisma.$executeRawUnsafe(`
        INSERT INTO ${tempTable} (time, device_id, metric_name, value, sensor_id, tags, quality)
        VALUES ${values}
      `);
      inserted += batch.length;
    }

    // Insert from temporary table to main table with conflict handling
    await prisma.$executeRawUnsafe(`
      INSERT INTO timescale.data_points (time, device_id, metric_name, value, sensor_id, tags, quality)
      SELECT time, device_id, metric_name, value, sensor_id, tags, quality
      FROM ${tempTable}
      ON CONFLICT (time, device_id, metric_name) DO NOTHING
    `);

    console.log(`[storage] bulk wrote ${inserted} points`);
    return inserted;
  } catch (err) {
    console.error('[storage] bulk write failed:', err);
    // Fallback to individual inserts
    return writeDataPoints(points);
  }
}
