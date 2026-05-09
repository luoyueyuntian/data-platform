# PRD V1.1 — 核心分析增强

## 1. 版本目标

在 MVP 基础上，补齐 **漏斗分析、留存分析、分布分析** 三大核心分析模型，形成基础分析能力闭环。

## 2. 功能清单

| 模块 | 功能 | 优先级 |
|------|------|--------|
| 漏斗分析 | 漏斗创建（多步骤） | P0 |
| 漏斗分析 | 转化率/流失率计算 | P0 |
| 漏斗分析 | 时间窗口限制 | P0 |
| 漏斗分析 | 按属性分组对比 | P1 |
| 漏斗分析 | 漏斗趋势（转化率随时间变化） | P1 |
| 留存分析 | N 日留存（回访留存） | P0 |
| 留存分析 | 自定义初始行为/回访行为 | P0 |
| 留存分析 | 留存表格 + 留存曲线 | P0 |
| 留存分析 | 按属性分组 | P1 |
| 留存分析 | 任意区间留存 | P1 |
| 分布分析 | 事件次数分布 | P0 |
| 分布分析 | 属性值分布 | P0 |
| 分布分析 | 自定义分桶 | P1 |
| 分布分析 | 按用户属性分组 | P1 |

---

## 3. 功能详细设计

### 3.1 漏斗分析

#### 3.1.1 概念说明

漏斗分析用于衡量用户在一系列有序步骤中的转化情况。例如：
- 电商：浏览商品 → 加入购物车 → 提交订单 → 支付成功
- 注册：访问注册页 → 填写信息 → 提交注册 → 完成引导

#### 3.1.2 页面布局

```
┌──────────────────────────────────────────────────────┐
│  漏斗分析                                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 漏斗步骤配置                                   │   │
│  │                                               │   │
│  │  步骤1: [事件▼]  筛选: [+添加]                 │   │
│  │    ↓                                           │   │
│  │  步骤2: [事件▼]  筛选: [+添加]                 │   │
│  │    ↓                                           │   │
│  │  步骤3: [事件▼]  筛选: [+添加]                 │   │
│  │    ↓                                           │   │
│  │  步骤4: [事件▼]  筛选: [+添加]                 │   │
│  │                                               │   │
│  │  [+ 添加步骤]                                  │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 配置区域                                       │   │
│  │ 时间窗口: [1小时内/6小时内/1天/7天/30天/自定义] │   │
│  │ 转化窗口: [首次转化 / 任意转化]                 │   │
│  │ 分组: [按属性▼]                                │   │
│  │ 时间: [近7天/近30天/自定义]                     │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │                                               │   │
│  │  漏斗图                                        │   │
│  │                                               │   │
│  │   ██████████████████████████  步骤1: 10,000   │   │
│  │   ████████████████           步骤2:  6,500  65%│   │
│  │   ██████████                 步骤3:  3,800  58%│   │
│  │   █████                      步骤4:  2,100  55%│   │
│  │                                               │   │
│  │   总转化率: 21%                               │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 数据明细                                       │   │
│  │ 步骤 | 用户数 | 转化率 | 流失率 | 平均耗时      │   │
│  │ ...                                           │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 漏斗趋势（转化率随时间变化的折线图）             │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 3.1.3 业务规则

**漏斗步骤规则**：
- 最少 2 步，最多 8 步
- 每步可选择不同的事件
- 每步可添加筛选条件（限定该步骤的事件属性）
- 步骤必须按时间顺序发生

**时间窗口**：
- 定义：从第一步到最后一步的最大允许时间跨度
- 选项：1 小时 / 6 小时 / 1 天 / 7 天 / 30 天 / 自定义
- 超过时间窗口的转化不计入

**转化窗口**：
- **首次转化**：每个用户只计算第一次进入漏斗的转化路径
- **任意转化**：每个用户可多次进入漏斗，每次独立计算

**转化率计算**：
- **总体转化率** = 最后一步用户数 / 第一步用户数
- **步骤转化率** = 当前步骤用户数 / 上一步骤用户数
- **流失率** = 1 - 步骤转化率

#### 3.1.4 API 设计

**创建漏斗分析**：`POST /api/v1/analysis/funnel`

```json
{
  "project_id": "proj_001",
  "name": "电商转化漏斗",
  "steps": [
    {
      "event": "product_viewed",
      "filters": [
        { "property": "category", "operator": "=", "value": "手机" }
      ]
    },
    {
      "event": "add_to_cart",
      "filters": []
    },
    {
      "event": "order_created",
      "filters": []
    },
    {
      "event": "order_paid",
      "filters": []
    }
  ],
  "window": {
    "type": "time",
    "value": 1,
    "unit": "day"
  },
  "conversion_type": "first",
  "group_by": "device_type",
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
    "overall_conversion_rate": 0.21,
    "steps": [
      {
        "step": 1,
        "event": "product_viewed",
        "users": 10000,
        "conversion_rate": 1.0,
        "drop_off_rate": 0,
        "avg_time_from_prev": null
      },
      {
        "step": 2,
        "event": "add_to_cart",
        "users": 6500,
        "conversion_rate": 0.65,
        "drop_off_rate": 0.35,
        "avg_time_from_prev": "00:03:45"
      },
      {
        "step": 3,
        "event": "order_created",
        "users": 3800,
        "conversion_rate": 0.585,
        "drop_off_rate": 0.415,
        "avg_time_from_prev": "00:12:30"
      },
      {
        "step": 4,
        "event": "order_paid",
        "users": 2100,
        "conversion_rate": 0.553,
        "drop_off_rate": 0.447,
        "avg_time_from_prev": "00:02:15"
      }
    ],
    "groups": [
      {
        "name": "iOS",
        "steps": [ ... ]
      },
      {
        "name": "Android",
        "steps": [ ... ]
      }
    ],
    "trend": [
      { "date": "2025-04-01", "conversion_rate": 0.19 },
      { "date": "2025-04-02", "conversion_rate": 0.22 }
    ]
  }
}
```

#### 3.1.5 查询引擎实现要点

```sql
-- 漏斗分析核心查询（简化逻辑）
-- 1. 为每个用户找到每个步骤的首次/每次发生时间
-- 2. 检查步骤间时间差是否在窗口内
-- 3. 统计每个步骤的用户数

