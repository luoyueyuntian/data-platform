/**
 * Device segment builder — defines conditions for grouping devices.
 *
 * 对标神策分群: 基于属性/事件/行为序列的设备分组
 */

export interface SegmentDefinition {
  name: string;
  description?: string;
  /** 规则组间逻辑 */
  relation: 'and' | 'or';
  rules: SegmentRule[];
}

export type SegmentRule =
  | ProfileRule       // 设备属性规则
  | MetricRule        // 指标聚合规则
  | TagRule           // 标签规则
  ;

export interface ProfileRule {
  type: 'profile';
  field: 'status' | 'type' | 'phase' | 'location';
  operator: '=' | '!=' | 'in' | 'contains';
  value: unknown;
}

export interface MetricRule {
  type: 'metric';
  metricName: string;
  aggregation: 'avg' | 'sum' | 'max' | 'min' | 'count';
  operator: '>' | '<' | '>=' | '<=' | 'between';
  value: number | [number, number];
  /** 统计窗口 */
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
 * Used by the segment calculator to query matching devices.
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
          conditions.push(`d.${pr.field} = ANY($${idx++})`);
          params.push(pr.value);
        } else if (pr.operator === 'contains') {
          conditions.push(`d.${pr.field} ILIKE $${idx++}`);
          params.push(`%${pr.value}%`);
        } else {
          conditions.push(`d.${pr.field} ${toSqlComparisonOperator(pr.operator)} $${idx++}`);
          params.push(pr.value);
        }
        break;
      }
      case 'tag': {
        const tr = rule as TagRule;
        if (tr.operator === 'exists') {
          conditions.push(`EXISTS (SELECT 1 FROM device_tags dt WHERE dt.device_id = d.id AND dt.key = $${idx++})`);
          params.push(tr.key);
        } else {
          conditions.push(`EXISTS (SELECT 1 FROM device_tags dt WHERE dt.device_id = d.id AND dt.key = $${idx++} AND dt.value ${toSqlComparisonOperator(tr.operator)} $${idx++})`);
          params.push(tr.key, tr.value);
        }
        break;
      }
      case 'metric': {
        const mr = rule as MetricRule;
        const windowStart = new Date(Date.now() - mr.windowHours * 3600000);
        const metricSql = buildMetricCondition(mr, idx);
        conditions.push(
          `EXISTS (SELECT 1 FROM timescale.data_points dp WHERE dp.device_id = d.id ` +
          `AND dp.metric_name = $${idx++} AND dp.time >= $${idx++} ` +
          `GROUP BY dp.device_id HAVING ${metricSql.sql})`
        );
        params.push(mr.metricName, windowStart, ...metricSql.params);
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
      sql: `${aggregation}(dp.value) BETWEEN $${startIndex} AND $${startIndex + 1}`,
      params: [min, max],
      paramCount: 2,
    };
  }

  return {
    sql: `${aggregation}(dp.value) ${toSqlComparisonOperator(rule.operator)} $${startIndex}`,
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

function toSqlComparisonOperator(operator: '=' | '!=' | '>' | '<' | '>=' | '<='): string {
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
