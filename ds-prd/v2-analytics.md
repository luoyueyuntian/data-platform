# DS V2.0 PRD — 高级分析模型

## 版本范围

V2.0 在 V1.0 基础上扩展高级分析模型和用户分群能力。

| 模块 | 优先级 | 工作量估算 |
|------|--------|-----------|
| 用户路径分析 | P0 | 2 周 |
| Session 分析 | P0 | 2 周 |
| 分布分析 | P1 | 1 周 |
| 间隔分析 | P1 | 1 周 |
| 归因分析 | P1 | 2 周 |
| LTV 分析 | P1 | 2 周 |
| RFM 分析 | P2 | 1 周 |
| 用户分群 | P0 | 3 周 |
| **合计** | | **6 周** |

---

## 模块 1：用户路径分析

### 1.1 功能规格

用户路径分析展示用户在使用产品时的行为流转路径，以 Sankey 图可视化。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| PA-001 | 路径步骤数 | 支持分析 2-10 步的用户行为路径 |
| PA-002 | 起始事件 | 设置路径的起始事件（可选）|
| PA-003 | 结束事件 | 设置路径的结束事件（可选）|
| PA-004 | 事件过滤 | 筛选只包含指定事件类型的路径 |
| PA-005 | 时间范围 | 整个路径的时间窗口（如 30 分钟/1 小时/1 天）|
| PA-006 | 路径图 | Sankey 图展示用户流转：节点宽度代表用户数，连线流向代表流转方向 |
| PA-007 | 路径明细 | 点击某条路径可查看经过该路径的用户列表 |
| PA-008 | 路径聚合 | 支持"其他"节点聚合（占比过小的路径归入"其他"）|
| PA-009 | 用户筛选 | 支持按分群/属性筛选分析的用户范围 |

### 1.2 计算逻辑

```sql
-- 用户路径生成（3 步示例）
WITH user_sessions AS (
  SELECT user_id, time, event,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY time) as step
  FROM events
  WHERE project_id = :project_id 
    AND time BETWEEN :start AND :end
    AND user_id IS NOT NULL
),
paths AS (
  SELECT 
    a.event as step1,
    b.event as step2,
    c.event as step3,
    COUNT(DISTINCT a.user_id) as user_count
  FROM user_sessions a
  JOIN user_sessions b ON a.user_id = b.user_id AND b.step = a.step + 1
  JOIN user_sessions c ON b.user_id = c.user_id AND c.step = b.step + 1
  WHERE a.step = 1
  GROUP BY step1, step2, step3
)
SELECT * FROM paths ORDER BY user_count DESC;
```

### 1.3 UI 规范

- 左侧：事件配置区（起始事件、结束事件、中间事件、筛选条件）
- 右侧主区：Sankey 图
- 交互：悬停节点显示该节点用户数、悬停连线显示流转用户数、点击节点/连线下钻用户列表
- 聚合阈值：默认为 5%（即占比 < 5% 的路径归入其他），可配置

---

## 模块 2：Session 分析

### 2.1 功能规格

Session 分析将用户的行为串联为会话，分析会话级别的指标。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| SA-001 | Session 定义 | 自定义 Session 超时时间（默认 30 分钟），用户静默超过超时时间则新起 Session |
| SA-002 | Session 指标 | Session 数、人均 Session 数、Session 平均时长、Session 平均深度（事件数）|
| SA-003 | Session 趋势 | Session 相关指标随时间变化趋势 |
| SA-004 | Session 留存 | 以 Session 为单位的用户留存分析 |
| SA-005 | Session 路径 | Session 内的行为路径分析 |
| SA-006 | 分组对比 | 按渠道/地域等维度对比 Session 指标 |

### 2.2 Session 计算逻辑

```sql
-- Session 划分
WITH user_events AS (
  SELECT user_id, time, event,
    LAG(time) OVER (PARTITION BY user_id ORDER BY time) as prev_time
  FROM events
  WHERE project_id = :project_id AND user_id IS NOT NULL
),
session_markers AS (
  SELECT *,
    CASE WHEN prev_time IS NULL 
          OR EXTRACT(EPOCH FROM (time - prev_time)) > 1800  -- 30 min
    THEN 1 ELSE 0 END as new_session
  FROM user_events
),
session_groups AS (
  SELECT *,
    SUM(new_session) OVER (PARTITION BY user_id ORDER BY time) as session_id
  FROM session_markers
)
SELECT 
  user_id, session_id,
  MIN(time) as session_start,
  MAX(time) as session_end,
  COUNT(*) as event_count,
  EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) as session_duration
FROM session_groups
GROUP BY user_id, session_id;
```

---

## 模块 3：分布分析

