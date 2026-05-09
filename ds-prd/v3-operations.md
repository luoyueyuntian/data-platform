# DS V3.0 PRD — 智能运营平台

## 版本范围

V3.0 实现从数据分析到用户运营的完整闭环，基于 V2.0 的用户分群能力构建多渠道触达平台。

| 模块 | 优先级 | 工作量估算 |
|------|--------|-----------|
| 标签体系 | P0 | 2 周 |
| 受众服务 | P0 | 2 周 |
| 运营计划（推送/短信/邮件/Webhook） | P0 | 3 周 |
| 流程画布 | P1 | 2 周 |
| A/B 测试 | P1 | 2 周 |
| 热力图分析 | P2 | 2 周 |
| **合计** | | **8 周** |

---

## 模块 1：标签体系

### 1.1 功能规格

标签体系是对用户进行特征标记的系统，标签可作为分析维度和运营目标筛选条件。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| TAG-001 | 标签列表 | 标签管理列表，展示标签名称、类型、更新时间、状态 |
| TAG-002 | 数值聚合标签 | 基于用户行为事件属性的聚合值生成标签，如"近 30 天消费总额"、"最近一次购买时间" |
| TAG-003 | 分群标签 | 将用户分群的成员标记为标签（如"高价值用户"）|
| TAG-004 | 状态转化标签 | 实时计算用户状态，如"新用户 → 活跃用户 → 沉默用户 → 流失用户" |
| TAG-005 | SQL 标签 | 通过自定义 SQL 定义标签值 |
| TAG-006 | 标签分类 | 标签按主题分类管理（如"用户属性类"、"行为类"、"价值类"）|
| TAG-007 | 标签计算 | 离线标签按日更新，实时标签秒级更新 |
| TAG-008 | 标签值类型 | 支持字符串、数值、布尔、日期、枚举值 |

### 1.2 标签定义

```typescript
interface TagDefinition {
  id: string;
  project_id: string;
  name: string;
  display_name: string;
  type: 'numeric_aggregate' | 'segment' | 'state_transition' | 'sql';
  value_type: 'string' | 'number' | 'bool' | 'datetime' | 'enum';
  enum_values?: string[];       // value_type=enum 时可选值列表
  
  // numeric_aggregate 类型配置
  aggregate_config?: {
    event_name: string;
    property?: string;           // 空则 COUNT 事件次数
    aggregation: 'sum' | 'avg' | 'max' | 'min' | 'count' | 'latest';
    time_range: number;          // 天数，0 表示不限
    value_mapping?: {            // 数值到标签值的映射
      ranges: { min: number; max?: number; label: string }[];
    };
  };
  
  // segment 类型配置
  segment_config?: {
    segment_id: string;
    mapping: { value: string };  // 在分群内标记为该值
  };
  
  // state_transition 类型配置
  transition_config?: {
    states: {
      name: string;
      conditions: SegmentRule;   // 满足条件进入该状态
      order: number;
    }[];
    default_state?: string;
  };
  
  // sql 类型配置
  sql_config?: {
    query: string;               // SELECT user_id, value FROM ...
  };
  
  refresh_type: 'daily' | 'realtime' | 'manual';
  status: 'active' | 'paused';
}
```

### 1.3 标签计算引擎

```sql
-- 数值聚合标签计算示例：近30天消费总额
INSERT INTO user_tags (project_id, tag_id, user_id, value, computed_at)
SELECT 
  :project_id, :tag_id,
  user_id,
  SUM((properties->>'amount')::numeric)::text as value,
  NOW()
FROM events
WHERE event_name = 'purchase'
  AND time > NOW() - INTERVAL '30 days'
GROUP BY user_id;
```

---

## 模块 2：受众服务

### 2.1 功能规格

受众是可复用的目标用户集合，供运营计划引用。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| AUD-001 | 非实时受众（T+1） | 基于已保存的分群创建，每日刷新 |
| AUD-002 | 实时规则受众 | 通过用户属性、行为规则实时筛选，实时计算 |
| AUD-003 | 实时标记受众 | 通过 OpenAPI 实时移入/移出用户 |
| AUD-004 | 受众列表 | 受众管理，展示受众类型、状态、覆盖人数、关联的运营计划 |
| AUD-005 | 受众在线判定 API | 通过 API 实时判断用户是否在受众范围内 |
| AUD-006 | 受众下载 API | 通过 API 下载完整受众包 |

