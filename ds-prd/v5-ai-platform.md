# DS V5.0 PRD — AI 与开放平台

## 版本范围

V5.0 为平台注入 AI 能力，同时构建开放生态和指标管理平台。

| 模块 | 优先级 | 工作量估算 |
|------|--------|-----------|
| AI 运营助手 | P0 | 3 周 |
| 指标平台 | P0 | 2 周 |
| 可视化报表 | P0 | 2 周 |
| 自定义 SQL 查询 | P1 | 1 周 |
| OpenAPI 平台 | P1 | 2 周 |
| 国际化 | P1 | 1 周 |
| **合计** | | **8 周** |

---

## 模块 1：AI 运营助手

### 1.1 功能规格

AI 运营助手基于大语言模型，提供自然语言交互的数据分析和运营能力。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| AI-001 | 智能圈人 | 用户通过自然语言描述人群特征，AI 自动转换为分群规则并估算人数 |
| AI-002 | 策略生成 | 基于行业知识库和用户分析结果，AI 自动生成运营策略建议 |
| AI-003 | 效果预测 | 运营活动执行前，AI 预测触达规模和预期效果提升 |
| AI-004 | 文案生成 | 根据品牌调性和运营目标，AI 自动生成推送文案/短信/邮件内容 |
| AI-005 | 分析问答 | 用户用自然语言提问数据问题，AI 自动生成分析查询并展示结果 |
| AI-006 | 策略诊断报告 | 活动结束后 AI 自动生成运营策略诊断报告，含效果评估和改进建议 |
| AI-007 | 趋势解读 | AI 自动识别指标异常波动并给出原因分析 |

### 1.2 AI 交互架构

```
用户输入（自然语言）
    │
    ▼
┌────────────────────────────┐
│   NLU 解析层               │
│   意图识别 → 实体提取       │
│   → 查询/动作类型判定       │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│   工具调用层                │
│   ┌──────────────────────┐ │
│   │ 工具: 查询事件       │ │
│   │ 工具: 创建分群       │ │
│   │ 工具: 创建运营计划   │ │
│   │ 工具: 生成报表       │ │
│   │ 工具: 查询用户       │ │
│   │ 工具: 知识库检索    │ │
│   └──────────────────────┘ │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│   LLM 生成层               │
│   上下文组装 → 调用 LLM    │
│   → 结果格式化 → 展示     │
└────────────────────────────┘
```

### 1.3 智能圈人对话示例

```
用户: "帮我找出近 30 天购买超过 3 次且客单价超过 200 元的 VIP 用户"

AI 分析:
1. 理解意图: 创建用户分群，条件包含行为事件和用户属性
2. 转换规则:
   - 事件条件: 近 30 天 purchase 事件 ≥ 3 次
   - 事件属性: 每次 purchase 的 amount 平均值 ≥ 200
   - 用户属性: level = 'VIP'
3. 预估人数: 约 2,350 人（展示预估结果）
4. 输出: 分群规则预览 + 预估人数 + 确认创建按钮

用户确认后 → 创建分群 "AI 智能圈人-近30天高客单VIP用户"
```

### 1.4 分析问答示例

```
用户: "上周的购买转化率相比前一周有什么变化？"

AI:
1. 意图识别: 对比分析，需要计算两个时间段的指标
2. 自动查询: 
   - 时间段 A: 上上周一 ~ 上上周日
   - 时间段 B: 上周一 ~ 上周日
   - 指标: 购买事件转化率（购买人数/页面浏览人数）
3. 生成回答:
   "上周的购买转化率为 **3.2%**，相比前一周的 **2.8%** 提升了 **14.3%**。
   主要增长来源：
   - 新用户转化率提升明显：从 1.5% → 2.1%（+40%）
   - 老用户转化率保持稳定：4.2% → 4.3%
   
   建议：分析新用户转化路径，确认是否有页面优化或者新用户专享活动的影响。"
```

### 1.5 AI 功能 API

```typescript
// AI 助手 API
interface AIRequest {
  project_id: string;
  prompt: string;                // 用户输入的自然语言
  context?: {
    page?: string;               // 当前页面上下文
    recent_queries?: string[];   // 最近的查询历史
  };
}

interface AIResponse {
  intent: 'create_segment' | 'create_campaign' | 'analyze' | 'generate_content' | 'explain';
  interpretation: string;        // AI 对用户输入的理解
  confidence: number;            // 0-1
  
  // 根据 intent 不同返回不同的 payload
  payload: 
    | SegmentSuggestion        // create_segment
    | CampaignSuggestion      // create_campaign
    | AnalysisResult           // analyze
    | ContentGenerationResult  // generate_content
    | ExplanationResult;       // explain
  
  suggestions?: string[];       // 后续追问建议
}
```

