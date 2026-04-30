import { prisma } from '@ssas/database';
import type { DistributionQuery } from '@ssas/core';

export interface DistributionBucket {
  bucketMin: number;
  bucketMax: number;
  label: string;
  count: number;
  devices: number;
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
  metricName: string;
  buckets: DistributionBucket[];
  totalDataPoints: number;
  totalDevices: number;
  statistics: DistributionStatistics;
}

/**
 * Distribution analysis — shows how metric values are distributed across buckets.
 *
 * 对标神策 Distribution Analysis:
 *   按次数/按数值分段统计分布情况
 *   在 SSAS 中: 展示传感器读值的分布 (如温度 0-10°C: 100条, 10-20°C: 500条, ...)
 */
export async function distributionAnalysis(query: DistributionQuery): Promise<DistributionResult> {
  const { metricName, buckets: customBuckets, timeRange } = query;
  const tenantId = (query as DistributionQuery & { tenantId?: string }).tenantId;
  const params: unknown[] = [];
  let idx = 1;

  // Default buckets if not specified (auto-range detection)
  let bucketDef: string;
  if (customBuckets && customBuckets.length > 0) {
    // Use provided bucket boundaries
    const ranges: string[] = [];
    for (let i = 0; i < customBuckets.length - 1; i++) {
      const lo = customBuckets[i];
      const hi = customBuckets[i + 1];
      params.push(lo, hi);
      ranges.push(`(dp.value >= $${idx++} AND dp.value < $${idx++})`);
    }
    // Last bucket catches everything above
    params.push(customBuckets[customBuckets.length - 1]);
    ranges.push(`(dp.value >= $${idx++})`);
    bucketDef = `CASE ${ranges.map((r, i) => `WHEN ${r} THEN ${i}`).join(' ')} END`;
  } else {
    // Auto-detect: use PostgreSQL width_bucket for ~10 buckets
    bucketDef = `width_bucket(dp.value, 0, 100, 10) - 1`;
  }

  // Main parameters for the query
  const mainParams = [...params];
  const bucketIdx = idx;
  mainParams.push(metricName, timeRange.start, timeRange.end);
  if (tenantId) {
    mainParams.push(tenantId);
  }

  const sql = `
    SELECT
      ${bucketDef} AS bucket_idx,
      COUNT(*) AS count,
      COUNT(DISTINCT dp.device_id) AS devices,
      MIN(dp.value) AS min_val,
      MAX(dp.value) AS max_val
    FROM timescale.data_points dp
    ${tenantId ? 'INNER JOIN public.devices d ON d.id = dp.device_id' : ''}
    WHERE dp.metric_name = $${bucketIdx}
      AND dp.time >= $${bucketIdx + 1}
      AND dp.time <= $${bucketIdx + 2}
      ${tenantId ? `AND d.tenant_id = $${bucketIdx + 3}::uuid` : ''}
    GROUP BY bucket_idx
    ORDER BY bucket_idx ASC
  `;

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...mainParams);

  const totalDataPoints = rows.reduce((s, r) => s + Number(r.count), 0);
  const totalDevices = rows.reduce((s, r) => s + Number(r.devices), 0);

  const buckets: DistributionBucket[] = rows.map((row) => {
    const count = Number(row.count);
    return {
      bucketMin: Number(row.min_val),
      bucketMax: Number(row.max_val),
      label: `${Number(row.min_val).toFixed(1)} - ${Number(row.max_val).toFixed(1)}`,
      count,
      devices: Number(row.devices),
      percentage: totalDataPoints > 0 ? Math.round((count / totalDataPoints) * 10000) / 100 : 0,
    };
  });

  // Compute statistics
  const statistics = await computeDistributionStatistics(metricName, timeRange, tenantId);

  return {
    metricName,
    buckets,
    totalDataPoints,
    totalDevices,
    statistics,
  };
}

/**
 * Compute distribution statistics: min, max, mean, median, stddev, percentiles.
 */
async function computeDistributionStatistics(
  metricName: string,
  timeRange: { start: Date; end: Date },
  tenantId?: string,
): Promise<DistributionStatistics> {
  const params: unknown[] = [metricName, timeRange.start, timeRange.end];
  let tenantFilter = '';
  if (tenantId) {
    params.push(tenantId);
    tenantFilter = 'AND d.tenant_id = $4::uuid';
  }

  const sql = `
    SELECT
      MIN(dp.value) AS min_val,
      MAX(dp.value) AS max_val,
      AVG(dp.value) AS mean_val,
      STDDEV(dp.value) AS stddev_val,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY dp.value) AS p25,
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY dp.value) AS median,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY dp.value) AS p75,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY dp.value) AS p95
    FROM timescale.data_points dp
    ${tenantId ? 'INNER JOIN public.devices d ON d.id = dp.device_id' : ''}
    WHERE dp.metric_name = $1
      AND dp.time >= $2
      AND dp.time <= $3
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

/**
 * Batch distribution analysis for multiple metrics.
 */
export async function batchDistributionAnalysis(
  metricNames: string[],
  timeRange: { start: Date; end: Date },
  options?: {
    buckets?: number[];
    tenantId?: string;
  }
): Promise<DistributionResult[]> {
  const results: DistributionResult[] = [];

  for (const metricName of metricNames) {
    const result = await distributionAnalysis({
      metricName,
      timeRange,
      buckets: options?.buckets,
    });
    // Inject tenantId if provided
    if (options?.tenantId) {
      (result as unknown as { tenantId?: string }).tenantId = options.tenantId;
    }
    results.push(result);
  }

  return results;
}