### 3.1 功能规格

分布分析展示用户在特定指标下的频次分布或总额分布情况。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| DA-001 | 频次分布 | 统计用户在选定时间范围内触发某事件的次数分布（如购买 1 次/2 次/3 次的人数）|
| DA-002 | 总额分布 | 统计用户在某事件属性值上的总和/均值分布（如消费总额分段）|
| DA-003 | 自定义区间 | 支持自定义分布区间边界（如 0-10, 10-50, 50-100, 100+）|
| DA-004 | 图表展示 | 柱状图展示分布，X 轴为区间，Y 轴为用户数 |

### 3.2 计算逻辑

```sql
-- 频次分布：统计每个用户购买次数
WITH user_counts AS (
  SELECT user_id, COUNT(*) as cnt
  FROM events WHERE event_name = 'purchase' AND time BETWEEN :start AND :end
  GROUP BY user_id
)
SELECT 
  CASE 
    WHEN cnt = 1 THEN '1次'
    WHEN cnt = 2 THEN '2次'
    WHEN cnt BETWEEN 3 AND 5 THEN '3-5次'
    WHEN cnt BETWEEN 6 AND 10 THEN '6-10次'
    ELSE '10次以上'
  END as range,
  COUNT(*) as user_count
FROM user_counts
GROUP BY range;
```

---

## 模块 4：间隔分析

### 4.1 功能规格

间隔分析分析用户两次行为之间的时间间隔。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| IA-001 | 起始事件 | 定义间隔的起始行为 |
| IA-002 | 结束事件 | 定义间隔的结束行为 |
| IA-003 | 间隔分布 | 展示间隔时间的分布情况（柱状图）|
| IA-004 | 统计指标 | 间隔中位数、均值、最长间隔、最短间隔 |
| IA-005 | 分组对比 | 按维度对比不同群体的间隔差异 |

### 4.2 计算逻辑

```sql
WITH user_intervals AS (
  SELECT user_id,
    event,
    time,
    LEAD(time) OVER (PARTITION BY user_id ORDER BY time) as next_time,
    LEAD(event) OVER (PARTITION BY user_id ORDER BY time) as next_event
  FROM events
  WHERE project_id = :project_id AND user_id IS NOT NULL
)
SELECT 
  EXTRACT(EPOCH FROM (next_time - time)) / 3600 as interval_hours,
  COUNT(*) as count
FROM user_intervals
WHERE event = 'purchase' AND next_event = 'purchase'
  AND next_time IS NOT NULL
GROUP BY interval_hours;
```

---

## 模块 5：归因分析

### 5.1 功能规格

归因分析将转化结果归因到不同的渠道/行为，评估各触点的贡献度。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| AT-001 | 目标事件 | 定义需要归因的转化事件（如"下单"、"注册"）|
| AT-002 | 触点事件 | 定义参与归因的渠道/行为事件（如"广告点击"、"搜索"）|
| AT-003 | 归因窗口 | 设置转化归因的时间窗口（如点击后 7 天内转化）|
| AT-004 | 归因模型 | 支持首次触点归因、末次触点归因、线性归因、时间衰减归因 |
| AT-005 | 结果展示 | 各渠道的贡献度排名、贡献事件数、转化率 |
| AT-006 | 趋势分析 | 各渠道归因贡献随时间变化趋势 |

### 5.2 归因模型说明

| 模型 | 逻辑 | 适用场景 |
|------|------|---------|
| 首次触点 | 100% 贡献归给转化路径中的第一个触点 | 品牌曝光评估 |
| 末次触点 | 100% 贡献归给转化路径中的最后一个触点 | 效果广告评估 |
| 线性归因 | 路径中每个触点平分贡献 | 均匀评估所有渠道 |
| 时间衰减 | 距离转化时间越近的触点权重越高（指数衰减） | 短决策周期场景 |
| U 形归因 | 首次和末次触点各 40%，中间触点平分 20% | 长决策周期场景 |

### 5.3 计算逻辑

```sql
-- 首次触点归因
WITH conversion AS (
  SELECT user_id, MIN(time) as conversion_time
  FROM events WHERE event_name = 'purchase' AND time BETWEEN :start AND :end
  GROUP BY user_id
),
touchpoints AS (
  SELECT 
    c.user_id,
    e.event_name,
    e.time,
    e.properties->>'channel' as channel,
    ROW_NUMBER() OVER (PARTITION BY c.user_id ORDER BY e.time) as touch_seq
  FROM conversion c
  JOIN events e ON c.user_id = e.user_id
  WHERE e.event_name IN ('ad_click', 'search', 'social_share')
    AND e.time BETWEEN (c.conversion_time - INTERVAL '7 days') AND c.conversion_time
)
SELECT 
  channel,
  COUNT(*) as attributed_conversions
FROM touchpoints
WHERE touch_seq = 1  -- 首次触点
GROUP BY channel;
```