### 2.2 受众存储

```sql
CREATE TABLE audiences (
  id            VARCHAR(32) PRIMARY KEY,
  project_id    VARCHAR(32) NOT NULL,
  name          VARCHAR(128) NOT NULL,
  type          VARCHAR(32) NOT NULL,  -- 'tplus1' | 'realtime_rule' | 'realtime_mark'
  
  -- type = tplus1
  segment_id    VARCHAR(32),
  
  -- type = realtime_rule
  rule_definition JSONB,
  
  status        VARCHAR(32) DEFAULT 'active',
  estimated_count BIGINT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 受众用户映射表
CREATE TABLE audience_users (
  id            BIGSERIAL PRIMARY KEY,
  audience_id   VARCHAR(32) NOT NULL,
  user_id       VARCHAR(255) NOT NULL,
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(audience_id, user_id)
);
```

---

## 模块 3：运营计划

### 3.1 功能规格

运营计划是触达用户的执行单元，支持多渠道、可配置的触达方式。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| CMP-001 | 创建运营计划 | 选择触达渠道、受众、内容、时间 |
| CMP-002 | App 推送 | 集成 FCM/APNs 推送通知，支持标题、正文、跳转链接、图片 |
| CMP-003 | 短信 | 集成 SMS 服务商，支持模板短信和自定义短信 |
| CMP-004 | 邮件 | 集成邮件服务商，支持 HTML 模板和变量替换 |
| CMP-005 | Webhook | 发送 HTTP POST 到指定 URL，自定义 payload 格式 |
| CMP-006 | 弹窗 | App/H5/小程序的页面弹窗，支持图片、文字、按钮 |
| CMP-007 | 计划类型 | 一次性计划 / 周期性计划（日/周/月）|
| CMP-008 | 触发方式 | 手动触发 / 定时触发 / 事件触发（用户触发某事件后自动发送）|
| CMP-009 | 频次控制 | 每个用户每天/每周最多接收 N 条消息 |
| CMP-010 | A/B 测试 | 同一计划支持多版本内容，按比例分流测试效果 |
| CMP-011 | 效果统计 | 发送数、送达数、打开数、点击数、后续转化数 |
| CMP-012 | 发送详情 | 查看每个用户的发送状态、失败原因 |

### 3.2 运营计划数据模型

```typescript
interface Campaign {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  
  // 渠道配置
  channels: {
    type: 'push' | 'sms' | 'email' | 'webhook' | 'popup';
    enabled: boolean;
    config: PushConfig | SMSConfig | EmailConfig | WebhookConfig | PopupConfig;
  }[];
  
  // 受众
  audience_id: string;
  
  // 时间配置
  schedule_type: 'immediate' | 'scheduled' | 'periodic' | 'event_triggered';
  scheduled_at?: string;       // 定时时间
  periodic_config?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;              // 如 "10:00"
    days_of_week?: number[];    // 周几 0-6
    days_of_month?: number[];   // 每月几号 1-31
  };
  event_trigger_config?: {
    event_name: string;
    filters?: Condition[];
    delay_minutes?: number;     // 触发后延迟发送
  };
  
  // 频次控制
  frequency_cap?: {
    max_count: number;
    time_window_hours: number;
  };
  
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
}
```

### 3.3 推送配置

```typescript
interface PushConfig {
  title: string;
  body: string;
  image_url?: string;
  deep_link?: string;
  click_action?: string;        // App 内页面路由
  data?: Record<string, string>;
  platform: {
    ios?: { sound?: string; badge?: number };
    android?: { channel_id?: string; priority?: 'high' | 'normal' };
  };
}
```

### 3.4 短信配置

```typescript
interface SMSConfig {
  template_id?: string;         // 短信模板 ID
  content: string;              // 支持变量 {{user_name}} {{code}}
  sign: string;                 // 短信签名
}
```

### 3.5 效果追踪

```sql
CREATE TABLE campaign_delivery (
  id              BIGSERIAL PRIMARY KEY,
  campaign_id     VARCHAR(32) NOT NULL,
  user_id         VARCHAR(255) NOT NULL,
  channel         VARCHAR(32) NOT NULL,
  status          VARCHAR(32) NOT NULL,  -- sent | delivered | opened | clicked | failed
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 追踪点击
-- 所有运营链接自动转为带追踪参数的短链接: https://ds.io/c/{campaign_id}/{user_id}
```

