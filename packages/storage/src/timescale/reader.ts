import { prisma } from '@ssas/database';
import type { TimeSeriesQuery, AggregatedDataPoint } from '@ssas/core';
import { getCache, setCache, buildCacheKey } from '../query/cache.js';

/**
 * Query time-series data with aggregation from TimescaleDB.
 * Routes to continuous aggregate views when appropriate for performance.
 * Results are cached in Redis when available (60 s TTL).
 *
 * Note: Continuous aggregate views do NOT contain a `tags` column.
 * When tags filtering is requested, we fall back to the raw hypertable.
 */
export async function queryDataPoints(query: TimeSeriesQuery): Promise<AggregatedDataPoint[]> {
  // Cache lookup (skip when tags filter is present — too many permutations)
  const hasTagsFilter = query.filters && Object.keys(query.filters).length > 0;
  if (!hasTagsFilter) {
    const cacheKey = buildCacheKey('ts', query as unknown as Record<string, unknown>);
    const cached = await getCache<AggregatedDataPoint[]>(cacheKey);
    if (cached) return cached;
  }

  const result = await queryDataPointsRaw(query);

  // Store in cache (60 s TTL, only for non-tags queries)
  if (!hasTagsFilter) {
    const cacheKey = buildCacheKey('ts', query as unknown as Record<string, unknown>);
    await setCache(cacheKey, result, 60);
  }

  return result;
}

async function queryDataPointsRaw(query: TimeSeriesQuery): Promise<AggregatedDataPoint[]> {
  const { deviceIds, metricNames, startTime, endTime, granularity, aggregation, filters, limit, offset } = query;

  const hasTagsFilter = filters && Object.keys(filters).length > 0;
  const aggFn = getAggregateSQL(aggregation || 'avg');

  // Continuous aggregate views don't have a tags column, so fall back to
  // the raw hypertable when tags filtering is requested.
  let sourceTable: string;
  let timeColumn: string;
  if (hasTagsFilter) {
    sourceTable = 'timescale.data_points';
    timeColumn = 'time';
  } else {
    sourceTable = getAggregateView(granularity || '1h');
    timeColumn = 'bucket';
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Device filter
  conditions.push(`device_id = ANY($${paramIndex++})`);
  params.push(deviceIds);

  // Time range
  conditions.push(`${timeColumn} >= $${paramIndex++}`);
  params.push(startTime);
  conditions.push(`${timeColumn} <= $${paramIndex++}`);
  params.push(endTime);

  // Metric filter
  if (metricNames && metricNames.length > 0) {
    conditions.push(`metric_name = ANY($${paramIndex++})`);
    params.push(metricNames);
  }

  // Tags filter (JSONB) — only on raw table
  if (hasTagsFilter) {
    for (const [key, value] of Object.entries(filters!)) {
      conditions.push(`tags @> $${paramIndex++}`);
      params.push(JSON.stringify({ [key]: value }));
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      ${timeColumn} AS bucket,
      device_id,
      metric_name,
      ${aggFn}
    FROM ${sourceTable}
    ${whereClause}
    GROUP BY ${timeColumn}, device_id, metric_name
    ORDER BY ${timeColumn} DESC
    LIMIT $${paramIndex++}
    OFFSET $${paramIndex++}
  `;
  params.push(limit ?? 1000, offset ?? 0);

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...params);

  return rows.map((row) => ({
    time: row.bucket as Date,
    deviceId: row.device_id as string,
    metricName: row.metric_name as string,
    avg: row.avg_value as number | undefined,
    sum: row.sum_value as number | undefined,
    min: row.min_value as number | undefined,
    max: row.max_value as number | undefined,
    count: Number(row.count_value) || 0,
    last: row.last_value as number | undefined,
  }));
}

/**
 * Get latest value for each metric of a device
 */
export async function getLatestDataPoints(deviceId: string, metricName?: string): Promise<AggregatedDataPoint[]> {
  const conditions: string[] = ['device_id = $1'];
  const params: unknown[] = [deviceId];
  let paramIndex = 2;

  if (metricName) {
    conditions.push(`metric_name = $${paramIndex++}`);
    params.push(metricName);
  }

  const sql = `
    SELECT DISTINCT ON (metric_name)
      time AS bucket,
      device_id,
      metric_name,
      value AS last_value
    FROM timescale.data_points
    WHERE ${conditions.join(' AND ')}
    ORDER BY metric_name, time DESC
  `;

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...params);

  return rows.map((row) => ({
    time: row.bucket as Date,
    deviceId: row.device_id as string,
    metricName: row.metric_name as string,
    last: row.last_value as number,
    count: 1,
  }));
}

/**
 * Route query to the appropriate continuous aggregate view based on granularity
 */
function getAggregateView(granularity: string): string {
  switch (granularity) {
    case '1m':
    case '5m':
    case '15m':
    case '30m':
      return 'timescale.metric_1min';
    case '1h':
    case '6h':
    case '12h':
      return 'timescale.metric_1hour';
    case '1d':
      return 'timescale.metric_1day';
    default:
      return 'timescale.metric_1hour';
  }
}

/**
 * Build aggregate SQL based on aggregation function
 */
function getAggregateSQL(aggregation: string): string {
  const selects: string[] = [];

  switch (aggregation) {
    case 'avg':
      selects.push('AVG(avg) AS avg_value');
      break;
    case 'sum':
      selects.push('SUM(sum) AS sum_value');
      break;
    case 'max':
      selects.push('MAX(max) AS max_value');
      break;
    case 'min':
      selects.push('MIN(min) AS min_value');
      break;
    case 'count':
      selects.push('SUM(count) AS count_value');
      break;
    case 'last':
      selects.push('LAST(last, bucket) AS last_value');
      break;
    default:
      selects.push('AVG(avg) AS avg_value');
  }

  return selects.join(',\n      ');
}
