# PRD V2.1 — 高级分析

## 1. 版本目标

增加 **归因分析、智能预警** 两大模块，提供更深入的分析洞察能力。

## 2. 功能清单

| 模块 | 功能 | 优先级 |
|------|------|--------|
| 归因分析 | 首次归因 | P0 |
| 归因分析 | 末次归因 | P0 |
| 归因分析 | 线性归因 | P0 |
| 归因分析 | 时间衰减归因 | P1 |
| 归因分析 | 位置归因（U型归因） | P1 |
| 归因分析 | 自定义归因模型 | P1 |
| 归因分析 | 归因对比 | P1 |
| 智能预警 | 指标预警规则 | P0 |
| 智能预警 | 阈值预警（静态） | P0 |
| 智能预警 | 异常检测（动态） | P1 |
| 智能预警 | 预警通知渠道 | P0 |
| 智能预警 | 预警历史 | P1 |
| 智能预警 | 预警抑制 | P1 |

---

## 3. 功能详细设计

### 3.1 归因分析

#### 3.1.1 概念说明

归因分析用于评估不同触点（渠道、活动、广告等）对转化事件的贡献度。

**典型场景**：
- 用户先通过 Google 广告访问，再通过微信分享访问，最终下单 — 哪个渠道贡献最大？
- 用户参与了多个营销活动后购买 — 各活动的贡献如何分配？

**归因模型**：
| 模型 | 说明 |
|------|------|
| 首次归因 | 100% 归功于第一个触点 |
| 末次归因 | 100% 归功于最后一个触点 |
| 线性归因 | 平均分配给所有触点 |
| 时间衰减 | 越近的触点获得越多归因 |
| 位置归因 | 首末各 40%，中间平分 20% |

#### 3.1.2 页面布局

```
┌──────────────────────────────────────────────────────┐
│  归因分析                                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 配置区域                                       │   │
│  │                                               │   │
│  │  转化事件: [事件▼]  筛选: [+添加]               │   │
│  │  触点事件: [事件▼]  触点属性: [属性▼]           │   │
│  │                                               │   │
│  │  归因窗口: [30天 ▼] (转化前多长时间内的触点)    │   │
│  │  归因模型: [首次归因 ▼]                         │   │
│  │                                               │   │
│  │  筛选: [+添加]                                  │   │
│  │  时间: [近7天 / 近30天 / 自定义]                │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 归因结果 - 饼图                                │   │
│  │                                               │   │
│  │       ┌─────────┐                             │   │
│  │       │  Google  │ 35%                        │   │
│  │       │  微信    │ 28%                        │   │
│  │       │  直接    │ 20%                        │   │
│  │       │  微博    │ 12%                        │   │
│  │       │  其他    │  5%                        │   │
│  │       └─────────┘                             │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 归因结果 - 柱状图                              │   │
│  │                                               │   │
│  │  ▐█ ▐█ ▐█ ▐█ ▐█                               │   │
│  │  ▐█ ▐█ ▐█ ▐█ ▐█                               │   │
│  │  ▐█ ▐█ ▐█ ▐█ ▐█                               │   │
│  │  ────────────────────                         │   │
│  │  Google 微信 直接 微博 其他                     │   │
│  │                                               │   │
│  │  归因转化数: 1,200  归因转化金额: ¥234,000     │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 归因对比                                       │   │
│  │                                               │   │
│  │  渠道    | 首次归因 | 末次归因 | 线性归因      │   │
│  │  Google  | 35%     | 28%     | 31%           │   │
│  │  微信    | 22%     | 30%     | 26%           │   │
│  │  直接    | 25%     | 18%     | 22%           │   │
│  │  微博    | 13%     | 18%     | 15%           │   │
│  │  其他    |  5%     |  6%     |  6%           │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 触点路径分析                                   │   │
│  │                                               │   │
│  │  典型转化路径:                                  │   │
│  │  Google → 直接 → 微信 → 转化 (120次, 10%)      │   │
│  │  微信 → 转化 (95次, 7.9%)                      │   │
│  │  Google → 转化 (88次, 7.3%)                    │   │
│  │  ...                                         │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  [保存为图表] [添加到看板] [导出]                      │
└──────────────────────────────────────────────────────┘
```

