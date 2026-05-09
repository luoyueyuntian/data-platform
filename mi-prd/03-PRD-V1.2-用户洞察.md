# PRD V1.2 — 用户洞察

## 1. 版本目标

增加 **路径分析、会话分析、用户画像** 三大模块，深入理解用户行为模式。

## 2. 功能清单

| 模块 | 功能 | 优先级 |
|------|------|--------|
| 路径分析 | 用户行为路径可视化（桑基图） | P0 |
| 路径分析 | 起始事件/终止事件限定 | P0 |
| 路径分析 | 路径步骤数限制 | P1 |
| 路径分析 | 路径节点筛选 | P1 |
| 会话分析 | 会话定义（超时时间） | P0 |
| 会话分析 | 会话指标（时长/深度/频率） | P0 |
| 会话分析 | 会话分布 | P1 |
| 会话分析 | 会话事件序列 | P1 |
| 用户画像 | 用户列表 | P0 |
| 用户画像 | 用户详情（属性+行为） | P0 |
| 用户画像 | 用户行为时间线 | P0 |
| 用户画像 | 用户搜索（按属性） | P1 |
| 用户画像 | 用户标签 | P1 |

---

## 3. 功能详细设计

### 3.1 路径分析

#### 3.1.1 概念说明

路径分析展示用户在产品中的行为流转路径，帮助发现：
- 用户最常走的路径
- 关键节点的分流情况
- 异常流失路径

#### 3.1.2 页面布局

```
┌──────────────────────────────────────────────────────┐
│  路径分析                                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 配置区域                                       │   │
│  │                                               │   │
│  │  分析类型: ○从某事件开始  ○到某事件结束  ○全路径│   │
│  │                                               │   │
│  │  起始事件: [事件▼] (从某事件开始时显示)         │   │
│  │  终止事件: [事件▼] (到某事件结束时显示)         │   │
│  │                                               │   │
│  │  最大步数: [3/4/5/6/7/8 步]                    │   │
│  │  会话超时: [30分钟/1小时/自定义]                │   │
│  │                                               │   │
│  │  筛选: [排除事件▼] [+添加]                      │   │
│  │  分组: [按属性▼]                                │   │
│  │  时间: [近7天/近30天/自定义]                    │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 桑基图 (Sankey Diagram)                        │   │
│  │                                               │   │
│  │  $pageview ─────── $click (4500)              │   │
│  │       │                │                       │   │
│  │       ├── $search ─────┤                       │   │
│  │       │    (2000)      │                       │   │
│  │       │                ├── product_view (3200) │   │
│  │       │                │         │             │   │
│  │       └── $click ──────┤         ├── add_cart  │   │
│  │            (1500)      │         │    (1800)   │   │
│  │                        │         │             │   │
│  │                        └─────────┴── order     │   │
│  │                                      (900)     │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 路径明细表                                     │   │
│  │ 路径 | 用户数 | 占比 | 平均耗时                 │   │
│  │ $pageview→$click→product_view | 3200 | 32% | 2m│   │
│  │ ...                                           │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 3.1.3 业务规则

**路径定义**：
- 路径由连续的事件序列组成
- 同一会话内（基于会话超时）的事件才算连续路径
- 支持排除特定事件（如 $pageleave）

**分析类型**：
- **从某事件开始**：所有路径以指定事件为起点
- **到某事件结束**：所有路径以指定事件为终点
- **全路径**：不限制起点和终点

**步数限制**：
- 默认 5 步，最大 8 步
- 超过步数的路径被截断

#### 3.1.4 API 设计

**创建路径分析**：`POST /api/v1/analysis/path`

```json
{
  "project_id": "proj_001",
  "analysis_type": "start_from",
  "start_event": "$pageview",
  "end_event": null,
  "max_steps": 5,
  "session_timeout": 30,
  "exclude_events": ["$pageleave", "$heartbeat"],
  "filters": [
    { "property": "$url", "operator": "contains", "value": "/product" }
  ],
  "date_range": {
    "start": "2025-04-01",
    "end": "2025-04-07"
  }
}
```

**响应体**：
```json
{
  "code": 0,
  "data": {
    "nodes": [
      { "id": "$pageview", "name": "$pageview", "users": 10000 },
      { "id": "$click", "name": "$click", "users": 8000 },
      { "id": "product_view", "name": "product_view", "users": 5000 },
      { "id": "add_to_cart", "name": "add_to_cart", "users": 2500 },
      { "id": "order_created", "name": "order_created", "users": 1200 }
    ],
    "links": [
      { "source": "$pageview", "target": "$click", "users": 6000, "percentage": 0.60 },
      { "source": "$pageview", "target": "product_view", "users": 2000, "percentage": 0.20 },
      { "source": "$pageview", "target": "$search", "users": 2000, "percentage": 0.20 },
      { "source": "$click", "target": "product_view", "users": 3200, "percentage": 0.53 },
      { "source": "product_view", "target": "add_to_cart", "users": 1800, "percentage": 0.36 },
      { "source": "add_to_cart", "target": "order_created", "users": 900, "percentage": 0.50 }
    ],
    "top_paths": [
      {
        "path": ["$pageview", "$click", "product_view", "add_to_cart", "order_created"],
        "users": 900,
        "percentage": 0.09,
        "avg_duration": "00:08:30"
      }
    ]
  }
}
```

#### 3.1.5 查询引擎实现要点

```sql
-- 路径分析核心查询
-- 1. 按用户和会话分组事件序列
-- 2. 为每个事件分配序列号
-- 3. 聚合相同路径