---

## 模块 2：指标平台

### 2.1 功能规格

指标平台统一管理业务指标的定义、计算和口径，确保数据一致性。

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| MP-001 | 指标管理 | 定义业务指标名称、计算公式、口径说明、单位 |
| MP-002 | 维度管理 | 统一管理分析维度及其取值 |
| MP-003 | 关系管理 | 定义指标与维度的关联关系 |
| MP-004 | 指标分类 | 按业务域分层管理指标（用户、交易、内容、增长）|
| MP-005 | 指标血缘 | 展示指标的衍生关系和数据来源 |
| MP-006 | 指标分析 | 选择指标 + 维度进行即席分析，支持下钻 |
| MP-007 | 指标搜索 | 按名称/业务域/标签搜索指标 |

### 2.2 指标定义

```typescript
interface Metric {
  id: string;
  project_id: string;
  name: string;                    // 英文标识
  display_name: string;            // 中文名称
  description: string;             // 业务口径说明
  unit: string;                    // 单位: 元/次/人/%
  
  category: string;                // 业务域: user | transaction | content | growth
  
  // 计算方式
  calculation: {
    type: 'event' | 'formula' | 'user_property';
    
    // type=event
    event_name?: string;
    aggregation?: 'total_count' | 'unique_user' | 'sum' | 'avg' | 'count_distinct';
    property?: string;
    filters?: Condition[];
    
    // type=formula（派生指标）
    formula?: string;              // 如 "m1 / m2 * 100"（引用其他指标）
    formula_metrics?: string[];    // 依赖的指标 ID
    
    // type=user_property
    user_property?: string;
    user_property_aggregation?: 'avg' | 'sum' | 'count';
  };
  
  // 可分组维度
  dimensions: string[];            // 可用维度列表
  
  status: 'active' | 'draft' | 'archived';
  created_at: TIMESTAMPTZ;
}
```

### 2.3 预置指标

| 指标名 | 显示名 | 计算逻辑 | 单位 |
|--------|--------|---------|------|
| dau | 日活跃用户数 | UV($pageview or $AnyEvent) | 人 |
| wau | 周活跃用户数 | 近 7 天 UV | 人 |
| mau | 月活跃用户数 | 近 30 天 UV | 人 |
| new_user_count | 新增用户数 | UV($first_day = true) | 人 |
| retention_day1 | 次日留存率 | 次日留存用户/新增用户 | % |
| conversion_rate | 转化率 | 目标事件 UV/起始事件 UV | % |
| avg_revenue | 人均消费金额 | SUM(购买金额)/UV(购买) | 元 |
| arpu | 每用户平均收入 | SUM(购买金额)/总 UV | 元 |

---

## 模块 3：可视化报表

### 3.1 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| RP-001 | 报表创建 | 从空白创建或使用模板创建报表 |
| RP-002 | 可视化组件 | 折线图、柱状图、堆叠柱状图、饼图/环图、表格、数值卡片、漏斗图 |
| RP-003 | 拖拽布局 | 自由拖拽组件位置，调整大小 |
| RP-004 | 数据源 | 选择分析模型（事件分析/漏斗/留存等）或指标平台作为数据源 |
| RP-005 | 过滤条件 | 报表级全局过滤条件，应用到所有组件 |
| RP-006 | 联动下钻 | 组件之间点击联动，点击某个维度值过滤整个报表 |
| RP-007 | 看板模式 | 全屏展示，用于大屏或投屏 |
| RP-008 | 定时刷新 | 报表按设定频率自动刷新（1 分钟/5 分钟/15 分钟/每小时/每天）|
| RP-009 | 报表订阅 | 定时通过邮件/企业微信发送报表截图或附件 |
| RP-010 | 移动端适配 | 报表在手机端可查看，组件自适应排布 |

### 3.2 组件定义

```typescript
interface ReportComponent {
  id: string;
  type: 'line' | 'bar' | 'stacked_bar' | 'pie' | 'table' | 'stat_card' | 'funnel';
  title: string;
  position: { x: number; y: number; w: number; h: number };  // 12 列网格布局
  config: {
    // 数据源
    data_source: {
      type: 'event_analysis' | 'funnel' | 'retention' | 'metric';
      metric_id?: string;           // 引用指标平台的指标
      event_name?: string;          // 事件分析
      aggregation?: string;
      filters?: Condition[];
      group_by?: string;
    };
    
    // 样式
    style?: {
      color_scheme?: string;
      show_legend?: boolean;
      show_data_label?: boolean;
      show_grid?: boolean;
      smooth?: boolean;             // 折线图平滑
      is_percent?: boolean;         // 百分比显示
    };
    
    // 交互
    interaction?: {
      drill_down_dimension?: string; // 下钻维度
      link_to_report?: string;       // 点击跳转报表
    };
  };
}
```

