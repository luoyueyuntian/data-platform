/**
 * Analytics — 分析查询类型定义
 * 对标神策 14 个分析模型
 */

import type { AggregationFunction } from './event.js';

/** 事件分析 (Event Analysis) */
export interface EventAnalysisQuery {
  eventName: string;
  aggregation: AggregationFunction;
  /** 分组维度 */
  groupBy?: string[];
  /** 筛选条件 */
  filters?: QueryFilter[];
  timeRange: TimeRange;
  /** 时间粒度 */
  granularity?: string;
}

/** 漏斗分析 (Funnel Analysis) */
export interface FunnelQuery {
  /** 步骤列表 (事件+筛选条件) */
  steps: FunnelStep[];
  /** 窗口期 (秒) */
  windowSeconds: number;
  timeRange: TimeRange;
}

export interface FunnelStep {
  name: string;
  eventName: string;
  filters?: QueryFilter[];
}

/** 留存分析 (Retention Analysis) */
export interface RetentionQuery {
  initialEvent: string;
  returnEvent: string;
  /** 留存周期 */
  period: 'day' | 'week' | 'month';
  timeRange: TimeRange;
}

/** 分布分析 (Distribution Analysis) */
export interface DistributionQuery {
  eventName: string;
  /** 分段区间 */
  buckets?: number[];
  timeRange: TimeRange;
}

/** 归因分析 (Attribution Analysis) */
export interface AttributionQuery {
  targetEvent: string;
  attributionEvents: string[];
  /** 回溯窗口 (秒) */
  lookbackSeconds: number;
  model: AttributionModel;
  timeRange: TimeRange;
}

export type AttributionModel = 'first' | 'last' | 'linear' | 'position' | 'time_decay';

/** 趋势分析 */
export interface TrendQuery {
  eventName: string;
  aggregation: AggregationFunction;
  timeRange: TimeRange;
  granularity: string;
  /** 对比: 'prev_period' | 'year_over_year' | 'none' */
  compareWith: string;
}

export interface QueryFilter {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'contains';
  value: unknown;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export type Granularity = '1m' | '5m' | '15m' | '30m' | '1h' | '6h' | '12h' | '1d';
