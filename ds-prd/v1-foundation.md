# DS V1.0 PRD — 基础数据接入与分析

## 版本范围

V1.0 是 DS 平台的第一个可交付版本，覆盖数据采集到基础分析的完整闭环。

| 模块 | 优先级 | 工作量估算 |
|------|--------|-----------|
| 数据 SDK（JS/服务端） | P0 | 3 周 |
| HTTP 数据接入服务 | P0 | 2 周 |
| 元数据管理 | P0 | 1 周 |
| 事件分析 | P0 | 3 周 |
| 漏斗分析 | P0 | 2 周 |
| 留存分析 | P1 | 2 周 |
| 用户管理 | P1 | 1 周 |
| **合计** | | **8 周** |

---

## 模块 1：数据 SDK

### 1.1 JS SDK（Web 端采集）

#### 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| SDK-JS-001 | 自动采集页面浏览 | 页面加载时自动采集 `$pageview` 事件，包含 `$url`、`$referrer`、`$title`、`$browser`、`$os`、`$screen_width`、`$screen_height` 等预置属性 |
| SDK-JS-002 | 自动采集元素点击 | 自动采集带 `data-ds-track` 属性的元素点击事件，采集 `$element_content`、`$element_class`、`$element_id`、`$element_type`、`$element_position` |
| SDK-JS-003 | 自定义事件追踪 | `ds.track(eventName, properties?)` API 手动触发事件 |
| SDK-JS-004 | 用户标识 | `ds.login(userId)` 设置登录 ID；`ds.identify(anonymousId)` 设置匿名 ID |
| SDK-JS-005 | 用户属性设置 | `ds.profileSet(properties)` 设置用户属性；`ds.profileSetOnce(properties)` 设置一次性用户属性 |
| SDK-JS-006 | 公共属性 | `ds.register(properties)` 设置每个事件都携带的公共属性 |
| SDK-JS-007 | Debug 模式 | `ds.init({ debug: true })` 开启后实时打印上报数据及校验结果 |
| SDK-JS-008 | 离线缓存 | 网络断开时缓存事件（上限 1000 条），重连后按序发送 |
| SDK-JS-009 | 采样 | `ds.init({ sampleRate: 0.5 })` 支持全局采样率配置 |
| SDK-JS-010 | 数据上报 | 批量上报（每 5 秒或每 10 条合并发送），使用 HTTP POST 到指定数据接收地址 |

#### 初始化配置

```typescript
interface DSOptions {
  serverUrl: string;           // 数据接收地址
  projectId: string;           // 项目 ID
  debug?: boolean;             // 是否 Debug 模式
  sampleRate?: number;         // 采样率 0-1
  autoTrack?: {                // 自动采集配置
    pageview?: boolean;        // 自动采集页面浏览
    click?: boolean;           // 自动采集点击 (data-ds-track)
  };
  maxCacheLength?: number;     // 离线缓存上限
  sendTimeout?: number;        // 发送超时 (ms)
  useAppTracking?: boolean;    // 是否开启自动采集 App 内嵌 WebView
}
```

#### 预置属性

| 属性名 | 类型 | 说明 | 来源 |
|--------|------|------|------|
| `$time` | Datetime | 事件时间 | SDK 自动 |
| `$user_id` | String | 登录用户 ID | `ds.login()` |
| `$anonymous_id` | String | 匿名设备 ID | SDK 自动生成 |
| `$url` | String | 页面 URL | SDK 自动 |
| `$referrer` | String | 页面来源 | SDK 自动 |
| `$title` | String | 页面标题 | SDK 自动 |
| `$browser` | String | 浏览器名称 | SDK 自动 |
| `$browser_version` | String | 浏览器版本 | SDK 自动 |
| `$os` | String | 操作系统 | SDK 自动 |
| `$os_version` | String | 操作系统版本 | SDK 自动 |
| `$device_id` | String | 设备 ID | Cookie/LocalStorage |
| `$screen_width` | Number | 屏幕宽度 | SDK 自动 |
| `$screen_height` | Number | 屏幕高度 | SDK 自动 |
| `$is_first_day` | Boolean | 是否首次访问 | SDK 自动 |
| `$is_first_time` | Boolean | 是否首次触发事件 | SDK 自动 |
| `$ip` | String | IP 地址 | 服务端解析 |
| `$country` | String | 国家 | 服务端 IP 解析 |
| `$province` | String | 省份 | 服务端 IP 解析 |
| `$city` | String | 城市 | 服务端 IP 解析 |
| `$lib` | String | SDK 类型 | SDK 自动 |
| `$lib_version` | String | SDK 版本 | SDK 自动 |

