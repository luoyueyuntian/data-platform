import { prisma } from '@ssas/database';
import type { DistributionQuery } from '@ssas/core';

export interface DistributionBucket {
  bucketMin: number;
  bucketMax: number;
  label: string;
  count: number;
  entities: number;
  percentage: number;
}

export interface DistributionStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  stddev: number;
  p25: number;
  p75: number;
  p95: number;
}

export interface DistributionResult {
  eventName: string;
  buckets: DistributionBucket[];
  totalEvents: number;
  totalEntities: number;
  statistics: DistributionStatistics;
}

/**
 * Distribution analysis — shows how event values are distributed across buckets.
 */
export async function distributionAnalysis(query: DistributionQuery): Promise<DistributionResult> {
  const { eventName, buckets: customBuckets, timeRange } = query;
  const tenantId = (query as DistributionQuery & { tenantId?: string }).tenantId;
  const params: unknown[] = [];
  let idx = 1;

  let bucketDef: string;
  if (customBuckets && customBuckets.length > 0) {
    const ranges: string[] = [];
    for (let i = 0; i < customBuckets.length - 1; i++) {
      const lo = customBuckets[i];
      const hi = customBuckets[i + 1];
      params.push(lo, hi);
      ranges.push(`(ev.value >= $${idx++} AND ev.value < $${idx++})`);
    }
    params.push(customBuckets[customBuckets.length - 1]);
    ranges.push(`(ev.value >= $${idx++})`);
    bucketDef = `CASE ${ranges.map((r, i) => `WHEN ${r} THEN ${i}`).join(' ')} END`;
  } else {
    bucketDef = `width_bucket(ev.value, 0, 100, 10) - 1`;
  }

  const mainParams = [...params];
  const bucketIdx = idx;
  mainParams.push(eventName, timeRange.start, timeRange.end);
  if (tenantId) {
    mainParams.push(tenantId);
  }

  const sql = `
    SELECT
      ${bucketDef} AS bucket_idx,
      COUNT(*) AS count,
      COUNT(DISTINCT ev.entity_id) AS entities,
      MIN(ev.value) AS min_val,
      MAX(ev.value) AS max_val
    FROM timescale.events ev
    ${tenantId ? 'INNER JOIN public.entities e ON e.id = ev.entity_id' : ''}
    WHERE ev.event_name = $${bucketIdx}
      AND ev.time >= $${bucketIdx + 1}
      AND ev.time <= $${bucketIdx + 2}
      ${tenantId ? `AND e.tenant_id = $${bucketIdx + 3}::uuid` : ''}
    GROUP BY bucket_idx
    ORDER BY bucket_idx ASC
  `;

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...mainParams);

  const totalEvents = rows.reduce((s, r) => s + Number(r.count), 0);
  const totalEntities = rows.reduce((s, r) => s + Number(r.entities), 0);

  const buckets: DistributionBucket[] = rows.map((row) => {
    const count = Number(row.count);
    return {
      bucketMin: Number(row.min_val),
      bucketMax: Number(row.max_val),
      label: `${Number(row.min_val).toFixed(1)} - ${Number(row.max_val).toFixed(1)}`,
      count,
      entities: Number(row.entities),
      percentage: totalEvents > 0 ? Math.round((count / totalEvents) * 10000) / 100 : 0,
    };
  });

  const statistics = await computeDistributionStatistics(eventName, timeRange, tenantId);

  return {
    eventName,
    buckets,
    totalEvents,
    totalEntities,
    statistics,
  };
}

async function computeDistributionStatistics(
  eventName: string,
  timeRange: { start: Date; end: Date },
  tenantId?: string,
): Promise<DistributionStatistics> {
  const params: unknown[] = [eventName, timeRange.start, timeRange.end];
  let tenantFilter = '';
  if (tenantId) {
    params.push(tenantId);
    tenantFilter = 'AND e.tenant_id = $4::uuid';
  }

  const sql = `
    SELECT
      MIN(ev.value) AS min_val,
      MAX(ev.value) AS max_val,
      AVG(ev.value) AS mean_val,
      STDDEV(ev.value) AS stddev_val,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ev.value) AS p25,
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ev.value) AS median,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ev.value) AS p75,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ev.value) AS p95
    FROM timescale.events ev
    ${tenantId ? 'INNER JOIN public.entities e ON e.id = ev.entity_id' : ''}
    WHERE ev.event_name = $1
      AND ev.time >= $2
      AND ev.time <= $3
      ${tenantFilter}
  `;

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...params);
  const row = rows[0];

  if (!row || row.min_val === null) {
    return { min: 0, max: 0, mean: 0, median: 0, stddev: 0, p25: 0, p75: 0, p95: 0 };
  }

  return {
    min: Math.round(Number(row.min_val) * 100) / 100,
    max: Math.round(Number(row.max_val) * 100) / 100,
    mean: Math.round(Number(row.mean_val) * 100) / 100,
    median: Math.round(Number(row.median) * 100) / 100,
    stddev: Math.round(Number(row.stddev_val) * 100) / 100,
    p25: Math.round(Number(row.p25) * 100) / 100,
    p75: Math.round(Number(row.p75) * 100) / 100,
    p95: Math.round(Number(row.p95) * 100) / 100,
  };
}

export async function batchDistributionAnalysis(
  eventNames: string[],
  timeRange: { start: Date; end: Date },
  options?: {
    buckets?: number[];
    tenantId?: string;
  }
): Promise<DistributionResult[]> {
  const results: DistributionResult[] = [];

  for (const eventName of eventNames) {
    const result = await distributionAnalysis({
      eventName,
      timeRange,
      buckets: options?.buckets,
    });
    if (options?.tenantId) {
      (result as unknown as { tenantId?: string }).tenantId = options.tenantId;
    }
    results.push(result);
  }

  return results;
}
