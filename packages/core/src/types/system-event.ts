/**
 * SystemEvent — 系统事件 (实体生命周期事件，非业务事件)
 * 如实体上线/下线、告警触发等
 */

export enum SystemEventType {
  ENTITY_ONLINE = 'entity.online',
  ENTITY_OFFLINE = 'entity.offline',
  ENTITY_ERROR = 'entity.error',
  ENTITY_REGISTERED = 'entity.registered',
  ENTITY_DEREGISTERED = 'entity.deregistered',
  ENTITY_MAINTENANCE = 'entity.maintenance',
  ALERT_TRIGGERED = 'alert.triggered',
  ALERT_RESOLVED = 'alert.resolved',
  DATA_QUALITY_WARN = 'data.quality_warn',
  SYSTEM_CONFIG_CHANGE = 'system.config_change',
}

export interface SystemEvent {
  id: string;
  tenantId: string;
  type: SystemEventType;
  source: string;
  entityId?: string;
  severity: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  details?: Record<string, unknown>;
  time: Date;
}