WITH session_events AS (
  SELECT
    user_id,
    time,
    event_name,
    -- 会话分割：超过30分钟算新会话
    SUM(CASE
      WHEN time - LAG(time) OVER (PARTITION BY user_id ORDER BY time) > INTERVAL '30 minutes'
      THEN 1 ELSE 0
    END) OVER (PARTITION BY user_id ORDER BY time) AS session_id
  FROM timescale.events
  WHERE project_id = $1
    AND time >= $2 AND time < $3
    AND event_name NOT IN ('$pageleave', '$heartbeat')
),
labeled_events AS (
  SELECT
    user_id,
    session_id,
    event_name,
    ROW_NUMBER() OVER (PARTITION BY user_id, session_id ORDER BY time) AS step
  FROM session_events
),
paths AS (
  SELECT
    user_id,
    session_id,
    ARRAY_AGG(event_name ORDER BY step) AS path,
    COUNT(*) AS steps
  FROM labeled_events
  WHERE step <= 5  -- 最大步数
  GROUP BY user_id, session_id
)
SELECT
  path[1] AS step1,
  path[2] AS step2,
  path[3] AS step3,
  path[4] AS step4,
  path[5] AS step5,
  COUNT(DISTINCT user_id) AS users
FROM paths
WHERE path[1] = $4  -- 起始事件
GROUP BY step1, step2, step3, step4, step5
ORDER BY users DESC
LIMIT 100;
```

---

### 3.2 会话分析

#### 3.2.1 概念说明

会话（Session）是用户在一段时间内的一系列连续行为。会话分析帮助理解：
- 用户单次使用产品的时长
- 用户每次使用的深度（触发多少事件）
- 用户使用的频率

#### 3.2.2 页面布局

```
┌──────────────────────────────────────────────────────┐
│  会话分析                                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 配置区域                                       │   │
│  │                                               │   │
│  │  会话超时: [30分钟/1小时/自定义]                │   │
│  │  事件筛选: [+添加]                              │   │
│  │  时间: [近7天/近30天/自定义]                    │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 会话概览指标                                   │   │
│  │                                               │   │
│  │  总会话数    平均时长    平均深度    跳出率      │   │
│  │  45,000     8m 30s      5.2 事件    32%       │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 会话时长分布                                   │   │
│  │                                               │   │
│  │  ▐█                                            │   │
│  │  ▐█ ▐█                                         │   │
│  │  ▐█ ▐█ ▐█                                      │   │
│  │  ▐█ ▐█ ▐█ ▐█                                   │   │
│  │  ▐█ ▐█ ▐█ ▐█ ▐█ ▐█                             │   │
│  │  ────────────────────────                      │   │
│  │   0-30s 30s-1m 1-3m 3-10m 10-30m 30m+         │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 会话深度分布                                   │   │
│  │                                               │   │
│  │  ▐█                                            │   │
│  │  ▐█ ▐█                                         │   │
│  │  ▐█ ▐█ ▐█                                      │   │
│  │  ▐█ ▐█ ▐█ ▐█ ▐█                                │   │
│  │  ────────────────────────                      │   │
│  │   1    2    3    4    5+   (事件数)             │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 会话趋势（按天）                               │   │
│  │ 会话数 / 平均时长 / 平均深度 的折线图           │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 3.2.3 业务规则

