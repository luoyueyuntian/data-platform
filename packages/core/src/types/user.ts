/**
 * User & Tenant — 平台用户与租户管理
 * 对标神策"权限管理"体系
 */

export interface Tenant {
  id: string;
  name: string;
  plan: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: RoleType;
  /** 自定义角色 ID (当 role=custom 时) */
  customRoleId?: string;
  status: UserStatus;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type RoleType = 'admin' | 'analyst' | 'operator' | 'viewer' | 'custom';

export type UserStatus = 'active' | 'disabled' | 'invited';

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  /** 系统角色不可修改 */
  isSystem: boolean;
  permissions: Permission[];
  createdAt: Date;
}

export interface Permission {
  /** 数据权限: data:device:read */
  resource: string;
  action: 'read' | 'write' | 'delete' | 'admin';
  /** 数据范围: all | group | own */
  scope: string;
  /** 脱敏配置 */
  masking?: {
    enabled: boolean;
    /** 字段路径 */
    fields: string[];
  };
}

/** API Key — 用于 M2M 认证 */
export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  key: string;
  permissions: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  detail?: Record<string, unknown>;
  ip: string;
  createdAt: Date;
}