### 3.3 报表订阅

```typescript
interface ReportSubscription {
  id: string;
  report_id: string;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;                    // 如 "09:00"
    days_of_week?: number[];         // 每周几
    day_of_month?: number;           // 每月几号
  };
  channels: {
    email?: { recipients: string[] };
    wechat_work?: { webhook_url: string };
    dingtalk?: { webhook_url: string };
  };
  format: 'screenshot' | 'pdf' | 'csv';
  status: 'active' | 'paused';
}
```

---

## 模块 4：自定义 SQL 查询

### 4.1 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| SQ-001 | SQL 编辑器 | 语法高亮、自动补全、格式化 |
| SQ-002 | 表名提示 | 自动提示可查询的表（events、users、dimension_tables 等）|
| SQ-003 | 查询执行 | 异步执行 SQL，显示执行进度 |
| SQ-004 | 结果展示 | 表格展示结果，支持翻页、搜索 |
| SQ-005 | 可视化 | 查询结果一键转换为折线图/柱状图/饼图 |
| SQ-006 | 保存查询 | 保存 SQL 查询为书签，可添加描述 |
| SQ-007 | 导出结果 | 导出为 CSV/Excel/JSON |
| SQ-008 | 查询历史 | 保存最近 50 条查询历史 |
| SQ-009 | SQL 安全 | 仅支持 SELECT 查询，禁写/禁删，超时限制（60 秒）|

### 4.2 SQL 约束

```typescript
// SQL 执行安全策略
const SQL_POLICY = {
  allowed_commands: ['SELECT', 'WITH', 'EXPLAIN'],
  forbidden_commands: ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT'],
  max_execution_seconds: 60,
  max_result_rows: 10000,
  from_table_whitelist: ['events', 'users', 'dimension_tables.*'],
  tenant_filter: true,               // 自动追加 project_id 过滤
};
```

---

## 模块 5：OpenAPI 平台

### 5.1 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| OA-001 | API 文档 | 交互式 API 文档（Swagger UI）|
| OA-002 | API Key 管理 | 创建/吊销 API Key，设置权限范围和速率限制 |
| OA-003 | 数据导入 API | 通过 API 导入事件数据和用户属性 |
| OA-004 | 数据导出 API | 通过 API 查询分析结果和导出原始数据 |
| OA-005 | 受众 API | 在线判定用户是否在受众内、获取受众包 |
| OA-006 | Webhook 事件 | 配置 Webhook 订阅平台内事件（数据到达、告警触发等）|
| OA-007 | SDK 自动生成 | 基于 OpenAPI Schema 自动生成客户端 SDK |
| OA-008 | 使用统计 | API 调用次数、延迟、错误率统计 |

### 5.2 OpenAPI 路由

```typescript
// OpenAPI 路由（独立域名: api.ds.io）
const OPEN_API_ROUTES = [
  // 数据导入
  { path: '/v1/events/import', method: 'POST', desc: '批量导入事件数据' },
  { path: '/v1/users/profiles', method: 'POST', desc: '批量设置用户属性' },
  { path: '/v1/items/upsert', method: 'POST', desc: '写入 Items 数据' },
  
  // 数据查询
  { path: '/v1/analytics/events', method: 'POST', desc: '事件分析查询' },
  { path: '/v1/analytics/funnels', method: 'POST', desc: '漏斗分析查询' },
  { path: '/v1/analytics/retention', method: 'POST', desc: '留存分析查询' },
  { path: '/v1/analytics/segments/{id}/users', method: 'GET', desc: '获取分群用户列表' },
  
  // 受众
  { path: '/v1/audiences/judge', method: 'POST', desc: '在线判定用户是否在受众内' },
  { path: '/v1/audiences/{id}/download', method: 'GET', desc: '获取受众包' },
  
  // API Key 认证
  // Header: Authorization: Bearer {api_key}
];
```

### 5.3 API Key 认证

```typescript
interface ApiKey {
  id: string;
  project_id: string;
  name: string;
  key_prefix: string;           // 展示前 8 位: "ds_abc123..."
  key_hash: string;             // 存储哈希值
  permissions: {
    resources: string[];        // 可访问的 API 资源
    rate_limit: {
      requests_per_minute: number;
      requests_per_day: number;
    };
    ip_whitelist?: string[];    // IP 白名单
  };
  expires_at?: TIMESTAMPTZ;
  last_used_at?: TIMESTAMPTZ;
  status: 'active' | 'revoked';
  created_at: TIMESTAMPTZ;
}
```

