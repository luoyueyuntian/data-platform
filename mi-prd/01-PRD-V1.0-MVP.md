# PRD V1.0 — MVP（最小可用版本）

## 1. 版本目标

跑通 **数据采集 → 数据存储 → 事件分析 → 看板展示** 的完整链路，验证核心架构可行性。

## 2. 功能清单

| 模块 | 功能 | 优先级 |
|------|------|--------|
| 数据采集 | Web JS SDK | P0 |
| 数据采集 | Server SDK（Node.js） | P0 |
| 数据采集 | 数据接收 API（HTTP） | P0 |
| 数据建模 | 事件表 + 属性存储 | P0 |
| 数据建模 | 用户属性管理 | P0 |
| 数据建模 | 事件元数据管理（事件/属性定义） | P1 |
| 事件分析 | 事件趋势分析 | P0 |
| 事件分析 | 事件筛选（属性过滤） | P0 |
| 事件分析 | 分组（按属性拆分） | P0 |
| 事件分析 | 指标（PV/UV/人均次数） | P0 |
| 事件分析 | 时间对比 | P1 |
| 看板 | 看板创建/编辑/删除 | P0 |
| 看板 | 图表组件（折线/柱状/饼图/数值） | P0 |
| 看板 | 图表拖拽布局 | P1 |
| 平台管理 | 项目管理 | P0 |
| 平台管理 | 用户注册/登录 | P0 |
| 平台管理 | 角色权限（管理员/分析师/查看者） | P1 |

---

## 3. 功能详细设计

### 3.1 数据采集

#### 3.1.1 数据接收 API

**接口**：`POST /api/v1/track`

**请求体**：
```json
{
  "type": "track",
  "event": "product_viewed",
  "properties": {
    "product_id": "P001",
    "product_name": "iPhone 16",
    "price": 7999,
    "category": "手机",
    "$referrer": "https://google.com",
    "$url": "https://example.com/product/P001",
    "$ip": "1.2.3.4"
  },
  "distinct_id": "d_abc123",
  "user_id": "u_001",
  "time": 1715232000000,
  "project": "default"
}
```

**字段说明**：
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定为 `track` |
| event | string | 是 | 事件名称，以字母开头，只含字母/数字/下划线 |
| properties | object | 否 | 事件属性，支持任意 KV |
| distinct_id | string | 是* | 设备 ID（与 user_id 至少填一个） |
| user_id | string | 是* | 登录用户 ID |
| time | number | 否 | 事件时间戳（毫秒），默认服务器当前时间 |
| project | string | 否 | 项目标识，默认 `default` |

**特殊属性（$ 开头）**：
| 属性 | 说明 |
|------|------|
| $ip | 客户端 IP（服务端解析地理位置） |
| $url | 页面 URL |
| $referrer | 来源页面 |
| $user_agent | 浏户端 UA |
| $screen_width | 屏幕宽度 |
| $screen_height | 屏幕高度 |
| $os | 操作系统 |
| $browser | 浏览器 |
| $lib | SDK 来源 |

**批量接口**：`POST /api/v1/track_batch`
```json
{
  "project": "default",
  "data": [
    { "type": "track", "event": "...", ... },
    { "type": "track", "event": "...", ... }
  ]
}
```

**响应**：
```json
{ "code": 0, "message": "ok" }
```

**错误码**：
| code | 说明 |
|------|------|
| 0 | 成功 |
| 400 | 参数错误 |
| 401 | 认证失败（无效的 project token） |
| 429 | 频率限制 |
| 500 | 服务端错误 |

**认证方式**：
- Header: `X-Project-Token: <project_token>`
- 每个项目有独立的 token，在项目设置中生成

**频率限制**：
- 单项目：1000 QPS
- 超限返回 429

#### 3.1.2 Web JS SDK

**引入方式**：
```html
<script src="https://cdn.example.com/sdk/v1/sa.min.js"></script>
<script>
  sa.init({
    serverUrl: 'https://api.example.com',
    project: 'default',
    token: 'your_project_token'
  });
</script>
```

**核心 API**：
```javascript
// 初始化
sa.init({ serverUrl, project, token, autoTrack?: boolean })

// 自动采集（autoTrack 开启时）：
// $pageview — 页面浏览
// $click — 点击事件（带 data-sa-click 属性的元素）

// 手动埋点
sa.track('order_created', {
  order_id: 'ORD001',
  amount: 99.99,
  items: ['P001', 'P002']
})

// 用户登录后绑定 user_id
sa.identify('user_001')

// 设置用户属性
sa.profileSet({
  name: '张三',
  gender: 'male',
  age: 28,
  vip_level: 3
})

// 设置单个用户属性
sa.profileSetOnce({ first_visit_date: '2025-01-01' })

// 数值类型属性累加
sa.profileIncrement({ login_count: 1, total_payment: 99.99 })
```

