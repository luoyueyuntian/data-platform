/**
 * Entity — 通用实体（对应神策 User）
 * 可以是 IoT 设备、电商用户、SaaS 账户等任意主体
 */

export interface Entity {
  id: string;
  tenantId: string;
  name: string;
  /** 实体唯一标识 (序列号/用户ID/账号等) */
  entityKey: string;
  type: EntityType;
  status: EntityStatus;
  /** 位置信息 */
  location?: EntityLocation;
  /** 实体分组 */
  groupId?: string;
  /** 自定义元数据 */
  metadata?: Record<string, unknown>;
  /** 最后活跃时间 */
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntityLocation {
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
}

export enum EntityType {
  CUSTOM = 'custom',
}

export enum EntityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  DISABLED = 'disabled',
  MAINTENANCE = 'maintenance',
}

export interface EntityGroup {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntityTag {
  id: string;
  entityId: string;
  key: string;
  value: string;
  /** 标签来源: manual / rule / import */
  source: string;
  createdAt: Date;
}