#### 3.1.3 业务规则

**归因窗口**：
- 默认 30 天
- 只有在转化事件发生前 N 天内的触点才参与归因

**触点定义**：
- 触点由事件 + 属性值定义
- 例如：`$pageview` 事件，`$channel` 属性值为 "google"
- 支持自定义触点事件（如 `ad_click`）

**归因模型计算**：

**首次归因**：
```
触点贡献 = 转化数（如果该触点是第一个）
```

**末次归因**：
```
触点贡献 = 转化数（如果该触点是最后一个）
```

**线性归因**：
```
触点贡献 = 转化数 / 触点数
```

**时间衰减归因**：
```
半衰期 = 7天
权重 = 2^(-距离天数/半衰期)
触点贡献 = 转化数 * (该触点权重 / 所有触点权重之和)
```

**位置归因（U型）**：
```
首次触点: 40%
末次触点: 40%
中间触点: 平分 20%
```

#### 3.1.4 API 设计

**创建归因分析**：`POST /api/v1/analysis/attribution`

```json
{
  "project_id": "proj_001",
  "conversion_event": {
    "event": "order_paid",
    "filters": [
      { "property": "amount", "operator": ">=", "value": 100 }
    ]
  },
  "touchpoint_event": {
    "event": "$pageview",
    "property": "$channel"
  },
  "attribution_window": 30,
  "attribution_model": "linear",
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
    "total_conversions": 1200,
    "total_revenue": 234000,
    "channels": [
      {
        "name": "Google",
        "conversions": 420,
        "revenue": 81900,
        "percentage": 0.35,
        "avg_touchpoints": 2.3
      },
      {
        "name": "微信",
        "conversions": 336,
        "revenue": 65520,
        "percentage": 0.28,
        "avg_touchpoints": 1.8
      }
    ],
    "comparison": {
      "first_touch": [
        { "name": "Google", "percentage": 0.35 },
        { "name": "微信", "percentage": 0.22 }
      ],
      "last_touch": [
        { "name": "Google", "percentage": 0.28 },
        { "name": "微信", "percentage": 0.30 }
      ],
      "linear": [
        { "name": "Google", "percentage": 0.31 },
        { "name": "微信", "percentage": 0.26 }
      ]
    },
    "top_paths": [
      {
        "path": ["Google", "直接", "微信"],
        "conversions": 120,
        "percentage": 0.10
      }
    ]
  }
}
```

#### 3.1.5 查询引擎实现要点

```sql
-- 归因分析核心查询
-- 1. 找到所有转化用户的触点序列
-- 2. 根据归因模型分配贡献

WITH conversions AS (
  -- 找到转化事件
  SELECT
    user_id,
    time AS conversion_time
  FROM timescale.events
  WHERE project_id = $1
    AND event_name = $2  -- 转化事件
    AND time >= $3 AND time < $4
),
touchpoints AS (
  -- 找到转化前的触点
  SELECT
    c.user_id,
    c.conversion_time,
    e.properties->>'$channel' AS channel,
    e.time AS touch_time,
    ROW_NUMBER() OVER (
      PARTITION BY c.user_id, c.conversion_time
      ORDER BY e.time ASC
    ) AS touch_seq,
    COUNT(*) OVER (
      PARTITION BY c.user_id, c.conversion_time
    ) AS total_touches
  FROM conversions c
  JOIN timescale.events e
    ON e.user_id = c.user_id
    AND e.project_id = $1
    AND e.event_name = $5  -- 触点事件
    AND e.time >= c.conversion_time - INTERVAL '30 days'
    AND e.time < c.conversion_time
),
attributed AS (
  -- 线性归因：每个触点平分贡献
  SELECT
    channel,
    COUNT(DISTINCT user_id || conversion_time::text) AS conversions,
    1.0 / MAX(total_touches) AS weight
  FROM touchpoints
  GROUP BY channel, user_id, conversion_time, total_touches
)
SELECT
  channel,
  SUM(weight) AS attributed_conversions,
  SUM(weight) / SUM(SUM(weight)) OVER () AS percentage
FROM attributed
GROUP BY channel
ORDER BY attributed_conversions DESC;
```

