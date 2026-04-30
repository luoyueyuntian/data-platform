import { prisma } from '@ssas/database';
import type { AlertRule, AlertCondition } from '@ssas/core';

export interface EvaluationResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  severity: 'info' | 'warn' | 'critical';
  message: string;
  triggeredValue: number;
  deviceId?: string;
}

/**
 * Evaluate all enabled alert rules against current data.
 * Called periodically by the scheduler.
 */
export async function evaluateAllRules(): Promise<EvaluationResult[]> {
  const rules = await prisma.alertRule.findMany({
    where: { enabled: true },
  });

  const results: EvaluationResult[] = [];

  for (const rule of rules) {
    const conditions = rule.conditions as unknown as AlertCondition[];
    const logic = rule.conditionLogic as 'all' | 'any';

    // Evaluate each condition
    const conditionResults = await Promise.all(
      conditions.map((cond) => evaluateCondition(cond, rule.tenantId))
    );

    // Combine based on logic
    const triggered = logic === 'all'
      ? conditionResults.every((r) => r.triggered)
      : conditionResults.some((r) => r.triggered);

    if (triggered) {
      const maxValue = conditionResults.reduce((max, r) => Math.max(max, r.currentValue), 0);
      const maxSeverity = conditionResults.reduce((max, r) => {
        const sev = r.severity as 'info' | 'warn' | 'critical';
        const order = { critical: 3, warn: 2, info: 1 };
        return order[sev] > order[max] ? sev : max;
      }, 'info' as 'info' | 'warn' | 'critical');

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        triggered: true,
        severity: maxSeverity,
        message: `Rule "${rule.name}" triggered: ${conditionResults.map((r) => r.description).join(', ')}`,
        triggeredValue: maxValue,
      });
    }
  }

  return results;
}

/**
 * Evaluate a single alert condition.
 */
async function evaluateCondition(condition: AlertCondition, tenantId?: string): Promise<{
  triggered: boolean;
  currentValue: number;
  severity: 'info' | 'warn' | 'critical';
  description: string;
}> {
  const { metricName, operator, threshold, window: windowStr } = condition;

  // Query the current metric value
  const currentValue = await getMetricCurrentValue(metricName, windowStr ?? '5m', tenantId);

  // Evaluate the condition
  let triggered = false;
  let severity: 'info' | 'warn' | 'critical' = 'warn';

  switch (operator) {
    case '>':
      triggered = currentValue > threshold;
      severity = currentValue > threshold * 1.5 ? 'critical' : 'warn';
      break;
    case '>=':
      triggered = currentValue >= threshold;
      severity = currentValue >= threshold * 1.5 ? 'critical' : 'warn';
      break;
    case '<':
      triggered = currentValue < threshold;
      severity = currentValue < threshold * 0.5 ? 'critical' : 'warn';
      break;
    case '<=':
      triggered = currentValue <= threshold;
      severity = currentValue <= threshold * 0.5 ? 'critical' : 'warn';
      break;
    case '==':
      triggered = Math.abs(currentValue - threshold) < 0.001;
      severity = 'info';
      break;
    case '!=':
      triggered = Math.abs(currentValue - threshold) >= 0.001;
      severity = 'warn';
      break;
    case 'change_pct': {
      // Compare with previous period
      const prevValue = await getMetricPreviousValue(metricName, windowStr ?? '5m', tenantId);
      if (prevValue !== null) {
        const change = ((currentValue - prevValue) / Math.abs(prevValue)) * 100;
        triggered = Math.abs(change) > threshold;
        severity = Math.abs(change) > threshold * 2 ? 'critical' : 'warn';
      }
      break;
    }
    case 'anomaly': {
      // Simple anomaly: value is N standard deviations from rolling mean
      const stats = await getMetricStats(metricName, windowStr ?? '5m', tenantId);
      if (stats && stats.stddev > 0) {
        const deviations = Math.abs(currentValue - stats.mean) / stats.stddev;
        triggered = deviations > threshold;
        severity = deviations > threshold * 2 ? 'critical' : 'warn';
      }
      break;
    }
  }

  const description = `${metricName} = ${currentValue.toFixed(2)} ${operator} ${threshold}`;

  return { triggered, currentValue, severity, description };
}

/**
 * Query the current (latest) value for a metric within a time window.
 */
async function getMetricCurrentValue(metricName: string, window: string, tenantId?: string): Promise<number> {
  const windowMinutes = parseWindow(window);
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const result = await prisma.$queryRawUnsafe<{ value: number }[]>(
    `SELECT AVG(dp.value) as value FROM timescale.data_points dp
     ${tenantId ? 'INNER JOIN public.devices d ON d.id = dp.device_id' : ''}
     WHERE dp.metric_name = $1 AND dp.time >= $2
     ${tenantId ? 'AND d.tenant_id = $3::uuid' : ''}`,
    ...(tenantId ? [metricName, since, tenantId] : [metricName, since])
  );

  return result[0]?.value ?? 0;
}

/**
 * Query the previous period's value for change comparison.
 */
async function getMetricPreviousValue(metricName: string, window: string, tenantId?: string): Promise<number | null> {
  const windowMinutes = parseWindow(window);
  const end = new Date(Date.now() - windowMinutes * 60 * 1000);
  const start = new Date(end.getTime() - windowMinutes * 60 * 1000);

  const result = await prisma.$queryRawUnsafe<{ value: number }[]>(
    `SELECT AVG(dp.value) as value FROM timescale.data_points dp
     ${tenantId ? 'INNER JOIN public.devices d ON d.id = dp.device_id' : ''}
     WHERE dp.metric_name = $1 AND dp.time >= $2 AND dp.time < $3
     ${tenantId ? 'AND d.tenant_id = $4::uuid' : ''}`,
    ...(tenantId ? [metricName, start, end, tenantId] : [metricName, start, end])
  );

  return result[0]?.value ?? null;
}

/**
 * Get mean and stddev for anomaly detection.
 */
async function getMetricStats(metricName: string, window: string, tenantId?: string): Promise<{ mean: number; stddev: number } | null> {
  const windowMinutes = parseWindow(window);
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const result = await prisma.$queryRawUnsafe<{ mean: number; stddev: number }[]>(
    `SELECT AVG(dp.value) as mean, STDDEV(dp.value) as stddev FROM timescale.data_points dp
     ${tenantId ? 'INNER JOIN public.devices d ON d.id = dp.device_id' : ''}
     WHERE dp.metric_name = $1 AND dp.time >= $2
     ${tenantId ? 'AND d.tenant_id = $3::uuid' : ''}`,
    ...(tenantId ? [metricName, since, tenantId] : [metricName, since])
  );

  return result[0]?.mean != null ? { mean: result[0].mean, stddev: result[0].stddev ?? 0 } : null;
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(m|h|d)$/);
  if (!match) return 5; // default 5 minutes
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'm': return value;
    case 'h': return value * 60;
    case 'd': return value * 1440;
    default: return 5;
  }
}