---

## 模块 4：流程画布

### 4.1 功能规格

流程画布提供可视化的多步骤用户运营流程编排能力。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| FC-001 | 画布编辑器 | 拖拽式可视化流程编辑，节点连线编排 |
| FC-002 | 受众节点 | 流程起点，定义进入流程的用户范围 |
| FC-003 | 动作节点 | 发送消息、Webhook 等执行动作 |
| FC-004 | 条件分支 | 根据用户属性/标签/行为分流（是/否分支）|
| FC-005 | 延迟节点 | 等待指定时间后继续执行（如等待 24 小时后发送提醒）|
| FC-006 | 退出条件 | 用户满足条件时退出流程（如用户在流程中已完成购买）|
| FC-007 | 多分支 | 支持 A/B 测试分支、多链路分支 |
| FC-008 | 实时触发 | 用户匹配受众后立即进入流程 |
| FC-009 | 效果看板 | 流程整体转化、各节点参与人数、流失情况 |

### 4.2 画布节点定义

```typescript
type CanvasNodeType = 'audience' | 'action' | 'condition' | 'delay' | 'exit' | 'split';

interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  position: { x: number; y: number };
  config: {
    // audience
    audience_id?: string;
    entry_type?: 'immediate' | 'scheduled' | 'realtime';
    entry_window_hours?: number;
    
    // action
    action_type?: 'send_push' | 'send_sms' | 'send_email' | 'webhook';
    campaign_id?: string;
    
    // condition
    condition_config?: {
      type: 'property' | 'event' | 'tag' | 'segment';
      property?: string;
      operator?: string;
      value?: any;
      event_name?: string;
    };
    
    // delay
    delay_config?: {
      type: 'relative' | 'absolute' | 'fixed';
      duration_minutes?: number;  // relative/fixed
      wait_until?: string;       // absolute time
      time_zone?: string;
      // fixed: 如 "每天 10:00"
      fixed_time?: string;
      fixed_days?: number[];     // 0=Sun, 6=Sat
    };
    
    // exit
    exit_config?: {
      type: 'completed_action' | 'not_match_condition' | 'timeout';
      timeout_days?: number;
    };
  };
}
```

### 4.3 画布流程示例

```
[受众节点: 新注册用户] → [延迟节点: 等待 24 小时]
    → [条件节点: 是否完成首次购买？]
        ├── 是 → [退出（已完成目标）]
        └── 否 → [动作节点: 发送推送 "您有优惠券待领取"]
                → [延迟节点: 等待 3 天]
                → [条件节点: 是否完成购买？]
                    ├── 是 → [退出]
                    └── 否 → [动作节点: 发送短信 "满减活动进行中"]
                            → [退出]
```

---

## 模块 5：A/B 测试

### 5.1 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| AB-001 | 创建实验 | 实验名称、描述、实验变量（版本数量 2-5）|
| AB-002 | 分流设置 | 流量分配比例、分桶方式（按用户 ID Hash 均匀分流）|
| AB-003 | 目标指标 | 选择实验的关键指标（事件 + 聚合方式）|
| AB-004 | 实验版本 | 每个版本可配置不同的实验参数（推送文案/UI 变体/算法参数）|
| AB-005 | 运行状态 | 待启动、运行中、暂停、结束、已发布 |
| AB-006 | 效果分析 | 各版本的目标指标对比、置信区间、显著性检验（p-value）|
| AB-007 | 深度下钻 | 各版本在不同用户分群/渠道上的效果差异 |
| AB-008 | 自动发布 | 实验达到显著性后自动推送最优版本 |

### 5.2 分流算法

```typescript
// 一致性 Hash 分桶，保证用户始终进入同一实验组
function assignVariant(userId: string, experimentId: string, variants: Variant[]): string {
  const hash = crypto.createHash('md5').update(`${experimentId}:${userId}`).digest('hex');
  const hashInt = parseInt(hash.substring(0, 8), 16);
  const bucket = hashInt % 10000;  // 0-9999
  
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.traffic_percent * 100;  // traffic_percent: 0-100, 精确到 0.01%
    if (bucket < cumulative) return variant.id;
  }
  return variants[variants.length - 1].id;
}
```

### 5.3 实验数据模型