---

### 3.2 智能预警

#### 3.2.1 概念说明

智能预警用于监控关键指标，当指标异常时自动触发通知。

**预警类型**：
- **阈值预警**：指标超过/低于固定阈值
- **异常检测**：指标偏离历史模式（动态阈值）

#### 3.2.2 页面布局

**预警规则列表**：

```
┌──────────────────────────────────────────────────────┐
│  智能预警                                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 预警规则列表                                   │   │
│  │                                               │   │
│  │  名称          | 指标      | 状态  | 最近触发  │   │
│  │  订单量下降     | order_... | 正常  | 3天前    │   │
│  │  错误率飙升     | error_... | 告警  | 10分钟前 │   │
│  │  DAU异常       | $pageview | 正常  | 未触发   │   │
│  │  ...                                         │   │
│  │                                               │   │
│  │  [+ 创建规则]                                  │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 预警历史                                       │   │
│  │                                               │   │
│  │  时间       | 规则      | 指标值  | 状态      │   │
│  │  10分钟前   | 错误率飙升 | 2.3%   | 告警中    │   │
│  │  3天前      | 订单量下降 | 850    | 已恢复    │   │
│  │  1周前      | DAU异常   | 12,000 | 已恢复    │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**创建预警规则**：

```
┌──────────────────────────────────────────────────────┐
│  创建预警规则                                         │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 基本信息                                       │   │
│  │                                               │   │
│  │  规则名称: [订单量下降预警          ]           │   │
│  │  描述:     [当订单量低于阈值时告警  ]           │   │
│  │  状态:     [启用/禁用]                          │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 监控配置                                       │   │
│  │                                               │   │
│  │  监控事件: [order_created ▼]                    │   │
│  │  监控指标: [总次数 ▼]                           │   │
│  │  筛选条件: [+添加]                              │   │
│  │                                               │   │
│  │  检查频率: [每5分钟 / 每小时 / 每天 ▼]          │   │
│  │  时间窗口: [过去1小时 / 过去1天 ▼]              │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 预警条件                                       │   │
│  │                                               │   │
│  │  预警类型: ○阈值预警  ○异常检测                 │   │
│  │                                               │   │
│  │  --- 阈值预警 ---                              │   │
│  │  条件: [低于 ▼] [1000 ▼]                       │   │
│  │                                               │   │
│  │  --- 异常检测 ---                              │   │
│  │  灵敏度: [高/中/低 ▼]                           │   │
│  │  基准期: [过去7天 / 过去30天 ▼]                 │   │
│  │  偏离阈值: [2个标准差 ▼]                        │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │ 通知配置                                       │   │
│  │                                               │   │
│  │  通知渠道:                                     │   │
│  │  [✓] 邮件: [admin@example.com      ]          │   │
│  │  [✓] 钉钉: [webhook URL            ]          │   │
│  │  [✓] 企业微信: [webhook URL         ]          │   │
│  │  [ ] Slack: [webhook URL            ]          │   │
│  │                                               │   │
│  │  通知频率:                                     │   │
│  │  ○触发时立即通知                               │   │
│  │  ○每 [15分钟/1小时/1天] 最多通知一次            │   │
│  │                                               │   │
│  │  抑制规则:                                     │   │
│  │  [ ] 低于阈值后 [10分钟] 内不重复告警           │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  [测试通知]  [保存规则]                               │
└──────────────────────────────────────────────────────┘
```

#### 3.2.3 业务规则

**阈值预警**：
- 指标超过/低于静态阈值时触发
- 支持绝对值和百分比阈值

**异常检测**：
- 使用历史数据建立基线
- 当前值偏离基线超过 N 个标准差时触发
- 灵敏度配置：
  - 高：1.5 个标准差
  - 中：2 个标准差
  - 低：3 个标准差

**通知抑制**：
- 避免短时间内重复告警
- 可配置抑制时间窗口

#### 3.2.4 API 设计

**创建预警规则**：`POST /api/v1/alerts`

```json
{
  "project_id": "proj_001",
  "name": "订单量下降预警",
  "description": "当订单量低于阈值时告警",
  "enabled": true,
  "monitor": {
    "event": "order_created",
    "metric": "total",
    "filters": [],
    "check_interval": "5m",
    "time_window": "1h"
  },
  "condition": {
    "type": "threshold",
    "operator": "below",
    "value": 1000
  },
  "notifications": {
    "channels": [
      {
        "type": "email",
        "config": { "to": "admin@example.com" }
      },
      {
        "type": "dingtalk",
        "config": { "webhook": "https://oapi.dingtalk.com/robot/send?access_token=xxx" }
      }
    ],
    "frequency": "on_trigger",
    "suppress_minutes": 15
  }
}
```

**获取预警规则列表**：`GET /api/v1/alerts`

**获取预警历史**：`GET /api/v1/alerts/history`

**测试通知**：`POST /api/v1/alerts/:id/test`

**响应体（预警规则详情）**：
```json
{
  "code": 0,
  "data": {
    "id": "alert_001",
    "name": "订单量下降预警",
    "enabled": true,
    "status": "normal",
    "last_triggered_at": "2025-04-27T10:00:00Z",
    "last_value": 1200,
    "created_at": "2025-04-01T00:00:00Z"
  }
}
```

**预警通知内容**：
```
[预警通知] 订单量下降预警

