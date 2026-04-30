/**
 * DataPoint — 对应神策 Event
 * 传感器的单次数据采样点，是平台的核心数据实体
 */

export interface DataPoint {
  /** 设备 ID */
  deviceId: string;
  /** 时间戳 (精确到毫秒) */
  time: Date;
  /** 指标名称 (如 temperature, pressure) */
  metricName: string;
  /** 数值 */
  value: number;
  /** 传感器 ID (可选, 当设备有多个传感器时) */
  sensorId?: string;
  /** 标签 (可扩展维度, 如 {unit: "°C", zone: "reactor-1"}) */
  tags?: Record<string, string>;
  /** 数据质量 (0-100, 默认 100) */
  quality?: number;
}

/**
 * DataPoint 批量导入格式
 */
export interface DataPointBatch {
  deviceId: string;
  dataPoints: Array<{
    time: Date | string;
    metricName: string;
    value: number;
    sensorId?: string;
    tags?: Record<string, string>;
    quality?: number;
  }>;
}

/**
 * 时序查询参数
 */
export interface TimeSeriesQuery {
  deviceIds: string[];
  metricNames?: string[];
  /** 时间范围 */
  startTime: Date;
  endTime: Date;
  /** 聚合粒度 (如 1m, 5m, 1h, 1d) */
  granularity?: string;
  /** 聚合函数 */
  aggregation?: AggregationFunction;
  /** 筛选条件 (标签) */
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
export interface AggregatedDataPoint {
  time: Date;
  deviceId: string;
  metricName: string;
  avg?: number;
  sum?: number;
  min?: number;
  max?: number;
  count: number;
  last?: number;
}
