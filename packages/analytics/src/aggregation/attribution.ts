import { prisma } from '@ssas/database';
import type { AttributionQuery } from '@ssas/core';

export interface AttributionContribution {
  /** 来源指标 */
  sourceMetric: string;
  /** 贡献权重 (0-1) */
  weight: number;
  /** 关联事件次数 */
  cooccurrenceCount: number;
  /** 平均时间差 (秒, 正数 = 在目标之前) */
  avgTimeDeltaSeconds: number;
}

export interface AttributionResult {
  model: string;
  contributions: AttributionContribution[];
  targetMetric: string;
  totalTargetEvents: number;
}

/**
 * Attribution analysis — determine which metrics contributed to a target event.
 *
 * 对标神策归因分析 (5 种模型):
 *   首次触点 / 末次触点 / 线性 / 位置 / 时间衰减
 *
 * SSAS 适配: 传感器级联触发分析。
 *   目标: 某个关键事件 (如告警触发 / 设备故障)
 *   来源: 其他传感器指标的变化
 *   归因: 哪个指标的变化最可能导致目标事件
 */
export async function attributionAnalysis(query: AttributionQuery): Promise<AttributionResult> {
  const { targetMetric, attributionMetrics, lookbackSeconds, model, timeRange } = query;
  const tenantId = (query as AttributionQuery & { tenantId?: string }).tenantId;

  // 1. Find target events
  const targetEvents = await queryTargetEvents(targetMetric, timeRange.start, timeRange.end, tenantId);

  if (targetEvents.length === 0) {
    return {
      model,
      contributions: attributionMetrics.map((m) => ({
        sourceMetric: m,
        weight: 0,
        cooccurrenceCount: 0,
        avgTimeDeltaSeconds: 0,
      })),
      targetMetric,
      totalTargetEvents: 0,
    };
  }

  // 2. For each target event, look for preceding attribution metrics
  const contributions: AttributionContribution[] = [];

  for (const sourceMetric of attributionMetrics) {
    let cooccurrenceCount = 0;
    let totalTimeDelta = 0;

    for (const event of targetEvents) {
      // Look for matching source metric within lookback window before the target
      const matches = await prisma.$queryRawUnsafe<{ count: bigint; time_diff?: number }[]>(
        `SELECT
              COUNT(*) as count,
              EXTRACT(EPOCH FROM ($2::timestamptz - MAX(dp.time))) as time_diff
             FROM timescale.data_points dp
             ${tenantId ? 'INNER JOIN public.devices d ON d.id = dp.device_id' : ''}
             WHERE dp.device_id = $1
               AND dp.metric_name = $3
               AND dp.time >= $2::timestamptz - INTERVAL '1 second' * $4
               AND dp.time < $2::timestamptz
               ${tenantId ? 'AND d.tenant_id = $5::uuid' : ''}`,
        ...(tenantId
          ? [event.deviceId, event.eventTime, sourceMetric, lookbackSeconds, tenantId]
          : [event.deviceId, event.eventTime, sourceMetric, lookbackSeconds])
      );

      if (matches[0] && Number(matches[0].count) > 0) {
        cooccurrenceCount++;
        totalTimeDelta += Number(matches[0].time_diff ?? 0);
      }
    }

    const weight = calculateAttributionWeight(
      cooccurrenceCount,
      targetEvents.length,
      model,
      contributions.length,
      attributionMetrics.length
    );

    contributions.push({
      sourceMetric,
      weight: Math.round(weight * 10000) / 10000,
      cooccurrenceCount,
      avgTimeDeltaSeconds: cooccurrenceCount > 0
        ? Math.round(totalTimeDelta / cooccurrenceCount)
        : 0,
    });
  }

  return {
    model,
    contributions,
    targetMetric,
    totalTargetEvents: targetEvents.length,
  };
}

interface TargetEvent {
  deviceId: string;
  eventTime: Date;
}

/**
 * Find target metric events in the time range.
 */
async function queryTargetEvents(
  metricName: string,
  start: Date,
  end: Date,
  tenantId?: string,
): Promise<TargetEvent[]> {
  const rows = await prisma.$queryRawUnsafe<{ device_id: string; time: Date }[]>(
    `SELECT DISTINCT ON (dp.device_id, dp.time)
       dp.device_id, dp.time
     FROM timescale.data_points dp
     ${tenantId ? 'INNER JOIN public.devices d ON d.id = dp.device_id' : ''}
     WHERE dp.metric_name = $1
       AND dp.time >= $2
       AND dp.time <= $3
       ${tenantId ? 'AND d.tenant_id = $4::uuid' : ''}
     ORDER BY dp.time ASC
     LIMIT 1000`,
    ...(tenantId ? [metricName, start, end, tenantId] : [metricName, start, end])
  );

  return rows.map((r) => ({ deviceId: r.device_id, eventTime: r.time }));
}

/**
 * Calculate attribution weight based on the model type.
 */
function calculateAttributionWeight(
  cooccurrenceCount: number,
  totalTargetEvents: number,
  model: string,
  index: number,
  totalSources: number,
): number {
  if (totalTargetEvents === 0) return 0;

  const rawWeight = cooccurrenceCount / totalTargetEvents;

  switch (model) {
    case 'first':
      // First touch: first metric gets 100%
      return index === 0 ? rawWeight : 0;

    case 'last':
      // Last touch: last metric gets 100%
      return index === totalSources - 1 ? rawWeight : 0;

    case 'linear':
      // Linear: equal distribution
      return rawWeight / totalSources;

    case 'position':
      // Position-based: first and last get 40% each, rest share 20%
      if (totalSources === 1) return rawWeight;
      if (index === 0) return rawWeight * 0.4;
      if (index === totalSources - 1) return rawWeight * 0.4;
      return rawWeight * 0.2 / (totalSources - 2);

    case 'time_decay':
      // Time decay: later metrics get more weight (simple linear decay)
      // (index + 1) / sum(1..n)
      {
        const sum = (totalSources * (totalSources + 1)) / 2;
        return rawWeight * ((index + 1) / sum);
      }

    default:
      return rawWeight;
  }
}