---

## 模块 6：LTV 分析

### 6.1 功能规格

LTV (Life Time Value) 分析计算用户在生命周期内的价值。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| LT-001 | 价值定义 | 选择代表用户价值的事件属性（如"订单金额"）|
| LT-002 | 时间周期 | 按日/周/月展示累计人均价值 |
| LT-003 | LTV 曲线 | X 轴为时间，Y 轴为累计人均价值 |
| LT-004 | 分组对比 | 按渠道/用户属性分组对比 LTV 差异 |
| LT-005 | 历史 LTV | 基于历史数据的实际 LTV 计算 |

### 6.2 计算逻辑

```sql
WITH user_ltv AS (
  SELECT 
    user_id,
    DATE_TRUNC('day', time) as day,
    SUM((properties->>'amount')::numeric) as daily_value
  FROM events 
  WHERE event_name = 'purchase' AND time BETWEEN :start AND :end
  GROUP BY user_id, DATE_TRUNC('day', time)
),
new_users AS (
  SELECT DISTINCT user_id, MIN(time) as first_active_date
  FROM events WHERE project_id = :project_id
  GROUP BY user_id
)
SELECT 
  EXTRACT(DAY FROM (lt.day - nu.first_active_date)) as day_since_first,
  AVG(lt.daily_value) as avg_ltv
FROM user_ltv lt
JOIN new_users nu ON lt.user_id = nu.user_id
GROUP BY day_since_first
ORDER BY day_since_first;
```

---

## 模块 7：RFM 分析

### 7.1 功能规格

RFM 模型通过 Recent（最近消费时间）、Frequency（消费频率）、Monetary（消费金额）三个维度对用户分层。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| RF-001 | R 维度 | 最近一次消费距今的天数 |
| RF-002 | F 维度 | 选定时间范围内的消费次数 |
| RF-003 | M 维度 | 选定时间范围内的消费总金额 |
| RF-004 | 评分规则 | 每个维度分为 5 档（1-5 分），支持自定义分档阈值 |
| RF-005 | 分层结果 | 将用户分为 8 个层级：重要价值用户、重要发展用户、重要保持用户、重要挽留用户、一般价值用户、一般发展用户、一般保持用户、一般挽留用户 |
| RF-006 | 用户分布 | 各层级用户占比，RFM 三维散点图展示 |

### 7.2 分层规则

| 层级 | R | F | M | 运营建议 |
|------|---|---|---|---------|
| 重要价值用户 | ⬆ 高 | ⬆ 高 | ⬆ 高 | VIP 维护 |
| 重要发展用户 | ⬆ 高 | ⬇ 低 | ⬆ 高 | 提升频次 |
| 重要保持用户 | ⬇ 低 | ⬆ 高 | ⬆ 高 | 召回激活 |
| 重要挽留用户 | ⬇ 低 | ⬇ 低 | ⬆ 高 | 流失预警 |
| 一般价值用户 | ⬆ 高 | ⬆ 高 | ⬇ 低 | 提升客单 |
| 一般发展用户 | ⬆ 高 | ⬇ 低 | ⬇ 低 | 培养习惯 |
| 一般保持用户 | ⬇ 低 | ⬆ 高 | ⬇ 低 | 促销唤醒 |
| 一般挽留用户 | ⬇ 低 | ⬇ 低 | ⬇ 低 | 低优先级 |

---

## 模块 8：用户分群

### 8.1 功能规格

用户分群是基于条件规则圈选用户集合的功能，是所有运营动作的基础。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| US-001 | 用户属性条件 | 按用户属性（如"等级 = VIP"）圈选 |
| US-002 | 行为条件 | 按事件行为条件圈选：做过/没做过某事件、事件次数 > N、事件属性满足条件 |
| US-003 | 时间范围 | 行为条件可以指定时间范围（如"近 30 天购买 > 3 次"）|
| US-004 | 规则组 | 多个条件支持 AND/OR 组合 |
| US-005 | 交并差运算 | 分群之间支持交集、并集、差集运算 |
| US-006 | 预估人数 | 保存前预估分群人数 |
| US-007 | 分群保存 | 保存为静态分群（快照）或动态分群（实时更新）|
| US-008 | 分群列表 | 分群管理、编辑、删除、导出 |
| US-009 | 分群详情 | 查看分群内用户列表、分群覆盖的用户画像 |

### 8.2 条件 DSL