WITH step_events AS (
  SELECT
    user_id,
    event_name,
    time,
    ROW_NUMBER() OVER (PARTITION BY user_id, event_name ORDER BY time) AS rn
  FROM timescale.events
  WHERE project_id = $1
    AND event_name IN ('product_viewed', 'add_to_cart', 'order_created', 'order_paid')
    AND time >= $2 AND time < $3
),
user_funnel AS (
  SELECT
    s1.user_id,
    s1.time AS step1_time,
    s2.time AS step2_time,
    s3.time AS step3_time,
    s4.time AS step4_time
  FROM (SELECT * FROM step_events WHERE event_name = 'product_viewed' AND rn = 1) s1
  LEFT JOIN (SELECT * FROM step_events WHERE event_name = 'add_to_cart' AND rn = 1) s2
    ON s1.user_id = s2.user_id AND s2.time > s1.time AND s2.time < s1.time + INTERVAL '1 day'
  LEFT JOIN (SELECT * FROM step_events WHERE event_name = 'order_created' AND rn = 1) s3
    ON s2.user_id = s3.user_id AND s3.time > s2.time AND s3.time < s1.time + INTERVAL '1 day'
  LEFT JOIN (SELECT * FROM step_events WHERE event_name = 'order_paid' AND rn = 1) s4
    ON s3.user_id = s4.user_id AND s4.time > s3.time AND s4.time < s1.time + INTERVAL '1 day'
)
SELECT
  COUNT(*) AS step1_users,
  COUNT(step2_time) AS step2_users,
  COUNT(step3_time) AS step3_users,
  COUNT(step4_time) AS step4_users
FROM user_funnel;
```

---

### 3.2 留存分析

#### 3.2.1 概念说明

留存分析衡量用户在执行某个行为后，在后续时间里回访（再次执行某行为）的比例。

**核心概念**：
- **初始行为**：定义用户"进入"留存分析的条件（如"首次访问"）
- **回访行为**：定义用户"留存"的条件（如"任意事件"或"再次访问"）
- **留存周期**：按天/周/月计算

#### 3.2.2 页面布局

```
┌──────────────────────────────────────────────────────┐
│  留存分析                                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 配置区域                                       │   │
│  │                                               │   │
│  │  初始行为: [事件▼]  筛选: [+添加]               │   │
│  │  回访行为: [事件▼]  筛选: [+添加]               │   │
│  │                                               │   │
│  │  留存类型: ○N日留存  ○N周留存  ○N月留存         │   │
│  │  观察窗口: [7天 / 14天 / 30天 / 自定义]         │   │
│  │                                               │   │
│  │  分组: [按属性▼]                                │   │
│  │  时间: [近7天 / 近30天 / 自定义]                │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 留存表格                                       │   │
│  │                                               │   │
│  │  日期     | 新增 | Day1 | Day2 | Day3 | Day7   │   │
│  │  ---------|------|------|------|------|--------│   │
│  │  2025-04-01| 500 | 45%  | 38%  | 32%  | 22%   │   │
│  │  2025-04-02| 480 | 43%  | 36%  | 30%  |  -    │   │
│  │  2025-04-03| 520 | 47%  | 40%  |  -   |  -    │   │
│  │  ...                                         │   │
│  │                                               │   │
│  │  平均留存:      44.5%  37.8%  31.0%  22.0%    │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 留存曲线图                                     │   │
│  │ (多条折线，每条代表一天的新增用户留存)           │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 3.2.3 业务规则

