import { prisma } from '@ssas/database';
import type { TrendQuery, AggregatedEvent } from '@ssas/core';

export interface TrendResult {
  current: AggregatedEvent[];
  previous: AggregatedEvent[];
  changePercent: number;
}

/**
 * Trend analysis — compares current period with previous period.
 */
export async function trendAnalysis(query: TrendQuery): Promise<TrendResult> {
  const { eventName, aggregation, timeRange, granularity, compareWith } = query;
  const tenantId = (query as TrendQuery & { tenantId?: string }).tenantId;

  const viewName = resolveView(granularity);
  const aggSQL = resolveAggregation(aggregation);

  const rangeMs = timeRange.end.getTime() - timeRange.start.getTime();

  const prevStart = new Date(timeRange.start.getTime() - rangeMs);
  const prevEnd = new Date(timeRange.start);

  const params: unknown[] = [];
  let idx = 1;

  const sql = `
    SELECT
      CASE
        WHEN ts.bucket >= $${idx} AND ts.bucket <= $${idx+1} THEN 'current'
        ELSE 'previous'
      END AS period,
      ts.bucket AS bucket,
      ts.entity_id AS entity_id,
      ts.event_name AS event_name,
      ${aggSQL}
    FROM ${viewName} ts
    ${tenantId ? 'INNER JOIN public.entities e ON e.id = ts.entity_id' : ''}
    WHERE ts.event_name = $${idx+2}
      AND (
        (ts.bucket >= $${idx} AND ts.bucket <= $${idx+1})
        OR
        (ts.bucket >= $${idx+3} AND ts.bucket <= $${idx+4})
      )
      ${tenantId ? `AND e.tenant_id = $${idx+5}::uuid` : ''}
    GROUP BY period, bucket, entity_id, event_name
    ORDER BY bucket ASC
  `;
  params.push(timeRange.start, timeRange.end, eventName, prevStart, prevEnd);
  if (tenantId) {
    params.push(tenantId);
  }

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...params);

  const current: AggregatedEvent[] = [];
  const previous: AggregatedEvent[] = [];

  for (const row of rows) {
    const ev: AggregatedEvent = {
      time: row.bucket as Date,
      entityId: row.entity_id as string,
      eventName: row.event_name as string,
      avg: row.agg_value as number,
      count: Number(row.agg_count ?? 0),
    };

    if (row.period === 'current') {
      current.push(ev);
    } else {
      previous.push(ev);
    }
  }

  const currentAvg = averageOf(current);
  const prevAvg = averageOf(previous);
  const changePercent = prevAvg !== 0 ? ((currentAvg - prevAvg) / Math.abs(prevAvg)) * 100 : 0;

  return { current, previous, changePercent };
}

function averageOf(data: AggregatedEvent[]): number {
  if (data.length === 0) return 0;
  const total = data.reduce((sum, d) => sum + (d.avg ?? d.last ?? 0), 0);
  return total / data.length;
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
    default:      return `AVG(avg) AS agg_value, COUNT(*) AS agg_count`;
  }
}
