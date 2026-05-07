import { prisma } from '@ssas/database';
import type { FunnelQuery } from '@ssas/core';

export interface FunnelStepResult {
  name: string;
  eventName: string;
  entityCount: number;
  eventCount: number;
  conversionRate: number;
  dropCount: number;
  dropRate: number;
}

export interface FunnelResult {
  steps: FunnelStepResult[];
  overallConversion: number;
  totalEntitiesAtStart: number;
  totalEntitiesAtEnd: number;
}

/**
 * Funnel analysis — multi-step conversion analysis.
 *
 * 对标神策 Funnel Analysis:
 *   步骤序列 (事件 + 筛选条件) → 窗口期 → 转化率
 */
export async function funnelAnalysis(query: FunnelQuery): Promise<FunnelResult> {
  const { steps, windowSeconds, timeRange } = query;
  const tenantId = (query as FunnelQuery & { tenantId?: string }).tenantId;

  if (steps.length < 2) {
    throw new Error('Funnel requires at least 2 steps');
  }

  const entityIdsResults: string[][] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const entityIds = await queryStepEntities(step.eventName, step.filters, timeRange.start, timeRange.end, tenantId);
    entityIdsResults.push(entityIds);
  }

  const entitySets = entityIdsResults.map((ids) => new Set(ids));

  // 封闭式漏斗: 实体必须从第 1 步进入
  const startEntitySet = entitySets[0];
  const totalEntitiesAtStart = startEntitySet.size;

  const stepResults: FunnelStepResult[] = [];
  let previousEntitySet = startEntitySet;

  for (let i = 0; i < steps.length; i++) {
    const currentStepValidEntities = new Set<string>();
    const currentStepAllEntities = entitySets[i];

    for (const entityId of currentStepAllEntities) {
      if (i === 0 || previousEntitySet.has(entityId)) {
        currentStepValidEntities.add(entityId);
      }
    }

    const entityCount = currentStepValidEntities.size;
    const conversionRate = totalEntitiesAtStart > 0
      ? (entityCount / totalEntitiesAtStart) * 100
      : 0;

    const previousCount = i === 0
      ? totalEntitiesAtStart
      : stepResults[i - 1].entityCount;

    const dropCount = previousCount - entityCount;
    const dropRate = previousCount > 0 ? (dropCount / previousCount) * 100 : 0;

    stepResults.push({
      name: steps[i].name,
      eventName: steps[i].eventName,
      entityCount,
      eventCount: entityCount,
      conversionRate: Math.round(conversionRate * 100) / 100,
      dropCount,
      dropRate: Math.round(dropRate * 100) / 100,
    });

    previousEntitySet = currentStepValidEntities;
  }

  const totalEntitiesAtEnd = stepResults[stepResults.length - 1].entityCount;
  const overallConversion = totalEntitiesAtStart > 0
    ? Math.round((totalEntitiesAtEnd / totalEntitiesAtStart) * 10000) / 100
    : 0;

  return {
    steps: stepResults,
    overallConversion,
    totalEntitiesAtStart,
    totalEntitiesAtEnd,
  };
}

async function queryStepEntities(
  eventName: string,
  filters?: Array<{ field: string; operator: string; value: unknown }>,
  startTime?: Date,
  endTime?: Date,
  tenantId?: string,
): Promise<string[]> {
  const conditions: string[] = ['ev.event_name = $1'];
  const params: unknown[] = [eventName];
  let idx = 2;

  if (startTime) {
    conditions.push(`ev.time >= $${idx++}`);
    params.push(startTime);
  }
  if (endTime) {
    conditions.push(`ev.time <= $${idx++}`);
    params.push(endTime);
  }
  if (tenantId) {
    conditions.push(`e.tenant_id = $${idx++}::uuid`);
    params.push(tenantId);
  }

  if (filters) {
    for (const f of filters) {
      if (f.field === 'value') {
        conditions.push(`ev.value ${toSqlComparisonOperator(f.operator)} $${idx++}`);
        params.push(f.value);
      }
    }
  }

  const sql = `
    SELECT DISTINCT ev.entity_id
    FROM timescale.events ev
    ${tenantId ? 'INNER JOIN public.entities e ON e.id = ev.entity_id' : ''}
    WHERE ${conditions.join(' AND ')}
  `;

  const rows = await prisma.$queryRawUnsafe<{ entity_id: string }[]>(sql, ...params);
  return rows.map((r) => r.entity_id);
}

function toSqlComparisonOperator(operator: string): string {
  switch (operator) {
    case '>':
    case '>=':
    case '<':
    case '<=':
    case '=':
    case '!=':
      return operator;
    default:
      throw new Error(`Unsupported filter operator: ${operator}`);
  }
}
