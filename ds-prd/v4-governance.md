# DS V4.0 PRD — 数据治理与企业管理

## 版本范围

V4.0 面向企业级多租户场景，增强数据治理能力，增加广告归因分析模块。

| 模块 | 优先级 | 工作量估算 |
|------|--------|-----------|
| 多项目管理 | P0 | 2 周 |
| 虚拟事件与虚拟属性 | P1 | 2 周 |
| 维度表 | P1 | 1 周 |
| 权限管理 (RBAC) | P0 | 2 周 |
| 智能预警 | P1 | 2 周 |
| 广告归因与渠道追踪 | P1 | 2 周 |
| 数据导入与管理 | P2 | 1 周 |
| **合计** | | **6 周** |

---

## 模块 1：多项目管理

### 1.1 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| MP-001 | 项目创建 | 创建独立分析项目，分配 project_id，选择时区 |
| MP-002 | 项目列表 | 展示用户有权限的所有项目，支持快速切换 |
| MP-003 | 项目设置 | 项目名称、描述、时区、数据保留时长 |
| MP-004 | 成员管理 | 添加/移除项目成员，设置项目角色 |
| MP-005 | 项目重置 | 清空项目所有数据（测试环境重置）|
| MP-006 | 资产箱打包 | 将项目中的书签、概览、分群、标签打包导出 |
| MP-007 | 资产箱导入 | 将资产包导入其他项目，自动关联依赖资源 |
| MP-008 | 数据隔离 | 跨项目数据完全物理隔离 |

### 1.2 项目配置

```typescript
interface ProjectConfig {
  id: string;
  name: string;
  description?: string;
  timezone: string;             // 默认 "Asia/Shanghai"
  data_retention_days: number;  // 数据保留天数 默认 365
  status: 'active' | 'frozen' | 'archived';
  
  // 数据接入配置
  ingestion_config: {
    server_url: string;          // SDK 上报地址
    require_event_registration: boolean;  // 是否需要预注册事件（强校验模式）
    sample_rate: number;         // 全局采样率
  };
  
  created_at: TIMESTAMPTZ;
  updated_at: TIMESTAMPTZ;
}
```

### 1.3 资产打包数据结构

```typescript
interface AssetPackage {
  version: '1.0';
  project_id: string;
  exported_at: string;
  
  assets: {
    events?: { name: string; display_name: string }[];
    event_properties?: {}[];
    user_properties?: {}[];
    segments?: { id: string; name: string; rule: SegmentRule }[];
    tags?: { id: string; name: string; definition: TagDefinition }[];
    bookmarks?: { name: string; type: string; config: any }[];
    virtual_events?: {}[];
    virtual_properties?: {}[];
    dimension_tables?: {}[];
  };
  
  // 自动关联的依赖
  dependencies: {
    events: string[];
    properties: string[];
    dimension_tables: string[];
  };
}
```

---

## 模块 2：虚拟事件

### 2.1 功能规格

虚拟事件是基于已有元事件进行过滤、组合后产生的"派生事件"，不存储原始数据，查询时动态计算。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| VE-001 | 创建虚拟事件 | 选择一个元事件，设置属性过滤条件，命名为新事件 |
| VE-002 | 多事件组合 | 多个元事件合并为一个虚拟事件（OR 组合）|
| VE-003 | 虚拟事件属性 | 继承元事件的属性，可额外添加计算属性 |
| VE-004 | 应用于分析 | 虚拟事件可像普通事件一样在分析模型中使用 |

### 2.2 虚拟事件定义

```typescript
interface VirtualEvent {
  id: string;
  project_id: string;
  name: string;                    // 英文标识
  display_name: string;            // 中文名称
  description?: string;
  
  // 来源：单个元事件 + 过滤条件
  source_events: {
    event_name: string;
    filters?: Condition[];
  }[];
  
  // 可用属性（自动合并所有 source 事件的属性）
  properties: string[];
  
  // 额外计算属性
  derived_properties?: {
    name: string;
    display_name: string;
    expression: string;   // SQL 表达式，引用原始事件属性
    data_type: string;
  }[];
  
  status: 'active' | 'disabled';
}
```