**会话定义**：
- 默认超时时间：30 分钟
- 用户两次事件间隔超过超时时间，视为新会话
- 跳出会话：只有 1 个事件的会话

**会话指标**：
- **会话数**：总会话数量
- **平均会话时长**：所有会话时长的平均值
- **平均会话深度**：每个会话的平均事件数
- **跳出率**：跳出会话数 / 总会话数

#### 3.2.4 API 设计

**会话分析查询**：`POST /api/v1/analysis/session`

```json
{
  "project_id": "proj_001",
  "session_timeout": 30,
  "event_filters": [],
  "date_range": {
    "start": "2025-04-01",
    "end": "2025-04-30"
  }
}
```

**响应体**：
```json
{
  "code": 0,
  "data": {
    "summary": {
      "total_sessions": 45000,
      "avg_duration": "00:08:30",
      "avg_depth": 5.2,
      "bounce_rate": 0.32
    },
    "duration_distribution": [
      { "bucket": "0-30s", "sessions": 5000, "percentage": 0.11 },
      { "bucket": "30s-1m", "sessions": 6000, "percentage": 0.13 },
      { "bucket": "1-3m", "sessions": 9000, "percentage": 0.20 },
      { "bucket": "3-10m", "sessions": 12000, "percentage": 0.27 },
      { "bucket": "10-30m", "sessions": 8000, "percentage": 0.18 },
      { "bucket": "30m+", "sessions": 5000, "percentage": 0.11 }
    ],
    "depth_distribution": [
      { "bucket": "1", "sessions": 14400, "percentage": 0.32 },
      { "bucket": "2-3", "sessions": 13500, "percentage": 0.30 },
      { "bucket": "4-5", "sessions": 9000, "percentage": 0.20 },
      { "bucket": "6-10", "sessions": 5400, "percentage": 0.12 },
      { "bucket": "10+", "sessions": 2700, "percentage": 0.06 }
    ],
    "daily_trend": [
      {
        "date": "2025-04-01",
        "sessions": 1500,
        "avg_duration": 480,
        "avg_depth": 5.1
      }
    ]
  }
}
```

---

### 3.3 用户画像

#### 3.3.1 概念说明

用户画像是单个用户的完整视图，包括：
- 用户属性（姓名、年龄、渠道等）
- 行为事件历史
- 关键指标（总事件数、首次/最近活跃时间等）

#### 3.3.2 用户列表页

```
┌──────────────────────────────────────────────────────┐
│  用户管理                                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 搜索区域                                       │   │
│  │                                               │   │
│  │  [搜索: 用户ID/姓名/邮箱...]                    │   │
│  │  筛选: [属性▼] [条件▼] [值▼]  [+添加筛选]      │   │
│  │  排序: [最近活跃/首次访问/事件数▼]              │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 用户列表                                       │   │
│  │                                               │   │
│  │  用户ID     | 姓名  | 渠道    | 最近活跃 | 事件数│   │
│  │  u_001      | 张三  | organic | 2h前    | 156   │   │
│  │  u_002      | 李四  | paid    | 1d前    | 89    │   │
│  │  u_003      | 王五  | organic | 3d前    | 234   │   │
│  │  ...                                         │   │
│  │                                               │   │
│  │  分页: [< 1 2 3 ... 100 >]                    │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 3.3.3 用户详情页

```
┌──────────────────────────────────────────────────────┐
│  用户详情: u_001 (张三)                               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────┐  ┌───────────────────────┐  │
│  │ 基本信息             │  │ 关键指标              │  │
│  │                     │  │                       │  │
│  │  用户ID: u_001      │  │  总事件数: 156        │  │
│  │  姓名: 张三         │  │  首次访问: 2025-03-01 │  │
│  │  渠道: organic      │  │  最近活跃: 2h前       │  │
│  │  VIP等级: 3         │  │  活跃天数: 45         │  │
│  │  设备: iPhone 16    │  │  总消费: ¥2,340       │  │
│  │  城市: 北京         │  │  订单数: 8            │  │
│  │                     │  │                       │  │
│  │  [编辑属性]         │  │                       │  │
│  └─────────────────────┘  └───────────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 用户标签                                       │   │
│  │ [高价值用户] [活跃用户] [手机用户] [+添加标签]   │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 行为时间线                                     │   │
│  │                                               │   │
│  │  今天 14:30  order_paid  {amount: 299, ...}   │   │
│  │  今天 14:28  order_created {order_id: ...}    │   │
│  │  今天 14:20  add_to_cart {product_id: P001}   │   │
│  │  今天 14:15  product_view {product_id: P001}  │   │
│  │  昨天 10:00  $pageview {url: /home}           │   │
│  │  ...                                         │   │
│  │                                               │   │
│  │  [加载更多]                                    │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 活跃日历                                       │   │
│  │ (热力图显示用户每天的活跃程度)                   │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 3.3.4 API 设计

