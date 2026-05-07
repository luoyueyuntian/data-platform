import { prisma } from '@ssas/database';
import type { AlertRule, AlertCondition } from '@ssas/core';

export interface EvaluationResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  severity: 'info' | 'warn' | 'critical';
  message: string;
  triggeredValue: number;
  entityId?: string;
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

    const conditionResults = await Promise.all(
      conditions.map((cond) => evaluateCondition(cond, rule.tenantId))
    );

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

async function evaluateCondition(condition: AlertCondition, tenantId?: string): Promise<{
  triggered: boolean;
  currentValue: number;
  severity: 'info' | 'warn' | 'critical';
  description: string;
}> {
  const { eventName, operator, threshold, window: windowStr } = condition;

  const currentValue = await getEventCurrentValue(eventName, windowStr ?? '5m', tenantId);

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
      const prevValue = await getEventPreviousValue(eventName, windowStr ?? '5m', tenantId);
      if (prevValue !== null) {
        const change = ((currentValue - prevValue) / Math.abs(prevValue)) * 100;
        triggered = Math.abs(change) > threshold;
        severity = Math.abs(change) > threshold * 2 ? 'critical' : 'warn';
      }
      break;
    }
    case 'anomaly': {
      const stats = await getEventStats(eventName, windowStr ?? '5m', tenantId);
      if (stats && stats.stddev > 0) {
        const deviations = Math.abs(currentValue - stats.mean) / stats.stddev;
        triggered = deviations > threshold;
        severity = deviations > threshold * 2 ? 'critical' : 'warn';
      }
      break;
    }
  }

  const description = `${eventName} = ${currentValue.toFixed(2)} ${operator} ${threshold}`;

  return { triggered, currentValue, severity, description };
}

async function getEventCurrentValue(eventName: string, window: string, tenantId?: string): Promise<number> {
  const windowMinutes = parseWindow(window);
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const result = await prisma.$queryRawUnsafe<{ value: number }[]>(
    `SELECT AVG(ev.value) as value FROM timescale.events ev
     ${tenantId ? 'INNER JOIN public.entities e ON e.id = ev.entity_id' : ''}
     WHERE ev.event_name = $1 AND ev.time >= $2
     ${tenantId ? 'AND e.tenant_id = $3::uuid' : ''}`,
    ...(tenantId ? [eventName, since, tenantId] : [eventName, since])
  );

  return result[0]?.value ?? 0;
}

async function getEventPreviousValue(eventName: string, window: string, tenantId?: string): Promise<number | null> {
  const windowMinutes = parseWindow(window);
  const end = new Date(Date.now() - windowMinutes * 60 * 1000);
  const start = new Date(end.getTime() - windowMinutes * 60 * 1000);

  const result = await prisma.$queryRawUnsafe<{ value: number }[]>(
    `SELECT AVG(ev.value) as value FROM timescale.events ev
     ${tenantId ? 'INNER JOIN public.entities e ON e.id = ev.entity_id' : ''}
     WHERE ev.event_name = $1 AND ev.time >= $2 AND ev.time < $3
     ${tenantId ? 'AND e.tenant_id = $4::uuid' : ''}`,
    ...(tenantId ? [eventName, start, end, tenantId] : [eventName, start, end])
  );

  return result[0]?.value ?? null;
}

async function getEventStats(eventName: string, window: string, tenantId?: string): Promise<{ mean: number; stddev: number } | null> {
  const windowMinutes = parseWindow(window);
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const result = await prisma.$queryRawUnsafe<{ mean: number; stddev: number }[]>(
    `SELECT AVG(ev.value) as mean, STDDEV(ev.value) as stddev FROM timescale.events ev
     ${tenantId ? 'INNER JOIN public.entities e ON e.id = ev.entity_id' : ''}
     WHERE ev.event_name = $1 AND ev.time >= $2
     ${tenantId ? 'AND e.tenant_id = $3::uuid' : ''}`,
    ...(tenantId ? [eventName, since, tenantId] : [eventName, since])
  );

  return result[0]?.mean != null ? { mean: result[0].mean, stddev: result[0].stddev ?? 0 } : null;
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(m|h|d)$/);
  if (!match) return 5;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'm': return value;
    case 'h': return value * 60;
    case 'd': return value * 1440;
    default: return 5;
  }
}