### 2.3 查询示例

```sql
-- 虚拟事件 "高价值购买" = 购买事件中 amount > 1000
-- 查询时动态展开
SELECT * FROM events WHERE event_name = 'purchase' AND (properties->>'amount')::numeric > 1000;
```

---

## 模块 3：虚拟属性

### 3.1 功能规格

虚拟属性是在数据入库后，通过 SQL 表达式对已有属性加工生成的衍生属性。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| VP-001 | 创建虚拟属性 | 定义 SQL 表达式，引用事件属性或用户属性 |
| VP-002 | 属性抽取 | 如从 URL 中提取查询参数：`parse_url($url, 'QUERY', 'q')` |
| VP-003 | 属性合并 | 如合并多个同义属性：`coalesce(store_id, shop_id)` |
| VP-004 | 类型转换 | 支持 DECIMAL 高精度类型转换 |
| VP-005 | 条件派生 | `CASE WHEN` 表达式生成分类属性 |
| VP-006 | 应用范围 | 事件属性 or 用户属性 |

### 3.2 虚拟属性定义

```typescript
interface VirtualProperty {
  id: string;
  project_id: string;
  name: string;
  display_name: string;
  scope: 'event' | 'user';
  
  // 关联的事件（scope=event 时），空为全局
  event_name?: string;
  
  // SQL 表达式
  expression: string;
  
  // 表达式示例
  // 'parse_url(events.$url, ''QUERY'', ''q'')'     → URL 搜索关键词抽取
  // 'coalesce(events.store_id, events.shop_id)'     → 属性合并
  // 'CAST(events.amount AS DECIMAL(38,2))'          → 高精度小数
  // 'CASE WHEN events.amount >= 1000 THEN ''高'' WHEN events.amount >= 100 THEN ''中'' ELSE ''低'' END'  → 条件分类
  // 'EXTRACT(DOW FROM events.$time)'                → 星期几
  
  data_type: 'string' | 'number' | 'bool' | 'datetime';
  status: 'active' | 'disabled';
}
```

---

## 模块 4：维度表

### 4.1 功能规格

维度表允许用户导入外部数据表来扩展分析维度，通过关联事件属性来丰富分析场景。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| DT-001 | 导入维度表 | 上传 CSV/Excel 或通过 API 写入维度数据 |
| DT-002 | 主键定义 | 指定维度表的主键字段 |
| DT-003 | 关联配置 | 配置维度表主键与事件属性（或用户属性）的关联关系 |
| DT-004 | 维度表管理 | 列表展示、数据预览、编辑、删除 |
| DT-005 | 字段查询 | 关联后维度表的字段可作为虚拟属性在分析中使用 |

### 4.2 维度表定义

```typescript
interface DimensionTable {
  id: string;
  project_id: string;
  name: string;                    // 表名
  display_name: string;
  description?: string;
  
  // 字段定义
  columns: {
    name: string;
    data_type: 'string' | 'number' | 'bool' | 'datetime';
    display_name: string;
    is_primary_key: boolean;
  }[];
  
  // 关联关系
  joins: {
    type: 'event' | 'user';       // 关联到事件表还是用户表
    event_name?: string;           // type=event 时筛选事件
    source_column: string;         // 维度表字段
    target_property: string;       // 目标属性名（事件属性或用户属性）
  }[];
  
  row_count: number;
  status: 'active' | 'disabled';
}
```

### 4.3 查询示例

```sql
-- 维度表: product_info (product_id, product_name, category, price_tier)
-- 关联: product_info.product_id = events.product_id
-- 在分析中可使用维度表字段作为属性

SELECT 
  e.event,
  pi.category as product_category,
  pi.price_tier,
  COUNT(*) as cnt
FROM events e
LEFT JOIN dimension_tables.product_info pi 
  ON pi.product_id = (e.properties->>'product_id')
WHERE e.event_name = 'purchase'
GROUP BY pi.category, pi.price_tier;
```

---

## 模块 5：权限管理 (RBAC)