**用户列表**：`GET /api/v1/users`

```json
// Query Params
{
  "project_id": "proj_001",
  "search": "张三",
  "filters": [
    { "property": "vip_level", "operator": ">=", "value": 3 }
  ],
  "sort_by": "last_seen_at",
  "sort_order": "desc",
  "page": 1,
  "page_size": 20
}
```

**用户详情**：`GET /api/v1/users/:user_id`

**响应体**：
```json
{
  "code": 0,
  "data": {
    "user_id": "u_001",
    "distinct_id": "d_abc123",
    "properties": {
      "name": "张三",
      "channel": "organic",
      "vip_level": 3,
      "device": "iPhone 16",
      "city": "北京"
    },
    "stats": {
      "total_events": 156,
      "first_seen_at": "2025-03-01T10:00:00Z",
      "last_seen_at": "2025-04-30T14:30:00Z",
      "active_days": 45,
      "total_payment": 2340,
      "order_count": 8
    },
    "tags": ["高价值用户", "活跃用户", "手机用户"]
  }
}
```

**用户事件时间线**：`GET /api/v1/users/:user_id/events`

```json
// Query Params
{
  "page": 1,
  "page_size": 50,
  "event_filter": "order_created"
}
```

**响应体**：
```json
{
  "code": 0,
  "data": {
    "events": [
      {
        "event_name": "order_paid",
        "time": "2025-04-30T14:30:00Z",
        "properties": {
          "amount": 299,
          "order_id": "ORD001"
        }
      }
    ],
    "total": 156,
    "page": 1,
    "page_size": 50
  }
}
```

#### 3.3.5 查询引擎实现要点

```sql
-- 用户列表查询
SELECT
  u.user_id,
  u.properties->>'name' AS name,
  u.properties->>'channel' AS channel,
  u.last_seen_at,
  u.properties->>'event_count' AS event_count
FROM public.users u
WHERE u.project_id = $1
  AND (
    u.user_id ILIKE '%' || $2 || '%'
    OR u.properties->>'name' ILIKE '%' || $2 || '%'
    OR u.properties->>'email' ILIKE '%' || $2 || '%'
  )
  AND (u.properties->>'vip_level')::int >= 3
ORDER BY u.last_seen_at DESC
LIMIT 20 OFFSET 0;

-- 用户事件时间线
SELECT
  event_name,
  time,
  properties
FROM timescale.events
WHERE project_id = $1
  AND user_id = $2
ORDER BY time DESC
LIMIT 50;
```

---

## 4. 导航更新

```
[事件分析] [漏斗分析] [留存分析] [分布分析] [路径分析] [会话分析]
                                                         ↑ 新增
```

用户管理入口在侧边栏：`[用户管理]`

---

## 5. 验收标准

### 5.1 路径分析验收

- [ ] 桑基图正确展示用户行为路径
- [ ] 能设置起始/终止事件
- [ ] 路径步数限制生效
- [ ] 排除事件功能正常
- [ ] 路径明细表正确显示

### 5.2 会话分析验收

- [ ] 会话超时配置生效
- [ ] 会话指标（时长/深度/跳出率）计算正确
- [ ] 会话时长分布图正确显示
- [ ] 会话深度分布图正确显示
- [ ] 会话趋势图正确显示

### 5.3 用户画像验收

- [ ] 用户列表搜索和筛选功能正常
- [ ] 用户详情页正确展示属性和指标
- [ ] 用户事件时间线正确显示
- [ ] 用户标签管理功能正常
- [ ] 活跃日历热力图正确显示
