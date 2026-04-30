/**
 * Dashboard — 可视化看板
 * 对标神策"可视化看板"能力
 */

export interface Dashboard {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  panels: Panel[];
  /** 布局配置 */
  layout?: DashboardLayout;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Panel {
  id: string;
  title: string;
  type: ChartType;
  /** 查询配置 */
  query: PanelQuery;
  /** 位置和大小 */
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  /** 样式配置 */
  style?: Record<string, unknown>;
}

export type ChartType =
  | 'line'
  | 'bar'
  | 'pie'
  | 'table'
  | 'gauge'
  | 'heatmap'
  | 'scatter'
  | 'stat'
  | 'area';

export interface PanelQuery {
  metricNames: string[];
  aggregation: string;
  granularity: string;
  filters?: Record<string, string>;
  timeRange?: 'last_1h' | 'last_6h' | 'last_24h' | 'last_7d' | 'last_30d' | 'custom';
}

export interface DashboardLayout {
  columns: number;
  rowHeight: number;
}