**自动采集属性**：
| 属性 | 说明 |
|------|------|
| $url | 当前页面 URL |
| $title | 页面标题 |
| $referrer | 来源页面 |
| $user_agent | 浏览器 UA |
| $screen_width | 屏幕宽度 |
| $screen_height | 屏幕高度 |
| $lib | 固定为 `js` |
| $lib_version | SDK 版本号 |

**数据发送策略**：
- 默认批量发送，每 6 秒或积攒 5 条后发送
- 页面关闭前使用 `sendBeacon` 发送剩余数据
- 支持 `sa.flush()` 手动触发发送

#### 3.1.3 Server SDK（Node.js）

```typescript
import { SensorsAnalytics } from '@ssas/sdk';

const sa = new SensorsAnalytics({
  serverUrl: 'https://api.example.com',
  project: 'default',
  token: 'your_project_token'
});

// 埋点
sa.track('user_id_001', 'order_created', {
  order_id: 'ORD001',
  amount: 99.99
});

// 用户属性
sa.profileSet('user_id_001', {
  name: '张三',
  vip_level: 3
});

// 批量发送
await sa.flush();
```

---

### 3.2 数据存储

#### 3.2.1 事件表（TimescaleDB）

```sql
-- 时序数据表
CREATE TABLE timescale.events (
  id BIGSERIAL,
  event_id VARCHAR(36) NOT NULL,
  event_name VARCHAR(128) NOT NULL,
  user_id VARCHAR(128),
  distinct_id VARCHAR(128) NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建 hypertable
SELECT create_hypertable('events', 'time');

-- 索引
CREATE INDEX idx_events_project_event ON events (project_id, event_name, time DESC);
CREATE INDEX idx_events_user ON events (project_id, user_id, time DESC);
CREATE INDEX idx_events_distinct ON events (project_id, distinct_id, time DESC);
CREATE INDEX idx_events_properties ON events USING GIN (properties);
```

#### 3.2.2 用户表（PostgreSQL）

```sql
CREATE TABLE public.users (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(128),
  distinct_id VARCHAR(128) NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, distinct_id)
);

CREATE INDEX idx_users_project ON users (project_id);
CREATE INDEX idx_users_user_id ON users (project_id, user_id);
CREATE INDEX idx_users_properties ON users USING GIN (properties);
```

#### 3.2.3 事件定义表（PostgreSQL）

```sql
-- 事件定义（用于管理后台展示事件列表）
CREATE TABLE public.event_definitions (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  event_name VARCHAR(128) NOT NULL,
  display_name VARCHAR(256),
  description TEXT,
  count BIGINT DEFAULT 0,       -- 累计触发次数
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, event_name)
);

-- 属性定义
CREATE TABLE public.property_definitions (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  event_name VARCHAR(128),       -- NULL 表示通用属性
  property_name VARCHAR(128) NOT NULL,
  display_name VARCHAR(256),
  property_type VARCHAR(32) NOT NULL, -- string/number/boolean/date/array
  count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, event_name, property_name)
);
```

---

### 3.3 事件分析模块

#### 3.3.1 页面布局

```
┌──────────────────────────────────────────────────────┐
│  [分析] [漏斗] [留存] [分布] [路径] ...  ← 导航栏    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────┐  ┌───────────────────────┐  │
│  │ 指标选择区           │  │ 筛选条件              │  │
│  │ [事件▼] [指标▼]      │  │ [属性▼] [条件▼] [值▼] │  │
│  │ + 添加指标            │  │ + 添加筛选             │  │
│  └─────────────────────┘  └───────────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 分组条件                                      │   │
│  │ [按属性▼] [属性值▼]   + 添加分组               │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 时间选择器                                     │   │
│  │ [今天/近7天/近30天/自定义] [对比: 上一周期▼]     │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │                                               │   │
│  │              图表展示区域                       │   │
│  │          (折线图/柱状图/表格)                   │   │
│  │                                               │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 数据明细表格                                   │   │
│  │ 日期 | 指标值 | 对比值 | 变化率                 │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  [保存为图表] [添加到看板] [导出 CSV]                  │
└──────────────────────────────────────────────────────┘
```