### 1.2 服务端 SDK（Java/TypeScript）

#### 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| SDK-SV-001 | 服务端事件追踪 | `track(eventName, properties, userId)` API |
| SDK-SV-002 | 用户属性设置 | `profileSet(userId, properties)` / `profileSetOnce(userId, properties)` |
| SDK-SV-003 | 批量发送 | 支持批量发送模式（累积一定数量/时间后自动发送） |
| SDK-SV-004 | 日志输出 | 支持输出到本地日志文件，配合 LogAgent 消费 |
| SDK-SV-005 | 异步非阻塞 | 发送不阻塞主业务流程 |
| SDK-SV-006 | 错误重试 | 发送失败自动重试 3 次，间隔 1s/2s/4s |

#### 关键 API

```typescript
// TypeScript 服务端 SDK
export class DSAnalytics {
  constructor(config: { serverUrl: string; projectId: string; timeout?: number });
  
  track(eventName: string, properties?: Record<string, any>, userId?: string): Promise<void>;
  profileSet(userId: string, properties: Record<string, any>): Promise<void>;
  profileSetOnce(userId: string, properties: Record<string, any>): Promise<void>;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}
```

---

## 模块 2：HTTP 数据接入服务

### 2.1 数据接收 API

#### `POST /api/sdk/track`

接收 SDK 上报的数据，写入 Kafka 事件流。

**Request Body**：
```json
{
  "project_id": "proj_xxx",
  "events": [
    {
      "event": "$pageview",
      "time": 1700000000000,
      "distinct_id": "anon_xxxx",
      "user_id": "user_123",
      "properties": {
        "$url": "https://example.com/home",
        "$browser": "Chrome",
        "$os": "macOS",
        "product_id": 10001,
        "price": 99.9
      },
      "lib": { "type": "js", "version": "1.0.0" }
    }
  ]
}
```

**Response**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "accepted_count": 1,
    "invalid_count": 0,
    "errors": []
  }
}
```

### 2.2 Debug 模式 API

#### `POST /api/sdk/debug`

逐条校验并返回数据质量结果，不写入生产队列。

**Response**（扩展了校验信息）：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "valid": true,
    "validations": [
      {
        "event": "purchase",
        "status": "invalid",
        "errors": [
          { "field": "properties.amount", "message": "属性类型不匹配，期望 Number，收到 String" }
        ]
      }
    ]
  }
}
```

### 2.3 数据校验规则

| 校验项 | 规则 |
|--------|------|
| 事件名 | 非空，长度 1-128 字符，仅含中文、英文、数字、下划线 |
| 时间戳 | 13 位毫秒时间戳，偏差不超过当前时间的 ±24 小时 |
| distinct_id | 非空，长度 1-255 字符 |
| 属性名 | 非空，长度 1-128 字符 |
| 属性类型 | 首次接收后确定，后续类型不匹配则整条拒绝 |
| 预置属性 | 不可覆盖，SDK 发送的预置属性自动合并，用户发送的预置属性被忽略 |

### 2.4 数据流转

```
SDK → HTTP API → Kafka Topic(events) → Stream Processor → TimescaleDB
                                           ↓
                                      Topic(validation_errors) → Error Log
```

---

## 模块 3：元数据管理

### 3.1 元事件管理

