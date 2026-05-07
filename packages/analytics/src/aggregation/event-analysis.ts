import { prisma } from '@ssas/database';
import type { EventAnalysisQuery, AggregatedEvent } from '@ssas/core';

/**
 * Execute an event analysis query against TimescaleDB.
 *
 * 对标神策 Event Analysis:
 *   measures[].event_name → eventName
 *   measures[].aggregator → aggregation (general→count, numeric→sum/avg/etc)
 *   by_fields → groupBy
 *   filter.conditions → filters
 *   unit → granularity
 *
 * Routes to the appropriate continuous aggregate view based on granularity.
 */
export async function eventAnalysis(query: EventAnalysisQuery): Promise<{
  data: AggregatedEvent[];
  total: number;
}> {
  const { eventName, aggregation, groupBy, filters, timeRange, granularity } = query;
  const tenantId = (query as EventAnalysisQuery & { tenantId?: string }).tenantId;

  // Determine which continuous aggregate view to use
  const viewName = resolveView(granularity ?? '1h');
  const aggSQL = resolveAggregation(aggregation);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  // Event filter
  conditions.push(`ts.event_name = $${idx++}`);
  params.push(eventName);

  // Time range
  conditions.push(`ts.bucket >= $${idx++}`);
  params.push(timeRange.start);
  conditions.push(`ts.bucket <= $${idx++}`);
  params.push(timeRange.end);

  if (tenantId) {
    conditions.push(`e.tenant_id = $${idx++}::uuid`);
    params.push(tenantId);
  }

  // Entity filter (if provided via filters)
  if (filters) {
    for (const f of filters) {
      if (f.field === 'entityId' && f.operator === 'in') {
        conditions.push(`ts.entity_id = ANY($${idx++}::uuid[])`);
        params.push(f.value);
      }
    }
  }

  const whereClause = conditions.join(' AND ');
  const fromClause = tenantId
    ? `${viewName} ts INNER JOIN public.entities e ON e.id = ts.entity_id`
    : `${viewName} ts`;

  // Build group-by clause
  const groupFields = ['ts.bucket'];
  const selectFields = ['ts.bucket AS bucket', aggSQL];

  if (groupBy && groupBy.length > 0) {
    for (const field of groupBy) {
      if (field === 'entityId' || field === 'entity_id') {
        groupFields.push('ts.entity_id');
        selectFields.push('ts.entity_id AS entity_id');
      }
      if (field === 'eventName' || field === 'event_name') {
        groupFields.push('ts.event_name');
        selectFields.push('ts.event_name AS event_name');
      }
    }
  }

  // Count total matching groups first
  const countSQL = `
    SELECT COUNT(*) FROM (
      SELECT 1 FROM ${fromClause}
      WHERE ${whereClause}
      GROUP BY ${groupFields.join(', ')}
    ) sub
  `;

  const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(countSQL, ...params);
  const total = Number(countResult[0]?.count ?? 0);

  // Query data with limit
  const dataSQL = `
    SELECT ${selectFields.join(',\n       ')}
    FROM ${fromClause}
    WHERE ${whereClause}
    GROUP BY ${groupFields.join(', ')}
    ORDER BY ts.bucket DESC
    LIMIT $${idx++}
    OFFSET $${idx++}
  `;
  params.push(1000, 0);

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(dataSQL, ...params);

  const data: AggregatedEvent[] = rows.map((row) => ({
    time: row.bucket as Date,
    entityId: row.entity_id as string,
    eventName: row.event_name as string,
    avg: row.agg_value as number | undefined,
    count: Number(row.agg_count ?? 0),
    last: row.agg_value as number | undefined,
  }));

  return { data, total };
}

function resolveView(granularity: string): string {
  if (['1m', '5m', '15m', '30m'].includes(granularity)) return 'timescale.event_1min';
  if (['1h', '6h', '12h'].includes(granularity)) return 'timescale.event_1hour';
  if (['1d'].includes(granularity)) return 'timescale.event_1day';
  return 'timescale.event_1hour';
}

function resolveAggregation(aggregation: string): string {
  switch (aggregation) {
    case 'avg':   return `AVG(avg) AS agg_value, COUNT(*) AS agg_count`;
    case 'sum':   return `SUM(sum) AS agg_value, COUNT(*) AS agg_count`;
    case 'max':   return `MAX(max) AS agg_value, COUNT(*) AS agg_count`;
    case 'min':   return `MIN(min) AS agg_value, COUNT(*) AS agg_count`;
    case 'count': return `SUM(count) AS agg_value, COUNT(*) AS agg_count`;
    case 'last':  return `LAST(last, bucket) AS agg_value, COUNT(*) AS agg_count`;
    default:      return `AVG(avg) AS agg_value, COUNT(*) AS agg_count`;
  }
}
