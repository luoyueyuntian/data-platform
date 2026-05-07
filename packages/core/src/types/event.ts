/**
 * Event — 通用业务事件（对应神策 Event）
 * 支持任意行业的事件数据：传感器读数、用户行为、交易记录等
 */

export interface Event {
  /** 实体 ID */
  entityId: string;
  /** 时间戳 (精确到毫秒) */
  time: Date;
  /** 事件名称 (如 temperature, page_view, purchase) */
  eventName: string;
  /** 事件属性 (灵活的 key-value 结构) */
  properties?: Record<string, unknown>;
  /** 数值 (可选，用于数值型事件的聚合分析) */
  value?: number;
  /** 标签 (可扩展维度, 如 {unit: "°C", zone: "reactor-1"}) */
  tags?: Record<string, string>;
  /** 数据质量 (0-100, 默认 100) */
  quality?: number;
}

/**
 * Event 批量导入格式
 */
export interface EventBatch {
  entityId: string;
  events: Array<{
    time: Date | string;
    eventName: string;
    properties?: Record<string, unknown>;
    value?: number;
    tags?: Record<string, string>;
    quality?: number;
  }>;
}

/**
 * 事件查询参数
 */
export interface EventQuery {
  entityIds: string[];
  eventNames?: string[];
  /** 时间范围 */
  startTime: Date;
  endTime: Date;
  /** 聚合粒度 (如 1m, 5m, 1h, 1d) */
  granularity?: string;
  /** 聚合函数 */
  aggregation?: AggregationFunction;
  /** 筛选条件 (标签或属性) */
  filters?: Record<string, string>;
  /** 排序 */
  orderBy?: 'time' | 'value';
  orderDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export type AggregationFunction = 'avg' | 'sum' | 'min' | 'max' | 'count' | 'last' | 'first' | 'stddev';

/**
 * 聚合查询结果
 */
export interface AggregatedEvent {
  time: Date;
  entityId: string;
  eventName: string;
  avg?: number;
  sum?: number;
  min?: number;
  max?: number;
  count: number;
  last?: number;
}