**留存类型**：
- **N 日留存**：初始行为后第 N 天执行回访行为
- **N 周留存**：初始行为后第 N 周（周一-周日）执行回访行为
- **N 月留存**：初始行为后第 N 月执行回访行为

**观察窗口**：
- 默认 7 天（计算 Day1-Day7 的留存）
- 最大 90 天

**分组**：
- 按用户属性分组（如渠道、设备类型）
- 对比不同群体的留存差异

#### 3.2.4 API 设计

**创建留存分析**：`POST /api/v1/analysis/retention`

```json
{
  "project_id": "proj_001",
  "initial_event": {
    "event": "$pageview",
    "filters": [
      { "property": "$url", "operator": "contains", "value": "/register" }
    ]
  },
  "return_event": {
    "event": "$pageview",
    "filters": []
  },
  "retention_type": "day",
  "observation_window": 7,
  "group_by": "channel",
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
    "retention_table": [
      {
        "date": "2025-04-01",
        "initial_users": 500,
        "retention": {
          "day1": { "users": 225, "rate": 0.45 },
          "day2": { "users": 190, "rate": 0.38 },
          "day3": { "users": 160, "rate": 0.32 },
          "day7": { "users": 110, "rate": 0.22 }
        }
      }
    ],
    "average_retention": {
      "day1": 0.445,
      "day2": 0.378,
      "day3": 0.310,
      "day7": 0.220
    },
    "groups": [
      {
        "name": "organic",
        "retention_table": [ ... ],
        "average_retention": { ... }
      },
      {
        "name": "paid",
        "retention_table": [ ... ],
        "average_retention": { ... }
      }
    ]
  }
}
```

#### 3.2.5 查询引擎实现要点

```sql
-- 留存分析核心查询（N日留存）
WITH initial_users AS (
  -- 找到每天执行初始行为的新用户
  SELECT
    DATE(time) AS cohort_date,
    user_id
  FROM timescale.events
  WHERE project_id = $1
    AND event_name = $2  -- 初始行为事件
    AND time >= $3 AND time < $4
  GROUP BY DATE(time), user_id
),
return_events AS (
  -- 找到回访行为
  SELECT
    user_id,
    DATE(time) AS return_date
  FROM timescale.events
  WHERE project_id = $1
    AND event_name = $5  -- 回访行为事件
    AND time >= $3 AND time < $4 + INTERVAL '7 days'
  GROUP BY user_id, DATE(time)
)
SELECT
  i.cohort_date,
  COUNT(DISTINCT i.user_id) AS initial_users,
  COUNT(DISTINCT CASE WHEN r.return_date = i.cohort_date + 1 THEN i.user_id END) AS day1_users,
  COUNT(DISTINCT CASE WHEN r.return_date = i.cohort_date + 2 THEN i.user_id END) AS day2_users,
  COUNT(DISTINCT CASE WHEN r.return_date = i.cohort_date + 7 THEN i.user_id END) AS day7_users
FROM initial_users i
LEFT JOIN return_events r ON i.user_id = r.user_id
GROUP BY i.cohort_date
ORDER BY i.cohort_date;
```

---

### 3.3 分布分析

#### 3.3.1 概念说明

分布分析用于查看某个指标（事件次数或属性值）在用户中的分布情况。例如：
- 每个用户的下单次数分布
- 用户消费金额分布
- 每日活跃天数分布

#### 3.3.2 页面布局

