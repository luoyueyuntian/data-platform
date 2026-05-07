import { prisma } from '@ssas/database';
import type { RetentionQuery } from '@ssas/core';

export interface RetentionPeriod {
  /** 周期索引 (0 = 初始周期) */
  period: number;
  /** 周期标签 */
  label: string;
  /** 该周期活跃实体数 */
  activeEntities: number;
  /** 留存率 (与初始周期相比) */
  retentionRate: number;
}

export interface RetentionResult {
  periods: RetentionPeriod[];
  totalCohort: number;
  eventName: string;
  periodUnit: string;
}

/**
 * Retention analysis — entity activity retention over time.
 *
 * 对标神策 Retention Analysis:
 *   初始行为 (first_event) → 回访行为 (second_event)
 *   按日/周/月周期计算留存率
 */
export async function retentionAnalysis(query: RetentionQuery): Promise<RetentionResult> {
  const { initialEvent, returnEvent, period, timeRange } = query;
  const tenantId = (query as RetentionQuery & { tenantId?: string }).tenantId;

  // 1. Find entities active in the initial period
  const initialStart = timeRange.start;
  const initialEnd = getPeriodEnd(initialStart, period);

  const initialEntities = await queryActiveEntities(initialEvent, initialStart, initialEnd, tenantId);
  const totalCohort = initialEntities.length;

  if (totalCohort === 0) {
    return { periods: [], totalCohort: 0, eventName: initialEvent, periodUnit: period };
  }

  // Convert to Set for fast lookup
  const initialEntitySet = new Set(initialEntities.map((e) => e.entity_id));

  // 2. For each subsequent period, check how many initial entities returned
  const numPeriods = getNumPeriods(period);
  const periods: RetentionPeriod[] = [];

  // Period 0: initial period itself (always 100%)
  periods.push({
    period: 0,
    label: getPeriodLabel(0, period),
    activeEntities: totalCohort,
    retentionRate: 100,
  });

  for (let i = 1; i <= numPeriods; i++) {
    const pStart = getNextPeriodStart(initialStart, period, i);
    const pEnd = getPeriodEnd(pStart, period);

    // Query return activity
    const returnEntities = await prisma.$queryRawUnsafe<{ entity_id: string }[]>(
      `SELECT DISTINCT ev.entity_id
       FROM timescale.events ev
       ${tenantId ? 'INNER JOIN public.entities e ON e.id = ev.entity_id' : ''}
       WHERE ev.event_name = $1
         AND ev.time >= $2
         AND ev.time < $3
         AND ev.entity_id = ANY($4::uuid[])
         ${tenantId ? 'AND e.tenant_id = $5::uuid' : ''}`,
      ...(
        tenantId
          ? [returnEvent, pStart, pEnd, [...initialEntitySet], tenantId]
          : [returnEvent, pStart, pEnd, [...initialEntitySet]]
      )
    );

    const returnedCount = returnEntities.length;
    const retentionRate = totalCohort > 0
      ? Math.round((returnedCount / totalCohort) * 10000) / 100
      : 0;

    periods.push({
      period: i,
      label: getPeriodLabel(i, period),
      activeEntities: returnedCount,
      retentionRate,
    });
  }

  return {
    periods,
    totalCohort,
    eventName: initialEvent,
    periodUnit: period,
  };
}

/**
 * Query entities that reported a specific event within a time window.
 */
async function queryActiveEntities(
  eventName: string,
  start: Date,
  end: Date,
  tenantId?: string,
): Promise<{ entity_id: string }[]> {
  return prisma.$queryRawUnsafe<{ entity_id: string }[]>(
    `SELECT DISTINCT ev.entity_id
     FROM timescale.events ev
     ${tenantId ? 'INNER JOIN public.entities e ON e.id = ev.entity_id' : ''}
     WHERE ev.event_name = $1
       AND ev.time >= $2
       AND ev.time < $3
       ${tenantId ? 'AND e.tenant_id = $4::uuid' : ''}`,
    ...(tenantId ? [eventName, start, end, tenantId] : [eventName, start, end])
  );
}

function getPeriodEnd(start: Date, period: string): Date {
  const end = new Date(start);
  switch (period) {
    case 'day':   end.setDate(end.getDate() + 1); break;
    case 'week':  end.setDate(end.getDate() + 7); break;
    case 'month': end.setMonth(end.getMonth() + 1); break;
    default:      end.setDate(end.getDate() + 1); break;
  }
  return end;
}

function getNextPeriodStart(base: Date, period: string, n: number): Date {
  const start = new Date(base);
  switch (period) {
    case 'day':   start.setDate(start.getDate() + n); break;
    case 'week':  start.setDate(start.getDate() + n * 7); break;
    case 'month': start.setMonth(start.getMonth() + n); break;
    default:      start.setDate(start.getDate() + n); break;
  }
  return start;
}

function getNumPeriods(period: string): number {
  switch (period) {
    case 'day':   return 30;
    case 'week':  return 12;
    case 'month': return 12;
    default:      return 7;
  }
}

function getPeriodLabel(n: number, period: string): string {
  if (n === 0) return '初始';
  switch (period) {
    case 'day':   return `第 ${n} 天`;
    case 'week':  return `第 ${n} 周`;
    case 'month': return `第 ${n} 月`;
    default:      return `${n}`;
  }
}