#### 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| MD-001 | 元事件列表 | 展示所有已注册事件的列表，包含事件名、显示名、类型、入库状态、创建时间 |
| MD-002 | 创建元事件 | 可选填入：事件名（英文标识）、显示名（中文名称）、描述、标签、应埋平台（Web/iOS/Android/小程序/服务端） |
| MD-003 | 编辑元事件 | 修改显示名、描述、标签等，事件名不可修改 |
| MD-004 | 禁用/启用 | 禁用后对应事件数据仍然入库但不参与分析 |
| MD-005 | 批量操作 | 批量标签、批量导出、批量删除 |
| MD-006 | Excel 导入 | 支持批量导入元事件定义 |
| MD-007 | 事件分类 | 二级分类管理，支持拖拽排序，支持隐藏特殊事件 |

#### 元事件表结构

```sql
CREATE TABLE meta_events (
  id            VARCHAR(32) PRIMARY KEY,
  project_id    VARCHAR(32) NOT NULL,
  name          VARCHAR(128) NOT NULL,       -- 事件名（英文标识）
  display_name  VARCHAR(256),                -- 显示名（中文）
  description   TEXT,
  event_type    VARCHAR(32) DEFAULT 'custom', -- custom | preset | virtual
  platforms     JSONB,                       -- ["web", "ios", "android", "miniapp", "server"]
  status        VARCHAR(16) DEFAULT 'active', -- active | disabled | archived
  tags          JSONB DEFAULT '[]',
  category_id   VARCHAR(32),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);
```

### 3.2 事件属性管理

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| MD-008 | 属性列表 | 展示事件属性、属性类型（String/Number/Bool/Datetime/List）、所属事件、示例值 |
| MD-009 | 创建属性 | 属性名、显示名、数据类型、单元/格式、示例值、是否必填 |
| MD-010 | 类型不可修改 | 属性数据类型由首次定义确定，后续不可更改 |

### 3.3 用户属性管理

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| MD-011 | 用户属性列表 | 查看所有用户属性定义 |
| MD-012 | 创建用户属性 | 同上属性管理 |

---

## 模块 4：事件分析

### 4.1 功能规格

事件分析是整个平台最核心的分析模型，支持对用户行为的任意维度组合分析。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| EA-001 | 指标选择 | 支持选择事件 → 选择聚合指标（总次数/总人数/去重数/人均次数/总和/均值/最大值/最小值） |
| EA-002 | 筛选条件 | 支持按事件属性、用户属性、用户分群进行筛选，支持 AND/OR 组合 |
| EA-003 | 分组维度 | 支持按事件属性、用户属性、时间（分钟/小时/日/周/月/季度）分组 |
| EA-004 | 时间范围 | 支持相对时间（今天/昨天/近 7 天/近 30 天/近 90 天/自定义）和绝对时间 |
| EA-005 | 显示方式 | 趋势图（折线）、排行（柱状）、明细表格 |
| EA-006 | 下钻 | 点击图表数据点可按下一维度下钻 |
| EA-007 | 对比 | 支持环比、同比，多指标对比叠加 |
| EA-008 | 总数切换 | 切换查看 UV（独立用户数）或 PV（事件发生次数） |
| EA-009 | 结果保存 | 保存为书签，支持分享 |

### 4.2 指标计算规则

| 指标 | 计算方式 | SQL 示例 |
|------|---------|---------|
| 总次数 (PV) | `COUNT(*)` | `SELECT COUNT(*) FROM events WHERE ...` |
| 总人数 (UV) | `COUNT(DISTINCT user_id)` | `SELECT COUNT(DISTINCT user_id) FROM events WHERE ...` |
| 去重数 | `COUNT(DISTINCT property)` | `SELECT COUNT(DISTINCT property_value) FROM events WHERE ...` |
| 人均次数 | `COUNT(*) / COUNT(DISTINCT user_id)` | `SELECT COUNT(*)/COUNT(DISTINCT user_id) FROM events WHERE ...` |
| 总和 | `SUM(property)` | `SELECT SUM(amount) FROM events WHERE ...` |
| 均值 | `AVG(property)` | `SELECT AVG(amount) FROM events WHERE ...` |