```
┌──────────────────────────────────────────────────────┐
│  分布分析                                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 配置区域                                       │   │
│  │                                               │   │
│  │  分析类型: ○事件次数分布  ○属性值分布           │   │
│  │                                               │   │
│  │  事件: [事件▼]                                  │   │
│  │  指标: [属性▼] (仅属性值分布时显示)             │   │
│  │                                               │   │
│  │  筛选: [+添加]                                  │   │
│  │  分组: [按属性▼]                                │   │
│  │  时间: [近7天 / 近30天 / 自定义]                │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 分桶配置                                       │   │
│  │                                               │   │
│  │  分桶方式: ○自动  ○自定义                       │   │
│  │  自定义分桶: 0, 1, 2, 3, 5, 10, 20, 50, 100+  │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 分布柱状图                                     │   │
│  │                                               │   │
│  │  ▐█                                            │   │
│  │  ▐█ ▐█                                         │   │
│  │  ▐█ ▐█ ▐█                                      │   │
│  │  ▐█ ▐█ ▐█ ▐█ ▐█                                │   │
│  │  ▐█ ▐█ ▐█ ▐█ ▐█ ▐█ ▐█                          │   │
│  │  ────────────────────────                      │   │
│  │   0  1  2  3  4  5  6+   (次数)                │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 统计数据                                       │   │
│  │ 总用户数: 10,000                               │   │
│  │ 平均值: 3.2 次                                 │   │
│  │ 中位数: 2 次                                   │   │
│  │ 最大值: 156 次                                 │   │
│  │ 标准差: 5.8                                    │   │
│  │ P90: 8 次                                      │   │
│  │ P99: 45 次                                     │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 数据明细表                                     │   │
│  │ 分桶 | 用户数 | 占比 | 累计占比                 │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 3.3.3 API 设计

**创建分布分析**：`POST /api/v1/analysis/distribution`

```json
{
  "project_id": "proj_001",
  "distribution_type": "event_count",
  "event_name": "order_created",
  "property_name": null,
  "filters": [
    { "property": "amount", "operator": ">=", "value": 0 }
  ],
  "group_by": "vip_level",
  "bucket_config": {
    "type": "custom",
    "boundaries": [0, 1, 2, 3, 5, 10, 20, 50, 100]
  },
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
    "total_users": 10000,
    "stats": {
      "mean": 3.2,
      "median": 2,
      "max": 156,
      "std_dev": 5.8,
      "p90": 8,
      "p99": 45
    },
    "buckets": [
      { "label": "0", "users": 2000, "percentage": 0.20, "cumulative": 0.20 },
      { "label": "1", "users": 2500, "percentage": 0.25, "cumulative": 0.45 },
      { "label": "2", "users": 1800, "percentage": 0.18, "cumulative": 0.63 },
      { "label": "3-4", "users": 1500, "percentage": 0.15, "cumulative": 0.78 },
      { "label": "5-9", "users": 1200, "percentage": 0.12, "cumulative": 0.90 },
      { "label": "10-19", "users": 600, "percentage": 0.06, "cumulative": 0.96 },
      { "label": "20-49", "users": 300, "percentage": 0.03, "cumulative": 0.99 },
      { "label": "50+", "users": 100, "percentage": 0.01, "cumulative": 1.00 }
    ],
    "groups": [ ... ]
  }
}
```

#### 3.3.4 查询引擎实现要点

```sql
-- 事件次数分布
WITH user_counts AS (
  SELECT
    user_id,
    COUNT(*) AS event_count
  FROM timescale.events
  WHERE project_id = $1
    AND event_name = $2
    AND time >= $3 AND time < $4
  GROUP BY user_id
),
bucketed AS (
  SELECT
    CASE
      WHEN event_count = 0 THEN '0'
      WHEN event_count = 1 THEN '1'
      WHEN event_count = 2 THEN '2'
      WHEN event_count BETWEEN 3 AND 4 THEN '3-4'
      WHEN event_count BETWEEN 5 AND 9 THEN '5-9'
      WHEN event_count BETWEEN 10 AND 19 THEN '10-19'
      WHEN event_count BETWEEN 20 AND 49 THEN '20-49'
      ELSE '50+'
    END AS bucket,
    COUNT(*) AS user_count
  FROM user_counts
  GROUP BY bucket
)
SELECT * FROM bucketed ORDER BY bucket;
```

---

## 4. 导航更新

在顶部导航中增加分析模块的入口：

```
[事件分析] [漏斗分析] [留存分析] [分布分析]
```

---

## 5. 验收标准

### 5.1 漏斗分析验收

- [ ] 能创建 2-8 步的漏斗
- [ ] 每步可选择不同事件和筛选条件
- [ ] 时间窗口正确限制转化计算
- [ ] 转化率/流失率计算正确
- [ ] 分组对比功能正常
- [ ] 漏斗趋势图正确显示

### 5.2 留存分析验收

- [ ] 能选择初始行为和回访行为
- [ ] N 日留存计算正确
- [ ] 留存表格正确显示
- [ ] 留存曲线图正确绘制
- [ ] 分组对比功能正常

### 5.3 分布分析验收

- [ ] 事件次数分布计算正确
- [ ] 属性值分布计算正确
- [ ] 自定义分桶功能正常
- [ ] 统计指标（均值/中位数/P90/P99）计算正确
- [ ] 分布柱状图正确显示
