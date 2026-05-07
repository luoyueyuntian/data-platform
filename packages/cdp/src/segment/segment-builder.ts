/**
 * Entity segment builder — defines conditions for grouping entities.
 *
 * 对标神策分群: 基于属性/事件/行为序列的实体分组
 */

export interface SegmentDefinition {
  name: string;
  description?: string;
  relation: 'and' | 'or';
  rules: SegmentRule[];
}

export type SegmentRule =
  | ProfileRule
  | MetricRule
  | TagRule
  ;

export interface ProfileRule {
  type: 'profile';
  field: 'status' | 'type' | 'phase' | 'location';
  operator: '=' | '!=' | 'in' | 'contains';
  value: unknown;
}

export interface MetricRule {
  type: 'metric';
  eventName: string;
  aggregation: 'avg' | 'sum' | 'max' | 'min' | 'count';
  operator: '>' | '<' | '>=' | '<=' | 'between';
  value: number | [number, number];
  windowHours: number;
}

export interface TagRule {
  type: 'tag';
  key: string;
  operator: '=' | '!=' | 'exists';
  value?: string;
}

/**
 * Build a SQL WHERE clause from segment definition.
 */
export function buildSegmentSQL(segment: SegmentDefinition): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const rule of segment.rules) {
    switch (rule.type) {
      case 'profile': {
        const pr = rule as ProfileRule;
        if (pr.operator === 'in') {
          conditions.push(`e.${pr.field} = ANY($${idx++})`);
          params.push(pr.value);
        } else if (pr.operator === 'contains') {
          conditions.push(`e.${pr.field} ILIKE $${idx++}`);
          params.push(`%${pr.value}%`);
        } else {
          conditions.push(`e.${pr.field} ${toSqlComparisonOperator(pr.operator)} $${idx++}`);
          params.push(pr.value);
        }
        break;
      }
      case 'tag': {
        const tr = rule as TagRule;
        if (tr.operator === 'exists') {
          conditions.push(`EXISTS (SELECT 1 FROM entity_tags et WHERE et.entity_id = e.id AND et.key = $${idx++})`);
          params.push(tr.key);
        } else {
          conditions.push(`EXISTS (SELECT 1 FROM entity_tags et WHERE et.entity_id = e.id AND et.key = $${idx++} AND et.value ${toSqlComparisonOperator(tr.operator)} $${idx++})`);
          params.push(tr.key, tr.value);
        }
        break;
      }
      case 'metric': {
        const mr = rule as MetricRule;
        const windowStart = new Date(Date.now() - mr.windowHours * 3600000);
        const metricSql = buildMetricCondition(mr, idx);
        conditions.push(
          `EXISTS (SELECT 1 FROM timescale.events ev WHERE ev.entity_id = e.id ` +
          `AND ev.event_name = $${idx++} AND ev.time >= $${idx++} ` +
          `GROUP BY ev.entity_id HAVING ${metricSql.sql})`
        );
        params.push(mr.eventName, windowStart, ...metricSql.params);
        idx += metricSql.paramCount;
        break;
      }
    }
  }

  const logic = segment.relation === 'and' ? 'AND' : 'OR';
  const sql = conditions.length > 0 ? conditions.join(` ${logic} `) : '1=1';

  return { sql, params };
}

function buildMetricCondition(rule: MetricRule, startIndex: number): { sql: string; params: unknown[]; paramCount: number } {
  const aggregation = toSqlAggregation(rule.aggregation);

  if (rule.operator === 'between') {
    const [min, max] = rule.value as [number, number];
    return {
      sql: `${aggregation}(ev.value) BETWEEN $${startIndex} AND $${startIndex + 1}`,
      params: [min, max],
      paramCount: 2,
    };
  }

  return {
    sql: `${aggregation}(ev.value) ${toSqlComparisonOperator(rule.operator)} $${startIndex}`,
    params: [rule.value],
    paramCount: 1,
  };
}

function toSqlAggregation(aggregation: MetricRule['aggregation']): string {
  switch (aggregation) {
    case 'avg':
    case 'sum':
    case 'max':
    case 'min':
    case 'count':
      return aggregation.toUpperCase();
    default:
      throw new Error(`Unsupported aggregation: ${String(aggregation)}`);
  }
}

function toSqlComparisonOperator(operator: string): string {
  switch (operator) {
    case '=':
    case '!=':
    case '>':
    case '<':
    case '>=':
    case '<=':
      return operator;
    default:
      throw new Error(`Unsupported operator: ${String(operator)}`);
  }
}