### 4.3 查询 API

```
GET /api/analytics/events
  ?event_name=purchase
  &measure=total_count
  &from=2026-04-01
  &to=2026-05-01
  &group_by=hour
  &filter=[{"property":"amount","operator":">","value":100}]
  &segment=user_id
```

**Response**：
```json
{
  "code": 0,
  "data": {
    "series": [
      { "time": "2026-04-01 00:00", "value": 1234 },
      { "time": "2026-04-01 01:00", "value": 1100 }
    ],
    "total": 123456,
    "unit": "次"
  }
}
```

### 4.4 UI 布局

```
┌──────────────────────────────────────────────────────────────┐
│  [事件选择器]   [指标选择器]   [时间范围]   [对比]  [保存]   │
├──────────────────────────────────────────────────────────────┤
│  [筛选条件区域]  属性筛选 + 用户分群筛选 + AND/OR 切换      │
├──────────────────────────────────────────────────────────────┤
│  [分组维度区域]  维度选择 + 下钻链展示                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                [图表展示区]                                   │
│                折线图 / 柱状图 / 表格                         │
│                                                              │
│                悬停显示详情 / 点击下钻                        │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  总计: XXX  总次数: XXX  总人数: XXX                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 模块 5：漏斗分析

### 5.1 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| FA-001 | 步骤定义 | 定义 2-10 个分析步骤，每步选择一个事件（可附加筛选条件） |
| FA-002 | 时间范围 | 设置整个漏斗转化的时间窗口（如 1 小时/1 天/7 天/自定义） |
| FA-003 | 转化率展示 | 展示每步的转化人数、转化率、流失人数、流失率 |
| FA-004 | 趋势分析 | 展示整体转化率随时间变化趋势 |
| FA-005 | 分维度下钻 | 按任意维度（渠道/地域/设备）查看不同群体的转化差异 |
| FA-006 | 用户列表下钻 | 点击某步的转化/流失可查看对应用户列表 |
| FA-007 | 实时计算 | 新上报数据即时参与漏斗计算 |

### 5.2 漏斗计算逻辑

```
步骤1: 事件A (filter: A.attr > 10)   →  全体用户集 S1
步骤2: 事件B                            →  在 S1 中发生事件B的用户 S2  
步骤3: 事件C (filter: C.type = 'xxx')  →  在 S2 中发生事件C的用户 S3

转化率 Step1→2: |S2| / |S1| * 100%
转化率 Step2→3: |S3| / |S2| * 100%
整体转化率: |Slast| / |S1| * 100%
```

**SQL 示例**：
```sql
WITH step1 AS (
  SELECT DISTINCT user_id FROM events 
  WHERE event_name = 'view_product' AND time BETWEEN :start AND :end
),
step2 AS (
  SELECT DISTINCT e.user_id FROM events e INNER JOIN step1 s ON e.user_id = s.user_id
  WHERE e.event_name = 'add_to_cart' AND e.time BETWEEN :start AND :end
  AND e.time > s.time  -- 确保先后顺序
)
SELECT * FROM step2;
```

---

## 模块 6：留存分析

### 6.1 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| RA-001 | 初始行为定义 | 定义用户的"初始行为"事件（如注册/首次浏览） |
| RA-002 | 回访行为定义 | 定义用户的"回访行为"事件（如登录/浏览） |
| RA-003 | 留存周期 | 按日/周/月/自定义时间粒度展示留存 |
| RA-004 | 留存表 | 经典留存坐标表：行为日/N 日留存矩阵 |
| RA-005 | 留存曲线 | 留存率随天数变化趋势线 |
| RA-006 | 分组对比 | 按维度对比不同群体的留存差异 |

### 6.2 留存表计算

```
留存表（日留存）：

            Day0  Day1  Day2  Day3  Day7  Day14 Day30