当前值: 850 (阈值: 1000)
状态: 低于阈值
时间: 2025-04-30 14:30:00
事件: order_created
过去1小时订单量: 850

查看详情: https://app.example.com/alerts/alert_001
```

#### 3.2.5 实现要点

**异常检测算法**：
```typescript
function detectAnomaly(
  currentValue: number,
  historicalValues: number[],
  sensitivity: 'high' | 'medium' | 'low'
): { isAnomaly: boolean; zScore: number } {
  const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
  const stdDev = Math.sqrt(
    historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length
  );

  const zScore = Math.abs(currentValue - mean) / stdDev;

  const thresholds = { high: 1.5, medium: 2, low: 3 };
  const threshold = thresholds[sensitivity];

  return {
    isAnomaly: zScore > threshold,
    zScore
  };
}
```

**检查调度器**：
```typescript
// 使用 node-cron 或 BullMQ 调度预警检查
async function checkAlerts() {
  const alerts = await AlertRepository.findActive();

  for (const alert of alerts) {
    const value = await queryMetric(alert.monitor);
    const shouldTrigger = evaluateCondition(value, alert.condition);

    if (shouldTrigger && !alert.isSuppressed()) {
      await triggerNotification(alert, value);
      await alert.updateLastTriggered();
    }
  }
}
```

---

## 4. 验收标准

### 4.1 归因分析验收

- [ ] 能创建归因分析（选择转化事件和触点事件）
- [ ] 首次/末次/线性归因模型计算正确
- [ ] 时间衰减和位置归因计算正确
- [ ] 归因对比功能正常
- [ ] 触点路径分析正确显示

### 4.2 智能预警验收

- [ ] 能创建阈值预警规则
- [ ] 阈值预警正确触发
- [ ] 异常检测功能正常
- [ ] 通知渠道（邮件/钉钉/企微）发送正常
- [ ] 通知抑制功能正常
- [ ] 预警历史正确记录