### 5.1 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| RB-001 | 角色定义 | 系统预置角色：管理员、分析员、运营员、查看员 |
| RB-002 | 自定义角色 | 支持自定义角色，精细配置资源权限 |
| RB-003 | 权限粒度 | 项目级权限、功能模块级权限、数据级权限（行列权限）|
| RB-004 | API Key 管理 | 生成/吊销 API Key，绑定角色和项目权限 |
| RB-005 | MFA 认证 | 支持 Google Authenticator 多因子认证 |
| RB-006 | 审计日志 | 记录用户操作日志：登录、查询、导出、权限变更 |
| RB-007 | 数据脱敏 | 配置敏感字段脱敏展示（如手机号、邮箱）|
| RB-008 | 登录策略 | IP 白名单、密码策略、登录有效期 |

### 5.2 权限模型

```typescript
// 角色 - 权限关系
interface Role {
  id: string;
  name: string;
  type: 'system' | 'custom';
  permissions: Permission[];
}

interface Permission {
  resource: string;    // 资源标识: project.analytics.events / project.data.segments / system.users
  actions: ('create' | 'read' | 'update' | 'delete' | 'export')[];
  scope: 'all' | 'own';  // 所有数据或仅自己的
  constraints?: {      // 数据级权限约束
    event_filter?: Condition[];
    property_filter?: string[];      // 可查看的属性列表
    property_mask?: { property: string; mask_type: string }[];  // 脱敏字段
  };
}

// 系统预置角色
const ROLES = {
  admin: {
    name: '管理员',
    permissions: [{ resource: '*', actions: ['*'], scope: 'all' }],
  },
  analyst: {
    name: '分析员',
    permissions: [
      { resource: 'project.analytics.*', actions: ['read'], scope: 'all' },
      { resource: 'project.analytics.events', actions: ['create', 'update'], scope: 'own' },
      { resource: 'project.data.segments', actions: ['create', 'read', 'update', 'delete'], scope: 'own' },
      { resource: 'project.data.export', actions: ['*'], scope: 'own' },
    ],
  },
  operator: {
    name: '运营员',
    permissions: [
      { resource: 'project.engagement.*', actions: ['read', 'create', 'update'], scope: 'all' },
      { resource: 'project.analytics.segments', actions: ['read'], scope: 'all' },
      { resource: 'project.analytics.events', actions: ['read'], scope: 'all' },
    ],
  },
  viewer: {
    name: '查看员',
    permissions: [
      { resource: 'project.*', actions: ['read'], scope: 'all' },
    ],
  },
};
```

### 5.3 审计日志表

```sql
CREATE TABLE audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  project_id      VARCHAR(32),
  user_id         VARCHAR(255) NOT NULL,
  action          VARCHAR(64) NOT NULL,    -- login | query | export | create | update | delete
  resource_type   VARCHAR(64),             -- segment | campaign | tag | bookmark
  resource_id     VARCHAR(64),
  detail          JSONB,                   -- 请求详情、参数
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 模块 6：智能预警

### 6.1 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| AL-001 | 预警规则定义 | 选择监控指标（事件 + 聚合方式 + 筛选条件）|
| AL-002 | 阈值类型 | 静态阈值（> / < / between）、同比异常（环比下降 > X%）、动态基线 |
| AL-003 | 检查频率 | 每 N 分钟 / 每小时 / 每日检查 |
| AL-004 | 通知渠道 | 邮件、企业微信、钉钉、Webhook |
| AL-005 | 预警历史 | 告警触发记录、恢复记录 |
| AL-006 | 静默期 | 同类告警在 N 小时内不重复发送 |

### 6.2 预警规则

```typescript
interface AlertRule {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  
  // 监控指标
  metric: {
    event_name: string;
    aggregation: 'total_count' | 'unique_user' | 'sum' | 'avg';
    property?: string;
    filters?: Condition[];
    time_window_minutes: number;   // 聚合时间窗口
  };
  
  // 触发条件
  trigger: {
    type: 'static' | 'anomaly' | 'baseline';
    
    // static
    static_threshold?: {
      operator: '>' | '<' | '>=' | '<=' | 'between';
      value: number;
      value_max?: number;
    };
    
    // anomaly：同比环比
    anomaly_config?: {
      comparison: 'wow' | 'yoy' | 'daily_avg';
      drop_percent: number;         // 下降超过 X% 触发
    };
  };
  