#### 3.3.2 功能定义

**指标类型**：
| 指标 | 说明 | 计算方式 |
|------|------|----------|
| 总次数 | 事件触发总次数 | COUNT(*) |
| 用户数 | 触发事件的独立用户数 | COUNT(DISTINCT user_id) |
| 人均次数 | 每个用户平均触发次数 | 总次数 / 用户数 |

**筛选条件**：
- 支持多条件 AND 组合
- 操作符：`=`, `!=`, `>`, `<`, `>=`, `<=`, `包含`, `不包含`, `有值`, `无值`, `正则匹配`
- 属性值类型：字符串、数字、布尔、日期

**分组**：
- 最多按 2 个属性分组
- 分组后每个组独立显示一条折线/柱状

**时间范围**：
- 预设：今天、昨天、近 7 天、近 30 天、近 90 天
- 自定义：日期选择器
- 粒度：按小时、按天、按周、按月（根据时间范围自动选择）

**时间对比**：
- 上一周期（如近 7 天 vs 前 7 天）
- 上一时间段（如本周一-周五 vs 上周一-周五）
- 自定义对比时间段

#### 3.3.3 API 设计

**分析查询接口**：`POST /api/v1/analysis/event`

**请求体**：
```json
{
  "project_id": "proj_001",
  "event_name": "order_created",
  "metrics": ["total", "unique_users", "avg_per_user"],
  "filters": [
    {
      "property": "price",
      "operator": ">=",
      "value": 100
    },
    {
      "property": "category",
      "operator": "in",
      "value": ["手机", "电脑"]
    }
  ],
  "group_by": ["category"],
  "date_range": {
    "start": "2025-04-01",
    "end": "2025-04-30",
    "granularity": "day"
  },
  "compare": {
    "type": "previous_period"
  }
}
```

**响应体**：
```json
{
  "code": 0,
  "data": {
    "chart_type": "line",
    "series": [
      {
        "name": "手机",
        "data": [
          { "date": "2025-04-01", "total": 156, "unique_users": 89, "avg_per_user": 1.75 },
          { "date": "2025-04-02", "total": 178, "unique_users": 102, "avg_per_user": 1.74 }
        ],
        "compare_data": [
          { "date": "2025-03-25", "total": 140, "unique_users": 80, "avg_per_user": 1.75 }
        ]
      },
      {
        "name": "电脑",
        "data": [ ... ]
      }
    ],
    "summary": {
      "total": 4567,
      "unique_users": 2345,
      "avg_per_user": 1.95,
      "compare_total": 4100,
      "compare_change": 0.114
    }
  }
}
```

#### 3.3.4 查询引擎实现要点

```sql
-- 事件趋势查询（简化示例）
SELECT
  time_bucket('1 day', time) AS bucket,
  properties->>'category' AS group_key,
  COUNT(*) AS total,
  COUNT(DISTINCT user_id) AS unique_users,
  ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT user_id), 0), 2) AS avg_per_user
FROM timescale.events
WHERE project_id = $1
  AND event_name = $2
  AND time >= $3 AND time < $4
  AND (properties->>'price')::numeric >= 100
  AND properties->>'category' IN ('手机', '电脑')
GROUP BY bucket, group_key
ORDER BY bucket;
```

---

### 3.4 看板模块

#### 3.4.1 看板管理

**看板列表页**：
- 显示所有已创建的看板
- 支持搜索、收藏、排序
- 每个看板卡片显示：名称、描述、创建者、最后更新时间、图表数量

**看板详情页**：
- 自由布局（拖拽排列图表）
- 支持添加/删除/调整图表大小
- 全屏模式
- 自动刷新（可配置间隔：关闭/5s/15s/30s/1m/5m）

#### 3.4.2 图表组件

| 图表类型 | 适用场景 | 配置项 |
|----------|----------|--------|
| 折线图 | 趋势分析 | 平滑/阶梯, 填充, 多Y轴 |
| 柱状图 | 对比分析 | 堆叠, 水平/垂直 |
| 饼图 | 占比分析 | 环形, 标签显示 |
| 数值卡片 | 关键指标 | 前缀, 后缀, 对比值, 趋势箭头 |
| 表格 | 明细数据 | 排序, 分页, 导出 |

#### 3.4.3 API 设计