```typescript
interface Experiment {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  
  // 变量定义
  variants: {
    id: string;
    name: string;
    description?: string;
    traffic_percent: number;    // 0-100
    config: Record<string, any>; // 版本参数
  }[];
  
  // 目标指标
  metrics: {
    event_name: string;
    aggregation: 'total_count' | 'unique_user' | 'sum' | 'avg' | 'rate';
    property?: string;
    operator?: '>' | '<';       // 期望方向（越大越好/越小越好）
  }[];
  
  // 分流参数
  hash_key: string;
  
  // 状态
  status: 'draft' | 'running' | 'paused' | 'finished';
  started_at?: TIMESTAMPTZ;
  finished_at?: TIMESTAMPTZ;
}
```

---

## 模块 6：热力图分析

### 6.1 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| HT-001 | Web 点击热力图 | 在页面截图/渲染上叠加点击热度色阶 |
| HT-002 | 区域划分 | 自动识别页面元素区域，统计每个区域的点击次数/占比 |
| HT-003 | 页面记录 | 记录被分析的页面 URL、分辨率、时间范围 |
| HT-004 | App 点击分析 | 上传 App 页面截图，叠加点击坐标数据 |
| HT-005 | 关注元素 | 手动标记关注元素，单独统计该元素的点击数据 |
| HT-006 | 数据筛选 | 按用户分群/设备/时间段筛选热力图数据 |

### 6.2 数据采集

```javascript
// JS SDK 采集点击坐标
ds.track('$heatmap_click', {
  $heatmap_x: 320,          // 点击 X 坐标
  $heatmap_y: 480,          // 点击 Y 坐标
  $screen_width: 1440,
  $screen_height: 900,
  $url: '/product/list',
  $element_path: 'div.container > div.list > div.item:nth-child(3) > button',
  $element_content: '加入购物车',
  $element_class: 'btn-primary',
  $element_id: 'add-cart-001',
});
```

---

## API 新增

```
# 标签
GET  /api/tags                 标签列表
POST /api/tags                 创建标签
GET  /api/tags/:id             标签详情
PUT  /api/tags/:id             更新标签
DELETE /api/tags/:id           删除标签
POST /api/tags/:id/compute     触发计算

# 受众
GET  /api/audiences            受众列表
POST /api/audiences            创建受众
GET  /api/audiences/:id        受众详情
POST /api/audiences/:id/estimate   预估人数
POST /api/audiences/judge      在线判定用户是否在受众中

# 运营计划
GET  /api/campaigns            运营计划列表
POST /api/campaigns            创建运营计划
GET  /api/campaigns/:id        计划详情
PUT  /api/campaigns/:id        更新计划
POST /api/campaigns/:id/start  启动
POST /api/campaigns/:id/pause  暂停
GET  /api/campaigns/:id/stats  效果统计

# 流程画布
GET  /api/canvases             流程列表
POST /api/canvases             创建流程
GET  /api/canvases/:id         流程详情
PUT  /api/canvases/:id         更新
POST /api/canvases/:id/start  启动

# A/B 测试
GET  /api/experiments          实验列表
POST /api/experiments          创建实验
GET  /api/experiments/:id      实验详情（含结果）
POST /api/experiments/:id/start 启动
POST /api/experiments/:id/finish 结束

# 热力图
POST /api/heatmap/events       上报点击事件
GET  /api/heatmap/render/:page_url 获取热力图渲染数据
```

---

## 验收标准

| # | 验收项 | 测试方法 |
|---|--------|---------|
| 1 | 数值聚合标签计算正确 | "近 7 天购买次数"标签值与 SQL COUNT 结果一致 |
| 2 | 标签每日自动刷新 | 第二天标签值反映前一天新增的数据 |
| 3 | 实时受众秒级判定 | 用户刚完成购买，实时受众"近 1 分钟购买用户"立即包含该用户 |
| 4 | 运营计划发送 | 创建推送计划，用户收到推送通知 |
| 5 | 事件触发计划 | 用户触发指定事件后 5 分钟内收到消息 |
| 6 | 流程画布完整执行 | 设定画布：新用户→等待 24 小时→发送推送，流程正确执行 |
| 7 | A/B 测试分流一致性 | 同一用户多次请求分配到同一版本 |
| 8 | 热力图数据采集 | 点击页面元素，热力图正确显示点击位置 |