  schedule: {
    frequency_minutes: number;     // 检查频率
    only_business_hours?: boolean; // 仅工作时间
  };
  
  notification: {
    channels: ('email' | 'webhook' | 'wechat_work' | 'dingtalk')[];
    recipients?: string[];         // 邮件收件人
    webhook_url?: string;
  };
  
  silence_minutes: number;         // 静默期
  status: 'active' | 'paused';
}
```

---

## 模块 7：广告归因与渠道追踪

### 7.1 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| AD-001 | 渠道管理 | 创建和管理广告渠道（巨量引擎/腾讯广告/百度/小红书等）|
| AD-002 | 追踪链接生成 | 生成带监测参数的追踪链接，支持渠道、活动、创意等参数 |
| AD-003 | 归因模型 | 精准归因（精确匹配设备 ID）、模糊归因（概率归因）、融合归因 |
| AD-004 | 广告效果报表 | 展现量、点击量、点击率、转化量、转化成本、ROI |
| AD-005 | 回传管理 | 支持转化数据回传到广告平台，优化广告模型 |
| AD-006 | 广告诊断 | 归因诊断、回传诊断、数据延迟诊断 |
| AD-007 | 渠道对比 | 多渠道 ROI 对比，帮助决策预算分配 |

### 7.2 追踪链接

```
格式: https://ds.io/t/{channel_id}?campaign={campaign_id}&ad={ad_id}&creative={creative_id}&redirect={落地页URL}

跳转流程:
用户点击 → 短链解析 → 记录广告点击事件 → 302 跳转到落地页 → 落地页加载 JS SDK → 用户行为跟踪
```

### 7.3 归因计算

```sql
-- 精准归因：通过 device_id 匹配广告点击和转化
WITH ad_clicks AS (
  SELECT 
    distinct_id,
    device_id,
    properties->>'campaign_id' as campaign_id,
    properties->>'channel' as channel,
    time as click_time
  FROM events 
  WHERE event_name = '$ad_click' AND time BETWEEN :start AND :end
),
conversions AS (
  SELECT 
    distinct_id,
    time as conversion_time
  FROM events
  WHERE event_name = 'purchase' AND time BETWEEN :start AND :end
)
SELECT 
  ac.channel,
  ac.campaign_id,
  COUNT(*) as attributed_conversions
FROM conversions c
JOIN ad_clicks ac 
  ON c.distinct_id = ac.distinct_id
  AND c.conversion_time BETWEEN ac.click_time AND ac.click_time + INTERVAL '7 days'
GROUP BY ac.channel, ac.campaign_id;
```

---

## 模块 8：数据导入与管理

### 8.1 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| DI-001 | 批量导入 | 通过 API 批量导入历史数据 |
| DI-002 | 导入任务管理 | 导入进度查看、失败重试、错误日志 |
| DI-003 | 实时数据监控 | 实时展示数据接入速率、延迟、错误率 |
| DI-004 | 数据校验报告 | 展示数据质量报告：字段缺失、类型不匹配、格式错误 |
| DI-005 | 导出数据 | 将事件数据导出为 Parquet/CSV 格式 |
| DI-006 | 数据采样 | 支持按事件配置采样率，从源头控制数据量 |

### 8.2 导入任务

```typescript
interface ImportJob {
  id: string;
  project_id: string;
  type: 'batch_api' | 'csv_upload' | 'file_import';
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  config: {
    file_format?: 'csv' | 'json' | 'parquet';
    field_mapping?: Record<string, string>;  // 源 → 目标字段映射
    date_range?: { start: string; end: string };
  };
  
  stats: {
    total_rows: number;
    accepted_rows: number;
    failed_rows: number;
    errors: { row: number; message: string }[];
  };
  
