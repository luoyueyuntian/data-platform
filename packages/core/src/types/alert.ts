/**
 * Alert — 告警规则与记录
 * 对标神策"预警"能力
 */

export interface AlertRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  /** 规则条件表达式 */
  conditions: AlertCondition[];
  /** 条件逻辑: all (AND) | any (OR) */
  conditionLogic: 'all' | 'any';
  /** 通知渠道配置 */
  channels: AlertChannel[];
  /** 静默期 (秒), 防止重复告警 */
  silenceSeconds: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertCondition {
  /** 指标名称 */
  metricName: string;
  /** 比较运算符 */
  operator: ComparisonOperator;
  /** 阈值 */
  threshold: number;
  /** 持续周期数 (连续 N 次满足才触发) */
  duration?: number;
  /** 聚合窗口 */
  window?: string;
}

export type ComparisonOperator = '>' | '>=' | '<' | '<=' | '==' | '!=' | 'change_pct' | 'anomaly';

export interface AlertChannel {
  type: AlertChannelType;
  config: Record<string, string>;
}

export type AlertChannelType = 'webhook' | 'email' | 'sms' | 'app_push';

export interface AlertRecord {
  id: string;
  ruleId: string;
  ruleName: string;
  deviceId?: string;
  /** 触发时的值 */
  triggeredValue: number;
  severity: 'info' | 'warn' | 'critical';
  message: string;
  status: AlertStatus;
  triggeredAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export type AlertStatus = 'firing' | 'resolved' | 'acknowledged' | 'silenced';
