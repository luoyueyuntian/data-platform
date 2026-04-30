import { prisma } from '@ssas/database';
import type { RetentionQuery } from '@ssas/core';

export interface RetentionPeriod {
  /** 周期索引 (0 = 初始周期) */
  period: number;
  /** 周期标签 */
  label: string;
  /** 该周期活跃设备数 */
  activeDevices: number;
  /** 留存率 (与初始周期相比) */
  retentionRate: number;
}

export interface RetentionResult {
  periods: RetentionPeriod[];
  totalCohort: number;
  metricName: string;
  periodUnit: string;
}

/**
 * Retention analysis — device activity retention over time.
 *
 * 对标神策 Retention Analysis:
 *   初始行为 (first_event) → 回访行为 (second_event)
 *   按日/周/月周期计算留存率
 *
 * SSAS 适配: 设备活跃度留存。
 *   初始: 设备在某个时间窗口内上报过数据
 *   留存: 设备在后续 N 个周期内是否继续上报数据
 */
export async function retentionAnalysis(query: RetentionQuery): Promise<RetentionResult> {
  const { initialMetric, returnMetric, period, timeRange } = query;
  const tenantId = (query as RetentionQuery & { tenantId?: string }).tenantId;

  // 1. Find devices active in the initial period (first week/month)
  const initialStart = timeRange.start;
  const initialEnd = getPeriodEnd(initialStart, period);

  const initialDevices = await queryActiveDevices(initialMetric, initialStart, initialEnd, tenantId);
  const totalCohort = initialDevices.length;

  if (totalCohort === 0) {
    return { periods: [], totalCohort: 0, metricName: initialMetric, periodUnit: period };
  }

  // Convert to Set for fast lookup
  const initialDeviceSet = new Set(initialDevices.map((d) => d.device_id));

  // 2. For each subsequent period, check how many initial devices returned
  const numPeriods = getNumPeriods(period);
  const periods: RetentionPeriod[] = [];

  // Period 0: initial period itself (always 100%)
  periods.push({
    period: 0,
    label: getPeriodLabel(0, period),
    activeDevices: totalCohort,
    retentionRate: 100,
  });

  for (let i = 1; i <= numPeriods; i++) {
    const pStart = getNextPeriodStart(initialStart, period, i);
    const pEnd = getPeriodEnd(pStart, period);

    // Query return activity
    const returnDevices = await prisma.$queryRawUnsafe<{ device_id: string }[]>(
      `SELECT DISTINCT dp.device_id
       FROM timescale.data_points dp
       ${tenantId ? 'INNER JOIN public.devices d ON d.id = dp.device_id' : ''}
       WHERE dp.metric_name = $1
         AND dp.time >= $2
         AND dp.time < $3
         AND dp.device_id = ANY($4)
         ${tenantId ? 'AND d.tenant_id = $5::uuid' : ''}`,
      ...(
        tenantId
          ? [returnMetric, pStart, pEnd, [...initialDeviceSet], tenantId]
          : [returnMetric, pStart, pEnd, [...initialDeviceSet]]
      )
    );

    // Count how many of the initial cohort returned
    const returnedCount = returnDevices.length;
    const retentionRate = totalCohort > 0
      ? Math.round((returnedCount / totalCohort) * 10000) / 100
      : 0;

    periods.push({
      period: i,
      label: getPeriodLabel(i, period),
      activeDevices: returnedCount,
      retentionRate,
    });
  }

  return {
    periods,
    totalCohort,
    metricName: initialMetric,
    periodUnit: period,
  };
}

/**
 * Query devices that reported a specific metric within a time window.
 */
async function queryActiveDevices(
  metricName: string,
  start: Date,
  end: Date,
  tenantId?: string,
): Promise<{ device_id: string }[]> {
  return prisma.$queryRawUnsafe<{ device_id: string }[]>(
    `SELECT DISTINCT dp.device_id
     FROM timescale.data_points dp
     ${tenantId ? 'INNER JOIN public.devices d ON d.id = dp.device_id' : ''}
     WHERE dp.metric_name = $1
       AND dp.time >= $2
       AND dp.time < $3
       ${tenantId ? 'AND d.tenant_id = $4::uuid' : ''}`,
    ...(tenantId ? [metricName, start, end, tenantId] : [metricName, start, end])
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
    case 'day':   return 30;  // 30-day retention
    case 'week':  return 12;  // 12-week retention
    case 'month': return 12;  // 12-month retention
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