  created_at: TIMESTAMPTZ;
  completed_at?: TIMESTAMPTZ;
}
```

---

## 模块 9：数据校验模式

### 9.1 强校验模式

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| DC-001 | 事件预注册 | 开启后未注册的事件将被拒绝入库 |
| DC-002 | 属性类型校验 | 校验上报属性类型是否与元数据定义一致 |
| DC-003 | 属性类型自动转化 | 尝试自动转化类型（如字符串 "100" → 数值 100）|
| DC-004 | 格式规则 | 定义设备 ID 和用户 ID 的格式规则（正则表达式）|
| DC-005 | 校验面板 | 展示实时校验失败的数据详情，便于排查埋点问题 |

### 9.2 数据校验配置

```typescript
interface ValidationConfig {
  project_id: string;
  
  // 强校验模式
  strict_mode: boolean;
  
  // ID 格式规则
  id_rules: {
    user_id?: { pattern: string; example: string };
    device_id?: { pattern: string; example: string };
  };
  
  // 属性映射表（属性名 → 类型）
  property_type_mapping: Record<string, 'string' | 'number' | 'bool' | 'datetime'>;
  
  // 自动转化开关
  auto_type_conversion: boolean;
}
```

---

## API 新增

```
# 多项目管理
GET  /api/admin/projects                  项目列表
POST /api/admin/projects                  创建项目
GET  /api/admin/projects/:id              项目详情
PUT  /api/admin/projects/:id              更新项目配置
POST /api/admin/projects/:id/reset        重置项目数据

# 资产箱
POST /api/admin/projects/:id/export       导出资产包
POST /api/admin/projects/:id/import       导入资产包

# 虚拟事件/属性
GET  /api/meta/virtual-events             虚拟事件列表
POST /api/meta/virtual-events             创建虚拟事件
GET  /api/meta/virtual-properties         虚拟属性列表
POST /api/meta/virtual-properties         创建虚拟属性

# 维度表
GET  /api/dimension-tables                维度表列表
POST /api/dimension-tables                创建维度表
POST /api/dimension-tables/:id/upload     上传数据
GET  /api/dimension-tables/:id/preview    数据预览

# 权限管理
GET  /api/admin/roles                     角色列表
POST /api/admin/roles                     创建角色
GET  /api/admin/api-keys                  API Key 列表
POST /api/admin/api-keys                  创建 API Key
DELETE /api/admin/api-keys/:id            吊销 API Key

# 审计日志
GET  /api/admin/audit-logs                审计日志

# 智能预警
GET  /api/alerts                          预警规则列表
POST /api/alerts                          创建规则
GET  /api/alerts/:id/history              告警历史

# 广告归因
GET  /api/ad/channels                     渠道列表
POST /api/ad/channels                     创建渠道
POST /api/ad/tracking-link                生成追踪链接
GET  /api/ad/report                       广告效果报表

# 数据导入
GET  /api/import/jobs                     导入任务列表
POST /api/import/jobs                     创建导入任务
GET  /api/import/jobs/:id                 任务详情
GET  /api/data/monitor                    数据接入监控
GET  /api/data/validation-report          数据校验报告
```

---

## 验收标准

| # | 验收项 | 测试方法 |
|---|--------|---------|
| 1 | 创建项目后数据隔离 | 项目 A 的 SDK 数据在项目 B 查询中不可见 |
| 2 | 资产包跨项目导入 | 项目 A 导出书签，项目 B 导入后可直接使用 |
| 3 | 虚拟事件过滤正确 | 虚拟事件"大额购买"(amount>1000) 数量与 SQL 一致 |
| 4 | 虚拟属性 URL 抽取 | `parse_url` 正确提取 URL 参数 |
| 5 | 维度表关联查询 | 维度表字段可在事件分析中作为分组维度 |
| 6 | RBAC 角色权限生效 | 查看员无法创建运营计划 |
| 7 | MFA 认证 | 开启 MFA 后，登录需要 OTP 验证码 |
| 8 | 智能预警触发 | 指标超过阈值后 N 分钟内收到通知 |
| 9 | 追踪链接正确归因 | 点击追踪链接后 7 天内转化被归因到对应渠道 |
| 10 | 强校验模式下未注册事件被拒绝 | 上报未注册事件名，API 返回错误并记录 |
