import { prisma } from '@ssas/database';
import type { AttributionQuery } from '@ssas/core';

export interface AttributionContribution {
  /** 来源事件 */
  sourceEvent: string;
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
  targetEvent: string;
  totalTargetEvents: number;
}

/**
 * Attribution analysis — determine which events contributed to a target event.
 */
export async function attributionAnalysis(query: AttributionQuery): Promise<AttributionResult> {
  const { targetEvent, attributionEvents, lookbackSeconds, model, timeRange } = query;
  const tenantId = (query as AttributionQuery & { tenantId?: string }).tenantId;

  const targetEvents = await queryTargetEvents(targetEvent, timeRange.start, timeRange.end, tenantId);

  if (targetEvents.length === 0) {
    return {
      model,
      contributions: attributionEvents.map((e) => ({
        sourceEvent: e,
        weight: 0,
        cooccurrenceCount: 0,
        avgTimeDeltaSeconds: 0,
      })),
      targetEvent,
      totalTargetEvents: 0,
    };
  }

  const contributions: AttributionContribution[] = [];

  for (const sourceEvent of attributionEvents) {
    let cooccurrenceCount = 0;
    let totalTimeDelta = 0;

    for (const event of targetEvents) {
      const matches = await prisma.$queryRawUnsafe<{ count: bigint; time_diff?: number }[]>(
        `SELECT
              COUNT(*) as count,
              EXTRACT(EPOCH FROM ($2::timestamptz - MAX(ev.time))) as time_diff
             FROM timescale.events ev
             ${tenantId ? 'INNER JOIN public.entities e ON e.id = ev.entity_id' : ''}
             WHERE ev.entity_id = $1
               AND ev.event_name = $3
               AND ev.time >= $2::timestamptz - INTERVAL '1 second' * $4
               AND ev.time < $2::timestamptz
               ${tenantId ? 'AND e.tenant_id = $5::uuid' : ''}`,
        ...(tenantId
          ? [event.entityId, event.eventTime, sourceEvent, lookbackSeconds, tenantId]
          : [event.entityId, event.eventTime, sourceEvent, lookbackSeconds])
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
      attributionEvents.length
    );

    contributions.push({
      sourceEvent,
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
    targetEvent,
    totalTargetEvents: targetEvents.length,
  };
}

interface TargetEvent {
  entityId: string;
  eventTime: Date;
}

async function queryTargetEvents(
  eventName: string,
  start: Date,
  end: Date,
  tenantId?: string,
): Promise<TargetEvent[]> {
  const rows = await prisma.$queryRawUnsafe<{ entity_id: string; time: Date }[]>(
    `SELECT DISTINCT ON (ev.entity_id, ev.time)
       ev.entity_id, ev.time
     FROM timescale.events ev
     ${tenantId ? 'INNER JOIN public.entities e ON e.id = ev.entity_id' : ''}
     WHERE ev.event_name = $1
       AND ev.time >= $2
       AND ev.time <= $3
       ${tenantId ? 'AND e.tenant_id = $4::uuid' : ''}
     ORDER BY ev.time ASC
     LIMIT 1000`,
    ...(tenantId ? [eventName, start, end, tenantId] : [eventName, start, end])
  );

  return rows.map((r) => ({ entityId: r.entity_id, eventTime: r.time }));
}

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
      return index === 0 ? rawWeight : 0;
    case 'last':
      return index === totalSources - 1 ? rawWeight : 0;
    case 'linear':
      return rawWeight / totalSources;
    case 'position':
      if (totalSources === 1) return rawWeight;
      if (index === 0) return rawWeight * 0.4;
      if (index === totalSources - 1) return rawWeight * 0.4;
      return rawWeight * 0.2 / (totalSources - 2);
    case 'time_decay':
      {
        const sum = (totalSources * (totalSources + 1)) / 2;
        return rawWeight * ((index + 1) / sum);
      }
    default:
      return rawWeight;
  }
}