04-01      1000   350   280   210   150    80     30
(初始用户数)  (次日留存率 35%)

每行：某日发生初始行为的用户集
每列：这些用户在 N 天后发生回访行为的比例
```

### 6.3 留存计算 SQL 示例

```sql
WITH initial AS (
  SELECT DISTINCT user_id, DATE_TRUNC('day', time) as first_day
  FROM events WHERE event_name = 'register' AND time BETWEEN :start AND :end
),
retention AS (
  SELECT DISTINCT i.first_day, e.user_id, 
    (DATE_TRUNC('day', e.time) - i.first_day) as day_diff
  FROM initial i
  JOIN events e ON i.user_id = e.user_id
  WHERE e.event_name = 'login' AND e.time > i.first_day
)
SELECT first_day, COUNT(DISTINCT user_id) as initial_users,
  COUNT(DISTINCT CASE WHEN day_diff = 1 THEN user_id END) as day1_users,
  COUNT(DISTINCT CASE WHEN day_diff = 2 THEN user_id END) as day2_users,
  ...
FROM retention
GROUP BY first_day;
```

---

## 模块 7：用户管理

### 7.1 用户列表

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| UM-001 | 用户列表 | 分页展示用户，显示 ID、首末次访问时间、事件次数、用户属性摘要 |
| UM-002 | 筛选 | 按用户属性、标签、事件行为筛选用户 |
| UM-003 | 搜索 | 按用户 ID、设备 ID、匿名 ID 模糊搜索 |
| UM-004 | 用户详情 | 用户基本信息卡片（属性值）、标签列表、事件序列 |
| UM-005 | 用户行为序列 | 按时间线展示该用户的所有事件，支持时间范围筛选和事件类型筛选 |

---

## 模块 8：多租户与项目管理

### 8.1 多租户数据隔离

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| TEN-001 | 项目创建 | 创建独立项目，分配独立的 project_id |
| TEN-002 | 项目隔离 | 不同项目数据完全物理隔离（独立 schema 或 tenant_id 过滤） |
| TEN-003 | 成员管理 | 项目内添加/移除成员，设置角色 |

### 8.2 数据库多租户方案

```sql
-- 所有业务表包含 project_id 字段
CREATE TABLE events_{{project_id}} (
  id            BIGSERIAL,
  project_id    VARCHAR(32) NOT NULL,
  event         VARCHAR(128) NOT NULL,
  time          TIMESTAMPTZ NOT NULL,
  user_id       VARCHAR(255),
  distinct_id   VARCHAR(255) NOT NULL,
  properties    JSONB DEFAULT '{}',
  lib_info      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  -- TimescaleDB hypertable
  PRIMARY KEY (id, time)
);

-- 转换为 TimescaleDB 超表
SELECT create_hypertable('events_{{project_id}}', 'time');
```

---

## API 总览

### 路由结构

```
/api/sdk/track           POST   数据接入（批量）
/api/sdk/debug           POST   数据接入（调试）

/api/meta/events         GET    元事件列表
/api/meta/events         POST   创建元事件
/api/meta/events/:id     GET    元事件详情
/api/meta/events/:id     PUT    编辑元事件
/api/meta/events/:id     PATCH  禁用/启用
/api/meta/events/batch   POST   批量操作

/api/meta/properties     GET    属性列表
/api/meta/properties     POST   创建属性

/api/analytics/events    GET    事件分析查询
/api/analytics/funnels   POST   漏斗分析查询
/api/analytics/retention POST   留存分析查询