**看板 CRUD**：
```
GET    /api/v1/dashboards                    # 列表
POST   /api/v1/dashboards                    # 创建
GET    /api/v1/dashboards/:id                # 详情
PUT    /api/v1/dashboards/:id                # 更新
DELETE /api/v1/dashboards/:id                # 删除
POST   /api/v1/dashboards/:id/charts         # 添加图表
PUT    /api/v1/dashboards/:id/charts/:chartId # 更新图表
DELETE /api/v1/dashboards/:id/charts/:chartId # 删除图表
```

**创建看板请求体**：
```json
{
  "name": "核心业务指标",
  "description": "每日核心业务数据概览",
  "layout": {
    "cols": 12,
    "row_height": 80
  }
}
```

**添加图表请求体**：
```json
{
  "name": "日订单量趋势",
  "type": "line",
  "position": { "x": 0, "y": 0, "w": 6, "h": 4 },
  "query": {
    "event_name": "order_created",
    "metrics": ["total"],
    "date_range": { "type": "last_30_days" },
    "granularity": "day"
  },
  "options": {
    "smooth": true,
    "show_area": true
  }
}
```

---

### 3.5 平台管理

#### 3.5.1 用户认证

**注册**：
```
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "张三"
}
```

**登录**：
```
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
Response: { "token": "jwt_token", "user": { ... } }
```

**JWT Payload**：
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "name": "张三",
  "project_id": "proj_001",
  "role": "admin",
  "iat": 1715232000,
  "exp": 1715318400
}
```

#### 3.5.2 项目管理

```
POST   /api/v1/projects              # 创建项目
GET    /api/v1/projects              # 项目列表
GET    /api/v1/projects/:id          # 项目详情
PUT    /api/v1/projects/:id          # 更新项目
POST   /api/v1/projects/:id/token    # 重新生成 token
```

**创建项目请求体**：
```json
{
  "name": "我的 App",
  "description": "主项目",
  "timezone": "Asia/Shanghai"
}
```

#### 3.5.3 角色权限

| 角色 | 事件分析 | 看板管理 | 项目设置 | 用户管理 |
|------|----------|----------|----------|----------|
| admin | 读写 | 读写 | 读写 | 读写 |
| analyst | 读写 | 读写 | 只读 | 无 |
| viewer | 只读 | 只读 | 无 | 无 |

---

## 4. 页面路由

```
/login                          # 登录页
/register                       # 注册页
/                               # 首页 → 重定向到 /dashboard
/dashboard                      # 看板列表
/dashboard/:id                  # 看板详情
/analysis                       # 事件分析
/management/events              # 事件管理（事件列表）
/management/users               # 用户管理（用户列表/画像）
/management/properties          # 属性管理
/settings                       # 设置
/settings/project               # 项目设置
/settings/members               # 成员管理
```

---

## 5. 技术实现要求

### 5.1 数据接收层

- 使用 Kafka 作为消息队列，解耦数据接收和写入
- Worker 服务消费 Kafka 消息，批量写入 TimescaleDB
- 写入批次大小：500 条或 5 秒超时

### 5.2 查询性能

- 单日查询（1 天数据，单事件）：< 3 秒
- 月度查询（30 天数据，单事件）：< 10 秒
- 使用 Redis 缓存热查询结果（TTL 5 分钟）

### 5.3 数据量预估

- 单项目日均事件量：100 万
- 数据保留策略：原始数据保留 90 天，聚合数据保留 1 年

---

## 6. 验收标准

### 6.1 数据采集验收

- [ ] Web SDK 能正确发送事件到服务端
- [ ] Server SDK 能正确发送事件到服务端
- [ ] 批量接口能处理 500 条/批次
- [ ] 事件属性支持 string/number/boolean/array 类型
- [ ] 用户属性能正确更新和合并

### 6.2 事件分析验收

- [ ] 能选择事件和指标进行查询
- [ ] 筛选条件支持所有定义的操作符
- [ ] 分组后图表正确显示多条线/柱
- [ ] 时间对比功能正确显示对比数据
- [ ] 查询结果可导出为 CSV

### 6.3 看板验收

- [ ] 能创建/编辑/删除看板
- [ ] 能添加/编辑/删除图表
- [ ] 图表支持拖拽调整位置和大小
- [ ] 数值卡片显示正确
- [ ] 看板支持自动刷新

### 6.4 平台管理验收

- [ ] 用户能注册和登录
- [ ] JWT 认证正确工作
- [ ] 项目 token 能正确验证
- [ ] 权限控制正确（不同角色看到不同功能）