---

## 模块 6：国际化

### 6.1 功能规格

| 需求 ID | 功能 | 描述 |
|---------|------|------|
| I18N-001 | 多语言界面 | 支持中文/英文界面切换 |
| I18N-002 | 多时区 | 项目独立配置时区，分析查询按项目时区聚合 |
| I18N-003 | 日期格式 | 支持不同区域日期格式（YYYY-MM-DD / DD/MM/YYYY / MM/DD/YYYY）|
| I18N-004 | 货币格式 | 支持多币种展示 |

### 6.2 国际化方案

```typescript
// 前端 i18n 方案
import { useTranslation } from 'react-i18next';

// 语言包结构
const locales = {
  'zh-CN': {
    'nav.analytics': '分析',
    'nav.engagement': '运营',
    'nav.settings': '设置',
    'analytics.event_analysis': '事件分析',
    'analytics.funnel': '漏斗分析',
    'common.save': '保存',
    'common.export': '导出',
    'time.today': '今天',
    'time.yesterday': '昨天',
    'time.last_7_days': '最近 7 天',
  },
  'en-US': {
    'nav.analytics': 'Analytics',
    'nav.engagement': 'Engagement',
    'nav.settings': 'Settings',
    'analytics.event_analysis': 'Event Analysis',
    'analytics.funnel': 'Funnel Analysis',
    'common.save': 'Save',
    'common.export': 'Export',
    'time.today': 'Today',
    'time.yesterday': 'Yesterday',
    'time.last_7_days': 'Last 7 Days',
  },
};

// 时区处理：所有存储使用 UTC，展示时按项目时区转换
const PROJECT_TIMEZONE = 'Asia/Shanghai'; // 项目配置
```

---

## API 新增

```
# AI 助手
POST /api/ai/chat                  AI 对话
POST /api/ai/segment-suggestion    AI 智能圈人建议
POST /api/ai/content-generate      AI 文案生成
POST /api/ai/diagnose              AI 策略诊断

# 指标平台
GET  /api/metrics                  指标列表
POST /api/metrics                  创建指标
GET  /api/metrics/:id              指标详情
PUT  /api/metrics/:id              更新指标
GET  /api/metrics/:id/analyze      指标分析

# 报表
GET  /api/reports                  报表列表
POST /api/reports                  创建报表
GET  /api/reports/:id              报表详情
PUT  /api/reports/:id              更新报表
POST /api/reports/:id/preview      预览报表
POST /api/reports/:id/subscribe    订阅报表

# 自定义 SQL
POST /api/query/sql                执行 SQL 查询
GET  /api/query/history            查询历史

# OpenAPI（独立路由）
POST /api/v1/events/import         导入事件
POST /api/v1/users/profiles        设置用户属性
GET  /api/v1/analytics/events      事件分析
POST /api/v1/audiences/judge       受众判定

# API Key 管理
GET  /api/admin/api-keys           API Key 列表
POST /api/admin/api-keys           创建 API Key
DELETE /api/admin/api-keys/:id     吊销

# 国际化
PUT  /api/admin/projects/:id/timezone   修改项目时区
GET  /api/i18n/:lang                    获取语言包
```

---

## 验收标准

| # | 验收项 | 测试方法 |
|---|--------|---------|
| 1 | AI 自然语言圈人 | 输入"近 7 天购买 > 2 次的女性用户"，AI 正确生成分群规则 |
| 2 | AI 分析问答 | "上周的 DAU 趋势如何？" AI 正确查询并展示趋势 |
| 3 | 文案生成 | AI 生成符合品牌调性的推送文案 |
| 4 | 指标平台口径统一 | 指标在不同报表中数值一致 |
| 5 | 报表拖拽布局 | 添加/移动/删除组件，布局正确保存 |
| 6 | 组件联动下钻 | 点击饼图某维度，其他组件按该维度过滤 |
| 7 | 自定义 SQL | 执行 SELECT 查询，返回正确结果 |
| 8 | SQL 安全约束 | INSERT/UPDATE/DELETE 被拦截 |
| 9 | OpenAPI 认证 | 非法 API Key 请求返回 401 |
| 10 | OpenAPI 受众判定 | POST /v1/audiences/judge 返回用户是否在受众内 |
| 11 | 国际化切换 | 切换英文后界面全部显示英文 |
| 12 | 多时区 | 项目设置为美国时区，日报表按美东时间聚合 |