```typescript
interface SegmentRule {
  type: 'and' | 'or';
  conditions: Condition[];
}

interface Condition {
  type: 'user_property' | 'event' | 'segment';
  property?: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in' | 'contains' | 'not_contains' | 'set' | 'not_set';
  value: any;
  
  // event 类型额外字段
  event_name?: string;
  event_count_operator?: '>=' | '<=' | '=' | 'between';
  event_count?: number;
  event_count_max?: number;
  time_range?: number; // 天数
  event_property_filters?: EventPropertyFilter[];
}

interface EventPropertyFilter {
  property: string;
  operator: string;
  value: any;
}

interface SegmentSetOperation {
  type: 'union' | 'intersection' | 'difference';
  segment_ids: string[];
}
```

### 8.3 分群创建示例

```json
{
  "name": "高价值活跃用户",
  "description": "近30天购买>3次且客单价>100元的非VIP用户",
  "type": "dynamic",
  "rule": {
    "type": "and",
    "conditions": [
      {
        "type": "event",
        "event_name": "purchase",
        "event_count_operator": ">=",
        "event_count": 3,
        "time_range": 30
      },
      {
        "type": "event",
        "event_name": "purchase",
        "operator": ">=",
        "value": 100,
        "event_property_filters": [
          {
            "property": "amount",
            "operator": ">=",
            "value": 100
          }
        ],
        "time_range": 30
      },
      {
        "type": "user_property",
        "property": "level",
        "operator": "!=",
        "value": "VIP"
      }
    ]
  }
}
```

### 8.4 分群计算引擎

- **实时分群**：用户属性条件的分群实时计算结果
- **离线分群**：涉及行为条件的分群按需/定时计算（支持异步计算，完成后通知）
- **增量更新**：动态分群每日增量更新，无需全量重算
- **分群缓存**：计算结果写入分群用户表，后续分析直接查表

```sql
-- 分群用户表
CREATE TABLE segment_users (
  id            BIGSERIAL PRIMARY KEY,
  segment_id    VARCHAR(32) NOT NULL,
  user_id       VARCHAR(255) NOT NULL,
  computed_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(segment_id, user_id)
);

CREATE INDEX idx_segment_users_segment ON segment_users(segment_id);
```

---

## 模块 9：导出与书签

### 9.1 导出功能

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| EX-001 | 导出分析结果 | 事件分析/漏斗/留存等分析结果导出为 CSV/Excel |
| EX-002 | 导出图表 | 分析图表导出为 PNG 图片 |
| EX-003 | 导出用户列表 | 用户分群/筛选结果导出为用户 ID 列表 CSV |

### 9.2 书签

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| BK-001 | 保存书签 | 将当前分析配置保存为书签（名称 + 完整配置）|
| BK-002 | 书签列表 | 左侧栏展示书签列表，支持分组管理 |
| BK-003 | 分享书签 | 生成分享链接，其他项目成员可访问相同分析视图 |
| BK-004 | 定时刷新 | 书签支持设置为定时刷新，每次打开自动查询最新数据 |

---

## API 新增

```
POST /api/analytics/path         用户路径分析
POST /api/analytics/sessions     Session 分析
POST /api/analytics/distribution 分布分析
POST /api/analytics/interval     间隔分析
POST /api/analytics/attribution  归因分析
POST /api/analytics/ltv          LTV 分析
POST /api/analytics/rfm          RFM 分析

GET  /api/segments               分群列表
POST /api/segments               创建分群
GET  /api/segments/:id           分群详情
PUT  /api/segments/:id           更新分群
DELETE /api/segments/:id         删除分群
POST /api/segments/:id/estimate  预估人数
POST /api/segments/:id/calculate 触发计算
GET  /api/segments/:id/users     分群用户列表

GET  /api/bookmarks              书签列表
POST /api/bookmarks              创建书签
DELETE /api/bookmarks/:id        删除书签
```

---

## 验收标准

| # | 验收项 | 测试方法 |
|---|--------|---------|
| 1 | 路径分析 Sankey 图正确 | 已知用户行为序列，Sankey 图展示正确流转路径 |
| 2 | Session 划分正确 | 用户间隔 35 分钟的行为被划分为不同 Session |
| 3 | 分布分析区间正确 | 自定义区间 [0,10],[10,50],[50,100]，用户分布正确 |
| 4 | 归因计算准确 | 首次触点/末次触点/线性归因结果与手工计算一致 |
| 5 | 用户分群行为条件 | "近 7 天登录 > 3 次" 分群人数与 SQL 查询一致 |
| 6 | 交并差运算 | 分群 A ∩ B 与 SQL `INTERSECT` 结果一致 |
| 7 | 动态分群更新 | 新用户满足条件后自动进入分群 |