/api/users               GET    用户列表
/api/users/:id           GET    用户详情
/api/users/:id/events    GET    用户行为序列
```

### 通用响应格式

```typescript
interface ApiResponse<T> {
  code: number;      // 0 成功，非 0 失败
  message: string;   // 错误信息（成功时为 "ok"）
  data: T;           // 响应数据
}
```

---

## 数据存储

### PostgreSQL 表结构

#### 元数据表

```sql
-- 项目表
CREATE TABLE projects (
  id            VARCHAR(32) PRIMARY KEY,
  name          VARCHAR(128) NOT NULL,
  description   TEXT,
  status        VARCHAR(16) DEFAULT 'active',
  config        JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 事件属性表
CREATE TABLE meta_event_properties (
  id              VARCHAR(32) PRIMARY KEY,
  project_id      VARCHAR(32) NOT NULL REFERENCES projects(id),
  event_name      VARCHAR(128),       -- null 表示全局属性
  name            VARCHAR(128) NOT NULL,
  display_name    VARCHAR(256),
  data_type       VARCHAR(16) NOT NULL, -- string | number | bool | datetime | list
  unit            VARCHAR(64),
  example_value   TEXT,
  is_required     BOOLEAN DEFAULT FALSE,
  status          VARCHAR(16) DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, event_name, name)
);

-- 用户属性表 (结构同上)
CREATE TABLE meta_user_properties (
  id              VARCHAR(32) PRIMARY KEY,
  project_id      VARCHAR(32) NOT NULL REFERENCES projects(id),
  name            VARCHAR(128) NOT NULL,
  display_name    VARCHAR(256),
  data_type       VARCHAR(16) NOT NULL,
  status          VARCHAR(16) DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);
```

### TimescaleDB 时序表

```sql
-- 每个项目一张 events 超表（或使用 project_id 分区）
CREATE TABLE events (
  id            BIGSERIAL,
  project_id    VARCHAR(32) NOT NULL,
  event         VARCHAR(128) NOT NULL,
  time          TIMESTAMPTZ NOT NULL,
  distinct_id   VARCHAR(255) NOT NULL,
  user_id       VARCHAR(255),
  properties    JSONB DEFAULT '{}',
  lib           JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, time, id)
);

-- 转换为超表
SELECT create_hypertable('events', 'time', partitioning_column => 'project_id', number_partitions => 16);

-- 创建索引
CREATE INDEX idx_events_event ON events (project_id, event, time DESC);
CREATE INDEX idx_events_user ON events (project_id, user_id, time DESC);
CREATE INDEX idx_events_distinct ON events (project_id, distinct_id, time DESC);
CREATE INDEX idx_events_properties ON events USING GIN (properties jsonb_path_ops);
```

---

## 验收标准

### 功能验收

| # | 验收项 | 测试方法 |
|---|--------|---------|
| 1 | JS SDK 成功采集页面浏览事件 | 集成 JS SDK，打开页面，观察数据接收 API 收到 `$pageview` |
| 2 | JS SDK 自定义事件上报 | 调用 `ds.track('purchase', { amount: 100 })`，确认数据入库 |
| 3 | Debug 模式返回校验结果 | `ds.init({ debug: true })` 后触发事件，控制台打印校验信息 |
| 4 | 元事件管理 CRUD | 创建/编辑/禁用元事件，列表正确展示 |
| 5 | 事件分析正确计算 PV/UV | 对已知数据集查询，结果与手工 SQL 一致 |
| 6 | 事件分析分组下钻 | 按 `$browser` 分组展示各浏览器 UV |
| 7 | 漏斗分析 3 步转化 | 定义 3 步漏斗，转化率和 SQL 计算结果一致 |
| 8 | 留存计算次日留存 | 对已知数据集，次日留存率正确 |
| 9 | 用户行为序列展示 | 查看用户详情页，行为序列按时间排列 |
| 10 | 多项目数据隔离 | 项目 A 的数据不出现在项目 B 的分析结果中 |

### 性能验收

| # | 验收项 | 目标值 |
|---|--------|-------|
| 1 | 单事件查询延迟 | < 2 秒（1 亿行数据） |
| 2 | 漏斗分析延迟 | < 5 秒（1 亿行数据） |
| 3 | 留存分析延迟 | < 5 秒（5000 万行数据） |
| 4 | 数据入库端到端延迟 | < 3 秒（99 百分位） |
| 5 | 并发查询 | 支持 20 并发查询 |
