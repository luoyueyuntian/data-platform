/**
 * Device — 对应神策 User
 * 设备是平台的核心实体，代表一个物理或虚拟传感设备
 */

export interface Device {
  id: string;
  tenantId: string;
  name: string;
  /** 设备唯一标识 (序列号/MAC) */
  deviceKey: string;
  type: DeviceType;
  status: DeviceStatus;
  /** 安装位置信息 */
  location?: DeviceLocation;
  /** 设备分组 */
  groupId?: string;
  /** 自定义元数据 */
  metadata?: Record<string, unknown>;
  /** 最后在线时间 */
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceLocation {
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
}

export enum DeviceType {
  TEMPERATURE = 'temperature',
  HUMIDITY = 'humidity',
  PRESSURE = 'pressure',
  MOTION = 'motion',
  VIBRATION = 'vibration',
  FLOW = 'flow',
  LEVEL = 'level',
  GAS = 'gas',
  CUSTOM = 'custom',
}

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error',
  DISABLED = 'disabled',
  MAINTENANCE = 'maintenance',
}

export interface DeviceGroup {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceTag {
  id: string;
  deviceId: string;
  key: string;
  value: string;
  /** 标签来源: manual / rule / import */
  source: string;
  createdAt: Date;
}
