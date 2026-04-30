import { prisma } from '@ssas/database';
import type { FunnelQuery } from '@ssas/core';

export interface FunnelStepResult {
  name: string;
  metricName: string;
  deviceCount: number;
  eventCount: number;
  conversionRate: number;
  dropCount: number;
  dropRate: number;
}

export interface FunnelResult {
  steps: FunnelStepResult[];
  overallConversion: number;
  totalDevicesAtStart: number;
  totalDevicesAtEnd: number;
}

/**
 * Funnel analysis — multi-step conversion analysis for sensor data.
 *
 * 对标神策 Funnel Analysis:
 *   步骤序列 (事件 + 筛选条件) → 窗口期 → 转化率
 *
 * SSAS 适配: 追踪传感数据链路转化。
 * 例如: 温度 > 80°C → 压力升高 → 系统告警
 *
 * 设计:
 *   每个步骤 = 在一段时间内满足 metric 条件
 *   封闭式漏斗: 设备必须从第 1 步进入才被统计
 *   窗口期: 用户完成所有步骤的时间限制
 */
export async function funnelAnalysis(query: FunnelQuery): Promise<FunnelResult> {
  const { steps, windowSeconds, timeRange } = query;
  const tenantId = (query as FunnelQuery & { tenantId?: string }).tenantId;

  // Validate
  if (steps.length < 2) {
    throw new Error('Funnel requires at least 2 steps');
  }

  const deviceIdsResults: string[][] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const deviceIds = await queryStepDevices(step.metricName, step.filters, timeRange.start, timeRange.end, tenantId);
    deviceIdsResults.push(deviceIds);
  }

  // Convert deviceId lists to Sets for intersection checks
  const deviceSets = deviceIdsResults.map((ids) => new Set(ids));

  // 封闭式漏斗: 设备必须从第 1 步进入
  const startDeviceSet = deviceSets[0];
  const totalDevicesAtStart = startDeviceSet.size;

  // For each step, compute how many devices from the previous step continue
  const stepResults: FunnelStepResult[] = [];
  let previousDeviceSet = startDeviceSet;

  for (let i = 0; i < steps.length; i++) {
    // Devices that made it to this step (intersection of start → current)
    const currentStepValidDevices = new Set<string>();
    const currentStepAllDevices = deviceSets[i];

    for (const deviceId of currentStepAllDevices) {
      if (i === 0 || previousDeviceSet.has(deviceId)) {
        currentStepValidDevices.add(deviceId);
      }
    }

    const deviceCount = currentStepValidDevices.size;
    const conversionRate = totalDevicesAtStart > 0
      ? (deviceCount / totalDevicesAtStart) * 100
      : 0;

    const previousCount = i === 0
      ? totalDevicesAtStart
      : stepResults[i - 1].deviceCount;

    const dropCount = previousCount - deviceCount;
    const dropRate = previousCount > 0 ? (dropCount / previousCount) * 100 : 0;

    stepResults.push({
      name: steps[i].name,
      metricName: steps[i].metricName,
      deviceCount,
      eventCount: deviceCount, // In sensor context, eventCount = deviceCount for simplicity
      conversionRate: Math.round(conversionRate * 100) / 100,
      dropCount,
      dropRate: Math.round(dropRate * 100) / 100,
    });

    previousDeviceSet = currentStepValidDevices;
  }

  const totalDevicesAtEnd = stepResults[stepResults.length - 1].deviceCount;
  const overallConversion = totalDevicesAtStart > 0
    ? Math.round((totalDevicesAtEnd / totalDevicesAtStart) * 10000) / 100
    : 0;

  return {
    steps: stepResults,
    overallConversion,
    totalDevicesAtStart,
    totalDevicesAtEnd,
  };
}

/**
 * Query devices that reported a specific metric within the time range,
 * optionally filtered by value conditions.
 */
async function queryStepDevices(
  metricName: string,
  filters?: Array<{ field: string; operator: string; value: unknown }>,
  startTime?: Date,
  endTime?: Date,
  tenantId?: string,
): Promise<string[]> {
  const conditions: string[] = ['dp.metric_name = $1'];
  const params: unknown[] = [metricName];
  let idx = 2;

  if (startTime) {
    conditions.push(`dp.time >= $${idx++}`);
    params.push(startTime);
  }
  if (endTime) {
    conditions.push(`dp.time <= $${idx++}`);
    params.push(endTime);
  }
  if (tenantId) {
    conditions.push(`d.tenant_id = $${idx++}::uuid`);
    params.push(tenantId);
  }

  // Apply value filters if provided
  if (filters) {
    for (const f of filters) {
      if (f.field === 'value') {
        conditions.push(`dp.value ${toSqlComparisonOperator(f.operator)} $${idx++}`);
        params.push(f.value);
      }
    }
  }

  const sql = `
    SELECT DISTINCT dp.device_id
    FROM timescale.data_points dp
    ${tenantId ? 'INNER JOIN public.devices d ON d.id = dp.device_id' : ''}
    WHERE ${conditions.join(' AND ')}
  `;

  const rows = await prisma.$queryRawUnsafe<{ device_id: string }[]>(sql, ...params);
  return rows.map((r) => r.device_id);
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
