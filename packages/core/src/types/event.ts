/**
 * Event — 系统事件 (非传感数据, 而是设备生命周期事件)
 * 对应神策"事件"概念在运维层面的映射
 */

export enum SystemEventType {
  DEVICE_ONLINE = 'device.online',
  DEVICE_OFFLINE = 'device.offline',
  DEVICE_ERROR = 'device.error',
  DEVICE_REGISTERED = 'device.registered',
  DEVICE_DEREGISTERED = 'device.deregistered',
  DEVICE_MAINTENANCE = 'device.maintenance',
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
  deviceId?: string;
  severity: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  details?: Record<string, unknown>;
  time: Date;
}
