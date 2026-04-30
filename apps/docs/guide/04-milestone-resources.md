# 里程碑资源需求分析

> 本文档列出每个里程碑所需的资源、参考文档、验收标准和待决策项。
> 参考来源：神策官方文档、ThingsBoard 等同类平台、TimescaleDB 官方最佳实践。

---

## 已确认决策 (2026-04-29)

| 领域 | 决策 | 来源 |
|------|------|------|
| ORM | **Prisma** | 用户确认 |
| UI 组件库 | **shadcn/ui** + Tailwind | 用户确认 |
| 图表库 | **ECharts 5** | 用户确认 |
| Worker 技术 | **KafkaJS** (直接消费 Kafka) | 用户确认 |
| 漏斗分析 | **需要实现** | 用户确认 |
| 归因分析 | **需要实现** | 用户确认 |
| 设备保留策略 | **全部保留 2 年** (原始+聚合) | 用户确认 |
| 设备阶段定义 | **接受建议的 5 阶段模型** (注册→激活→运行→维护→退役) | 用户确认 |

---

## 总览图标

| 标记 | 含义 |
|------|------|
| ✅ | 已有明确方案，可直接开发 |
| 📖 | 有参考文档，需按规范实现 |
| 🔄 | 参考同类产品设计 |
| ❓ | 待决策项，需用户确认 |
| ✅🔨 | 已有决策，但需进一步确认具体实现方式 |

---

## Phase 1: 数据基础 (P0)

### M1: 基础设施搭建

| 维度 | 详情 |
|------|------|
| **参考文档** | 📖 神策数据模型：[manual.sensorsdata.cn](https://manual.sensorsdata.cn/sa/docs/tech_knowledge_model) |
| | 📖 神策私有化部署架构演进 |
| | 📖 TimescaleDB 官方文档：Hypertable + Continuous Aggregate |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| Docker Compose 配置 | PostgreSQL 16 / TimescaleDB 2-pg16 / Mosquitto 2 / Redis 7 / Kafka 7.7 | 已有 `docker-compose.yml` 骨架，需要确认 Kafka 版本 |
| ORM 选择 | Drizzle ORM vs Prisma | **❓ 待决策** |
| 数据库 Schema | Device/Sensor/User/Tenant/AlertRule/Dashboard 表 | ✅ `packages/core/src/types/` 已有完整类型定义 |
| TimescaleDB 超表 | `data_points` 超表 + 连续聚合 | 📖 TimescaleDB 官方 hypertable 文档 |

#### 验收标准

```
[P0] docker compose up 后所有 6 个服务健康运行
[P0] pnpm db:migrate 成功创建所有表
[P1] pnpm db:seed 成功插入测试数据
[P1] TimescaleDB 超表 chunk 间隔配置正确
[P2] 设备模拟器可通过 MQTT/HTTP 连接服务
```

#### ❓ 待决策项

| 问题 | 决策 | 参考 |
|------|------|------|
| ORM 选择 | ✅ **Prisma** | [prisma.io](https://prisma.io) |
| TimescaleDB 超表 chunk 间隔 | ✅ 默认 INTERVAL '1 day' | TimescaleDB 官方建议每个 chunk 约 1GB |

---

### M2: 数据接入 (Ingest HTTP)

| 维度 | 详情 |
|------|------|
| **参考文档** | 📖 神策数据接入 API：[manual.sensorsdata.cn](https://manual.sensorsdata.cn/sa/docs/tech_super_access/v0203) |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| HTTP 端点设计 | POST /api/v1/data/ingest 接收 DataPoint JSON | ✅ `packages/core/src/types/data-point.ts` 已有 DataPoint 定义 |
| 数据校验 Schema | Zod schema 校验 DataPoint 字段 | ✅ 核心类型已定义，需实现 Zod schema |
| Kafka Producer | 写入 Kafka topic `ssas.raw.events` | 🔄 Kafka 客户端库 (node-rdkafka 或 kafkajs) |
| 认证方式 | 数据上报是否需要 API Key 认证？ | **❓ 待决策** |

#### 神策参考：数据接入格式

神策 HTTP 数据接入的关键设计：

```
请求: POST http://host:8106/sa?project=default&token=xxx
编码: UTF-8 → Gzip → Base64 → URL-encode
数据: data=xxxxx&gzip=1  (单条) 或 data_list=xxxxx&gzip=1 (批量)
批量上限: 50 条/批
认证: URL query token (非 Header)
```

#### SSAS 适配设计（参考神策）

```
请求: POST /api/v1/data/ingest
Body: 直接 JSON (非编码), Content-Type: application/json
      批量: { "deviceId": "xxx", "dataPoints": [ ... ] }
      单条: { "deviceId": "xxx", "metricName": "temperature", "value": 36.5, "time": "..." }
认证: ❓ 待决策 (Header Bearer Token 或 API Key)
限制: 速率限制、单次最大 1000 条
```

#### 验收标准

```
[P0] POST /api/v1/data/ingest 接收合法 DataPoint 返回 200
[P0] 非法数据格式返回 400 + 错误详情
[P1] 批量上报 1000 条数据成功
[P1] 数据写入 Kafka topic 验证
[P2] Gzip 压缩传输支持
```

#### ❓ 待决策项

| 问题 | 选项 | 参考 |
|------|------|------|
| 数据上报是否需要认证？ | ✅ **开发阶段不认证**, 后续可通过 API Key 开启 | |
| Kafka 客户端库 | ✅ **KafkaJS** | |
| 批量上限 | 每批最大 1000 条是否合适？ | 神策 50 条/批 (实时), 导入工具 20000 条/批 (离线) |

---

### M3: 数据接入 (Ingest MQTT)

| 维度 | 详情 |
|------|------|
| **参考文档** | 🔄 ThingsBoard MQTT 主题设计：[thingsboard.io](https://thingsboard.io/docs/reference/mqtt-api/) |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| MQTT 主题命名 | 层次化主题设计 | 🔄 ThingsBoard 模式 |
| Payload 格式 | JSON 格式 | 🔄 参考主流 IoT 平台 |
| 设备认证 | MQTT 用户名/密码 或 TLS 证书 | **❓ 待决策** |
| QoS 策略 | QoS 0/1/2 的选择 | 🔄 参考 ThingsBoard |

#### 同类参考：ThingsBoard MQTT 主题设计

```
# 设备端遥测数据上报 (ThingsBoard 模式)
v1/devices/me/telemetry                    -- 基础主题
v1/devices/me/telemetry/HTTP                -- HTTP 方式

# 设备端属性
v1/devices/me/attributes                    -- 请求属性
v1/devices/me/attributes/response/+
v1/devices/me/attributes/response/request/${id}

# 网关模式 (一个网关代理多个子设备)
v1/gateway/telemetry                        -- 网关上报遥测
v1/gateway/connect                          -- 子设备连接
v1/gateway/disconnect                       -- 子设备断开
```

#### SSAS MQTT 主题设计（参考 ThingsBoard 适配传感器场景）

```
# 数据上报
ssas/v1/{deviceKey}/telemetry               -- 传感器数据上报
ssas/v1/{deviceKey}/telemetry/batch         -- 批量上报

# 设备状态
ssas/v1/{deviceKey}/status                  -- 设备在线/离线/错误状态

# 设备属性
ssas/v1/{deviceKey}/attributes              -- 设备属性查询/更新

# 网关模式
ssas/v1/gateway/{gatewayKey}/telemetry      -- 网关代子设备上报
ssas/v1/gateway/{gatewayKey}/connect        -- 子设备上线通知
ssas/v1/gateway/{gatewayKey}/disconnect     -- 子设备离线通知

# 服务端下发
ssas/v1/{deviceKey}/rpc                     -- RPC 指令 (预留)
ssas/v1/{deviceKey}/config                  -- 配置下发 (预留)
```

#### Payload 参考格式

```json
// 单条上报
{
  "ts": 1700000000000,
  "metric": "temperature",
  "value": 36.5,
  "quality": 100
}

// 批量上报
{
  "ts": 1700000000000,
  "values": {
    "temperature": 36.5,
    "humidity": 65.2,
    "pressure": 1013.2
  }
}

// 带标签 (tagged data)
{
  "ts": 1700000000000,
  "metrics": [
    { "name": "temperature", "value": 36.5, "tags": { "unit": "celsius" } }
  ]
}
```

#### 验收标准

```
[P0] 设备通过 MQTT 连接 Mosquitto 成功
[P0] MQTT 上报数据 → Kafka topic 验证
[P1] 批量上报 10 个 metric 解析正确
[P1] 非法 payload 返回错误码
[P2] 设备断线重连后数据不丢失 (QoS 1+)
```

#### ❓ 待决策项

| 问题 | 选项 | 参考 |
|------|------|------|
| MQTT 设备认证方式 | ✅ **两者都支持** (用户名/密码 + TLS 证书, 按设备配置) | |
| QoS 级别 | ✅ **QoS 1** (至少一次) | |

---

### M4: 时序存储

| 维度 | 详情 |
|------|------|
| **参考文档** | 📖 TimescaleDB 官方 IoT 文档：[docs.timescale.com](https://docs.timescale.com/tutorials/latest/iot/) |
| | 📖 神策存储架构：Kudu (WOS) + Parquet/HDFS (ROS) |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| Hypertable 设计 | `data_points` 超表, 按 time 分区 | 📖 TimescaleDB 文档 |
| Continuous Aggregates | 1min/5min/1h 预聚合视图 | 📖 TimescaleDB docs |
| Compression 策略 | TimescaleDB 原生压缩 | 📖 TimescaleDB docs |
| Retention 策略 | 原始数据/聚合数据保留时间 | **❓ 待决策** |
| COPY 写入 | 批量写入方式 | 📖 TimescaleDB docs |

#### 神策参考：存储架构设计理念

神策采用 ROLAP (非 MOLAP) 设计：
- **存储最细粒度明细数据** → 支持任意维度下钻
- **不预定义指标** → 查询时即时计算 (但我们用 Continuous Aggregate 加速)
- **追加为主** → 事件数据追加，有限删除能力
- **分层存储**：Kudu 实时写入 (WOS) → Parquet 批量查询 (ROS)

#### SSAS 存储设计 (参考神策 ROLAP + TimescaleDB)

```
TimescaleDB Hypertable:
  data_points: 原始粒度, 按时间分区, 按 device_id + metric_name 空间分区

Continuous Aggregates (预计算加速):
  metric_1min:  1 分钟粒度聚合   -- 保留 7 天
  metric_1hour: 1 小时粒度聚合   -- 保留 90 天
  metric_1day:  1 天粒度聚合     -- 保留 2 年

Compression:
  原始数据: 压缩 (chunk 超过 7 天后自动压缩)
  聚合数据: 无需压缩 (已聚合)

Retention:
  原始数据: 保留 90 天
  1min 聚合: 保留 7 天
  1hour 聚合: 保留 90 天 (实际上可更长)
  1day 聚合: 保留 2 年 (实际上永存)
```

#### 验收标准

```
[P0] data_points 超表创建成功, chunk 间隔正确
[P0] 写入 10 万条模拟数据, 查询返回正确
[P1] Continuous Aggregate 查询结果与原始查询一致
[P1] Compression 策略生效, 磁盘空间减少
[P2] 复杂查询 (多设备 + 时间范围 + 聚合) 在 5 秒内返回
```

#### ❓ 待决策项

| 问题 | 决策 |
|------|------|
| 保留策略 | ✅ **全部保留 2 年** (原始数据 + 1min 聚合 + 1hour 聚合) |
| 空间分区维度 | ✅ 按 device_id hash 分区, 分区数 = CPU 核数 |

---

### M5: API 路由 & Worker

| 维度 | 详情 |
|------|------|
| **参考文档** | 📖 神策 OpenAPI：[manual.sensorsdata.cn](https://manual.sensorsdata.cn/sa/docs/open_api_iface_doc/v0204) |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| API 框架 | Hono v4 | 🔥 已有明确选择 |
| 数据上报路由 | POST /api/v1/data/ingest | ✅ 类型已定义 |
| 数据查询路由 | GET /api/v1/data/query | ✅ `TimeSeriesQuery` 类型已定义 |
| Worker 框架 | BullMQ 或 直接 Kafka 消费 | **❓ 待决策** |

#### 神策参考：OpenAPI 认证

神策 OpenAPI 认证方式 (vs 数据接入层的 token 认证不同)：

```
Header:
  api-key: <API密钥>           → 对应 SSAS 的 API Key 认证
  sensorsdata-project: <项目名> → 对应 SSAS 的租户/项目概念
  Sensors-Language: ZH-CN

请求限制:
  <= 3 次请求/秒
  <= 10 并发请求

响应格式:
  {
    "code": "SUCCESS",
    "message": null,
    "data": { ... }
  }
```

#### SSAS API 设计要点

```typescript
// API 版本: /api/v1/...
// 响应格式:
interface ApiResponse<T> {
  code: number;        // 0 = success, >0 = error
  message: string;
  data?: T;
  error?: string;
}

// 分页请求参数
interface PaginationParams {
  page: number;        // 从 1 开始
  pageSize: number;    // 默认 20, 最大 100
}

// 分页响应
interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

#### 验收标准

```
[P0] POST /api/v1/data/ingest 返回成功, 数据写入 Kafka
[P0] Worker 消费 Kafka 消息, 写入 TimescaleDB
[P0] GET /api/v1/data/query 返回正确时序数据
[P1] API 响应格式统一 (code/message/data)
[P1] Worker 异常处理 (消费失败重试, 死信队列)
[P2] 数据端到端延迟 < 5 秒 (设备上报 → API 可查)
```

#### ❓ 待决策项

| 问题 | 选项 | 参考 |
|------|------|------|
| Worker 技术选型 | A) BullMQ (Redis 作为队列) | BullMQ 适合定时任务, 不适合流式 |
| | B) KafkaJS 直接消费 (流式) | |
| | C) 两者都支持 | |
| API 版本策略 | URL 路径版本 (/api/v1/) 还是 Header 版本？ | |

---

## Phase 2: 分析与告警 (P0-P1)

### M6: 事件分析引擎

| 维度 | 详情 |
|------|------|
| **参考文档** | 📖 神策事件分析 API：[manual.sensorsdata.cn](https://manual.sensorsdata.cn/sa/docs/queries_doc) |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| 分析查询接口 | POST /api/v1/analytics/event | 📖 神策 segmentation API |
| 聚合函数 | count/sum/avg/min/max/last 等 | ✅ core types 已定义 |
| 分组维度 | 按 device_id/metric_name/tags 分组 | 📖 神策 by_fields |
| 筛选条件 | 标签过滤、值范围过滤 | 📖 神策 filter conditions |
| 时间对比 | 环比/同比 | 📖 神策趋势分析 |

#### 神策参考：事件分析 API

```json
// 神策请求结构 (对应 SSAS 适配):
{
  "measures": [{
    "event_name": "$AppStart",
    "aggregator": "general",           // general | sum | avg | max | min | count_distinct
    "name": "启动次数"
  }],
  "from_date": "2022-10-08",
  "to_date": "2022-10-08",
  "unit": "DAY",                       // DAY | HOUR | WEEK | MONTH
  "by_fields": ["event.$AppStart.$country"],
  "filter": {
    "relation": "and",                 // and | or
    "conditions": [
      { "field": "event.$AppStart.$lib", "function": "equal", "params": ["Android"] }
    ]
  }
}
```

#### SSAS 分析 API 设计 (参考神策适配传感器)

```json
// SSAS 事件分析请求:
POST /api/v1/analytics/event
{
  "metricName": "temperature",        // 对应神策 event_name
  "aggregation": "avg",               // avg | sum | max | min | count | last
  "deviceIds": ["dev-001", "dev-002"], // 设备筛选
  "groupBy": ["deviceId", "tags.zone"], // 分组维度, 对应神策 by_fields
  "timeRange": {
    "start": "2026-04-01T00:00:00Z",
    "end": "2026-04-29T00:00:00Z"
  },
  "granularity": "1h",                // 1m | 5m | 1h | 1d, 对应神策 unit
  "filters": [                        // 对应神策 filter.conditions
    { "field": "tags.zone", "operator": "=", "value": "reactor-1" }
  ]
}
```

#### 验收标准

```
[P0] 单设备单 metric 的 count/avg 查询结果正确
[P0] 多设备聚合查询结果正确
[P1] 按维度分组查询正确
[P1] 筛选条件生效
[P1] 趋势分析 (环比/同比) 计算正确
[P2] 查询结果与直接 SQL 查询一致
```

#### ❓ 待决策项

无 — 神策文档提供了充分的 API 设计参考。

---

### M7: 告警规则引擎

| 维度 | 详情 |
|------|------|
| **参考文档** | 📖 神策智能预警：[manual.sensorsdata.cn](https://manual.sensorsdata.cn/sa/docs/guide_warning/) |
| | 🔄 ThingsBoard 告警规则链：[thingsboard.io](https://thingsboard.io/docs/user-guide/alarms/) |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| 规则条件类型 | 阈值 / 同比 / 波动 / 复合条件 | 📖 神策自定义规则预警 |
| 评估方式 | 定时拉取评估 vs 流式实时评估 | 🔄 参考神策 + ThingsBoard |
| 通知渠道 | Webhook / Email | ✅ 先实现 Webhook |
| 防重复 | 静默期 (Silence) 机制 | 🔄 参考 Prometheus Alertmanager |

#### 神策参考：预警条件类型

按天监控：
- `昨天` — 与昨天的指标值对比
- `上周同期` — 与上周同一天对比
- `预测值` — 与 Prophet 预测值对比
- `特定值` — 与固定数值对比
- `区间在` / `区间不在` — 在区间内/外

按小时监控：
- `上一小时` — 与上一小时对比
- `昨日同期` — 与昨日同一小时对比

#### ThingsBoard 参考：告警规则配置

ThingsBoard 告警规则包括：
- **告警类型**：告警名称/分类
- **严重级别**：CRITICAL / MAJOR / MINOR / WARNING / INDETERMINATE
- **条件**：`key > threshold` duration N times (持续 N 次满足触发)
- **清空条件**：`key < threshold` duration N times
- **告警详情**：动态模板 (支持占位符)

#### SSAS 告警设计 (阈值为主, P1 支持同比)

```
警报规则结构:
{
  "metric": "temperature",
  "condition": {
    "type": "threshold",           // threshold | change | anomaly
    "operator": ">",
    "value": 100,
    "duration": 3,                 // 连续 3 次满足才触发
    "windowMinutes": 5             // 评估窗口
  },
  "severity": "critical",          // info | warn | critical
  "channels": [
    { "type": "webhook", "config": { "url": "https://..." } }
  ],
  "silenceSeconds": 300,
  "enabled": true
}
```

#### 验收标准

```
[P0] 阈值告警规则创建成功
[P0] 设备数据超阈值触发 Webhook 通知
[P1] 连续 N 次满足才触发功能正常
[P1] 静默期内不重复通知
[P1] 告警恢复 (值回到阈值内) 自动发送恢复通知
[P2] 同比告警 (与昨天同一时间对比) 功能正常
```

#### ❓ 待决策项

| 问题 | 选项 | 参考 |
|------|------|------|
| 告警评估方式 | A) 定时评估 (每 1-5 分钟扫描一次) | 神策: 按天/按小时；ThingsBoard: 事件触发 |
| | B) 流式实时评估 (每条数据到达时评估) | |
| | C) 两者都支持 | |
| 通知渠道优先级 | 首批支持哪些？ | |
| | Webhook ✅ | 必须 |
| | Email ❓ | 需要 SMTP 配置 |
| | 短信/APP推送 ❓ | 需三方服务 |

---

### M8: Web 管理后台 (基础)

| 维度 | 详情 |
|------|------|
| **参考文档** | 🔄 ThingsBoard Web UI 布局参考 |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| 前端框架 | Next.js 15 App Router | ✅ 已有选择 |
| UI 组件库 | **❓ 待决策** | |
| 图表库 | ECharts 5 或 Chart.js | **❓ 待决策** |
| 布局方案 | 侧边栏导航 + 内容区 | 🔄 参考 ThingsBoard |

#### 验收标准

```
[P0] 侧边栏导航可用 (设备/数据/分析/告警/看板/设置)
[P0] 设备列表页可展示设备数据 (表格)
[P0] 设备详情页可查看实时数据曲线
[P1] 数据查询页: 选择设备+时间范围 → 图表展示
[P2] 页面加载时间 < 2s
```

#### ❓ 待决策项

| 问题 | 决策 |
|------|------|
| UI 组件库 | ✅ **shadcn/ui + Tailwind** |
| 图表库 | ✅ **ECharts 5** |

---

## Phase 3: 设备管理与画像 (P1)

### M9: 设备 CRUD API

| 维度 | 详情 |
|------|------|
| **参考文档** | 🔄 ThingsBoard device API：[thingsboard.io](https://thingsboard.io/docs/api/) |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| 设备 API | 完整 CRUD | ✅ 类型已定义 |
| 传感器 API | 设备下传感器管理 | ✅ Sensor 类型已定义 |
| 设备分组 API | 设备组 CRUD | ✅ DeviceGroup 类型已定义 |

#### ThingsBoard 参考：设备管理

ThingsBoard 设备实体设计：
- **Device Profile**：设备配置模板 (传输类型、告警规则、队列)
- **Attributes**：Client Attributes (设备端) / Shared Attributes (服务端) / Server Attributes (服务端私有)
- **Relations**：实体间关系 (如 设备→资产→客户)

#### SSAS 设备模型定位

```
SSAS Device (简单化设计):
├── 基础信息: name, deviceKey, type, status
├── 位置信息: location.name, location.lat/lng
├── 分组: groupId → DeviceGroup
├── 传感器: sensors[] → Sensor
├── 标签: tags[] → DeviceTag
└── 元数据: metadata (任意 JSON)

相比 ThingsBoard 简化:
- 无 Device Profile 概念 (设备类型通过 type 字段区分)
- 无单独 Attributes 三层结构 (合并到 metadata)
- 无 Relation 实体关系图 (通过 groupId 实现简单分组)
```

#### 验收标准

```
[P0] 设备 CRUD API 全部可用
[P0] 设备列表支持分页/搜索/按状态筛选
[P1] 设备下传感器管理 API 可用
[P1] 设备组 CRUD 可用
[P2] 批量导入设备 (CSV/JSON) 功能
```

#### ❓ 待决策项

| 问题 | 选项 | 参考 |
|------|------|------|
| deviceKey 生成策略 | A) 用户自定义 (如序列号) | ThingsBoard: Access Token |
| | B) 系统自动生成 UUID | |
| | C) 两者都支持 | |
| 设备上限 | 单租户最多允许多少设备？ | ❓ 需根据使用场景确定 |

---

### M10: 设备画像 (CDP Profile)

| 维度 | 详情 |
|------|------|
| **参考文档** | 📖 神策用户画像 (标签体系)：[manual.sensorsdata.cn](https://manual.sensorsdata.cn/sa/docs/tag_management/v0300) |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| 设备画像模型 | 在线率/数据量/异常次数等聚合指标 | ✅ 需定义计算逻辑 |
| 健康度评分 | 多维度评分算法 | **❓ 待决策** |

#### 神策参考：标签体系

神策用户画像标签体系：
- **9 种创建方式**：规则标签 / 计算标签 / 首次末次 / 行为分布 / 运算标签 / RFM / SQL / 生命周期
- **500 个标签/项目**，**4 级目录**，**24 层标签值**/标签
- **标签值类型**：字符串 / 数值 / 布尔 / 日期 / 列表
- **多规则组支持**：交/并/差逻辑

#### SSAS 设备画像设计 (参考神策简化)

```
设备画像标签 (首批支持):
1. 计算标签 (基于聚合): avg_temperature_24h, max_pressure_7d, total_events
2. 规则标签 (基于条件): status=online → "在线设备", error_count>10 → "异常设备"
3. 设备评分: health_score (0-100)
   - 在线率 40% + 数据完整率 30% + 异常率 30%
```

#### 验收标准

```
[P0] 设备画像聚合统计 (在线率/数据量/异常次数) 计算正确
[P1] 健康度评分公式配置化
[P2] 评分结果可解释 (显示各维度得分明细)
```

#### ❓ 待决策项

| 问题 | 选项 | 参考 |
|------|------|------|
| 设备健康度评分模型 | 需要明确定义各维度权重 | ❓ 需用户根据业务场景确定 |
| 画像更新频率 | A) 实时更新 (每条数据到达时) | |
| | B) 定时批量更新 (每 1h/6h/1d) | 神策: T+1 为主 |

---

### M11: 标签与分群 (CDP Tags & Segment)

| 维度 | 详情 |
|------|------|
| **参考文档** | 📖 神策标签管理：[manual.sensorsdata.cn](https://manual.sensorsdata.cn/sa/docs/tag_management/v0300) |
| | 📖 神策分群 API：[manual.sensorsdata.cn](https://manual.sensorsdata.cn/sa/docs/tech_super_api_function_group/v0205) |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| 标签管理 | 标签 CRUD, 规则标签 / 手动标签 | 📖 神策 9 种标签 |
| 分群引擎 | 条件组合构建分群 | 📖 神策分群 API |

#### 神策参考：分群规则结构

```json
{
  "type": "rules_relation",
  "relation": "and",                   // and | or
  "rules": [
    {
      "type": "event_rule",
      "measure": {
        "type": "event_measure",
        "event_name": "$AppStart",
        "aggregator": "general",
        "field": ""
      },
      "time_function": "relative_last",
      "time_params": ["7", "day"],
      "function": "greater",
      "params": ["5"]
    },
    {
      "type": "profile_rule",
      "field": "user_gender",
      "function": "equal",
      "params": ["女"]
    }
  ]
}
```

#### SSAS 分群设计 (参考神策适配传感器)

```json
// 设备分群规则
{
  "name": "异常高温度设备",
  "rules": {
    "relation": "and",
    "rules": [
      {
        "type": "metric_rule",
        "metricName": "temperature",
        "aggregation": "avg",
        "timeWindow": "1h",
        "operator": ">",
        "value": 80
      },
      {
        "type": "profile_rule",
        "field": "status",
        "operator": "=",
        "value": "online"
      }
    ]
  }
}
```

#### 验收标准

```
[P0] 手动标签 CRUD 可用
[P1] 规则标签自动计算 (如 status=error → tag "异常设备")
[P1] 设备分群条件构建正确
[P1] 分群计算结果与手动筛选一致
[P2] 定时重新计算分群 (Worker Job)
```

#### ❓ 待决策项

| 问题 | 选项 | 参考 |
|------|------|------|
| 分群计算频率 | A) 实时计算 (设备数据到达时更新分群) | 神策: T+1 为主 + 支持即时 |
| | B) 定时计算 (1h/6h/1d) | |

---

### M12: 设备生命周期

| 维度 | 详情 |
|------|------|
| **参考文档** | 🔄 神策生命周期标签 (预置增长模型) |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| 阶段模型 | 注册→激活→运行→维护→退役 | ❓ 待确认阶段划分 |
| 转换触发器 | 条件触发的阶段自动转换 | ❓ 待确认转换条件 |

#### 建议阶段划分 (参考 IoT 行业惯例)

```
注册(registered) → 激活(active) → 运行(running) → 维护(maintenance) → 退役(retired)
                                                                        ↑
                                                     故障(error) -------─┘

阶段转换条件示例:
  注册 → 激活: 设备首次上报数据
  激活 → 运行: 连续稳定运行 24 小时
  运行 → 维护: 异常率 > 10% 或 主动标记
  运行 → 故障: 连续 1 小时无数据
  维护 → 运行: 恢复正常
  任何 → 退役: 手动标记
```

#### 验收标准

```
[P0] 设备阶段自动转换 (首次数据上报 → 从注册到激活)
[P1] 手动修改设备阶段功能可用
[P1] 阶段转换历史可追溯
[P2] 基于阶段触发的动作 (如阶段→退役 自动禁用)
```

#### ❓ 待决策项

| 问题 | 决策 |
|------|------|
| 设备阶段划分 | ✅ **接受建议的 5 阶段模型** (注册→激活→运行→维护→退役) |
| "故障"判定 | ✅ **连续 30 分钟无数据判定为故障** |
| 阶段转换可逆性 | ✅ **完全可逆** (任何阶段之间可双向转换) |

---

## Phase 4: 看板与高级分析 (P1-P2)

### M13: 高级分析模型

| 维度 | 详情 |
|------|------|
| **参考文档** | 📖 神策漏斗 API：[manual.sensorsdata.cn](https://manual.sensorsdata.cn/sa/docs/guide_analytics_funnel/) |
| | 📖 神策留存 API：[manual.sensorsdata.cn](https://manual.sensorsdata.cn/sa/docs/guide_analytics_retention/) |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| 漏斗分析 | 多步骤转化查询 | ✅ 参考神策 API 设计 |
| 留存分析 | 初始/后续行为留存率 | ✅ 参考神策 API 设计 |
| 分布分析 | 数值分段分布 | ✅ 参考神策 API 设计 |
| 归因分析 | 5 种归因模型 | ✅ 类型已定义 |

#### 神策参考：漏斗关键设计细节

```
1. 封闭式漏斗: 用户必须从第 1 步进入才被统计
2. 用户去重: 计算的是 "独立用户数" 而非事件次数
3. 属性关联: 不同步骤通过 relevance_field 关联同一实体
4. 窗口期: max_convert_time, 范围 1 分钟 ~ 3650 天
5. 最少 2 步, 最多 64 步
```

#### SSAS 传感数据适配注意事项

```
SSAS 分析模型 vs 神策分析模型的关键差异:

漏斗分析 (Funnel):
  神策: 用户行为转化路径 (注册→下单→支付)
  SSAS: 传感数据链路转化 (设备A上报→设备B响应→系统确认)
  → 在 SSAS 场景中漏斗分析可能适用性有限, 需确认是否优先实现

留存分析 (Retention):
  神策: 用户活跃度 (第 N 天回访率)
  SSAS: 设备活跃度 (设备连续上报天数)
  → 直接适用, metric 为 "设备上报事件" 即可

分布分析 (Distribution):
  神策: 用户频次/总额分布
  SSAS: 设备值分布 (温度分布/压力分布/频率分布)
  → 直接适用, 对传感器数据非常有价值
```

#### 验收标准

```
[P0] 分布分析: 温度值分段分布统计正确
[P1] 留存分析: 设备连续活跃天数分析正确
[P1] 漏斗分析: 多步骤链路转化率计算结果正确
[P2] 归因分析: 各归因模型计算结果符合预期
[P2] 查询结果与手动 SQL 一致
```

#### ❓ 待决策项

| 问题 | 决策 |
|------|------|
| 漏斗分析 | ✅ **需要实现** — 设备链路转化场景 |
| 归因分析 | ✅ **需要实现** — 传感器级联触发场景 |

---

### M14: 可视化看板

| 维度 | 详情 |
|------|------|
| **参考文档** | 🔄 ThingsBoard Dashboard 设计参考 |
| | 🔄 Grafana Dashboard 设计参考 |

#### 所需资源

| 资源 | 说明 | 来源 |
|------|------|------|
| 看板 API | CRUD 看板 + Panel | ✅ Dashboard 类型已定义 |
| 拖拽布局 | react-grid-layout 或类似库 | **❓ 待决策** |
| 图表类型 | Line/Bar/Pie/Gauge/Table/Stat | ✅ ChartType 已定义 |

#### ThingsBoard + Grafana 参考

ThingsBoard Dashboard:
- 基于 Grid 布局 (columns + rows)
- 支持时间窗口选择器
- 别名 (Alias) 过滤设备/资产
- 状态小部件 (LED 指示)
- 仪表盘切换器

Grafana:
- Panel 为独立查询单元
- 支持混合数据源
- Dashboard 级变量

#### 验收标准

```
[P0] 看板 CRUD API 可用
[P0] 创建 Line 图表 (温度趋势) 正常渲染
[P1] 看板多 Panel 布局 (grid) 正常
[P1] 时间范围选择器 (1h/6h/24h/7d/30d) 可用
[P1] Gauge 图表 (实时值) 正常渲染
[P2] 看板自动刷新 (30s/1min/5min)
```

#### ❓ 待决策项

| 问题 | 选项 | 参考 |
|------|------|------|
| 看板布局方案 | A) react-grid-layout (可拖拽, 响应式) | |
| | B) 自定义简化布局 (固定网格) | |

---

### M15: Web 后台增强

参考 M8 的 UI 组件库决策延续。

---

## Phase 5: 企业能力 (P1-P2)

### M16: 认证体系

| 维度 | 详情 |
|------|------|
| **参考文档** | 📖 神策 OpenAPI 认证：[docs.sensorsdata.com](https://docs.sensorsdata.com/sa/docs/open_api_authentication/v0300) |

#### 神策参考：API Key 认证

```
神策 OpenAPI 认证:
  Header: api-key: <35位随机字符串>
  Header: X-Organization-Id: <组织ID>
  Header: sensorsdata-project: <项目名>
  速率限制: 3次/秒, 10并发
```

#### ❓ 待决策项

| 问题 | 选项 | 参考 |
|------|------|------|
| JWT 过期时间 | 默认 24h 是否合适？ | ❓ 需确认 |
| API Key 长度/格式 | 建议格式？ | 神策: 35 位随机字符串 |

---

### M17: RBAC 权限

| 维度 | 详情 |
|------|------|
| **参考文档** | 📖 神策权限管理：[manual.sensorsdata.cn](https://manual.sensorsdata.cn/sa/docs/lFcMqlTw) |

#### 神策参考：权限模型

```
神策权限模型:
1. 角色类型: 系统角色 (不可修改) + 自定义角色
2. 多角色: 一个成员可有多个角色 → 权限取并集
3. 权限维度:
   - 数据权限: 事件/用户表可见范围
   - 功能权限: 模型/模块使用权限
   - 脱敏设置: 中间打码 + 禁止分组筛选
```

#### 预置角色定义

```
SSAS 角色建议:
  Admin: 全部权限
  Operator: 设备管理 + 数据查看 + 告警管理
  Analyst: 数据查看 + 分析查询 + 看板管理
  Viewer: 数据查看 (只读)
```

#### ❓ 待决策项

| 问题 | 选项 | 参考 |
|------|------|------|
| 角色定义 | 上述 4 角色是否满足业务需求？ | ❓ 需确认 |
| 数据脱敏 | 是否需要支持？ | ❓ 需确认 (IoT 场景敏感数据较少) |

---

### M18: 多租户 & 审计

| 维度 | 详情 |
|------|------|
| **参考文档** | 🔄 主流 SaaS 多租户模式 |

#### 多租户隔离方案

```
三种隔离模式:
1. 数据库隔离: 每租户独立数据库 → 最安全, 成本高
2. Schema 隔离: 同库不同 Schema → 适中
3. 行级隔离: 每表加 tenant_id → 成本最低, ✅ 推荐

SSAS 选择: 行级隔离 (tenant_id)
  理由: 兼容私有化部署场景, 单租户时 tenant_id=固定值
```

#### ❓ 待决策项

| 问题 | 选项 | 参考 |
|------|------|------|
| 私有化 vs SaaS | ✅ **SaaS 多租户** (行级 tenant_id 隔离) | |
| 审计日志保留 | ✅ **保留 1 年** | |

---

## 全局已确认决策 (全部确认)

| # | 问题 | 决策 | 状态 |
|---|------|------|------|
| 1 | ORM 选择 | **Prisma** | ✅ |
| 2 | UI 组件库 | **shadcn/ui** | ✅ |
| 3 | 图表库 | **ECharts 5** | ✅ |
| 4 | Worker 技术 | **KafkaJS** | ✅ |
| 5 | 漏斗分析 | **需要实现** | ✅ |
| 6 | 归因分析 | **需要实现** | ✅ |
| 7 | 设备保留策略 | **全部保留 2 年** | ✅ |
| 8 | 设备阶段定义 | **5 阶段模型** (注册→激活→运行→维护→退役) | ✅ |
| 9 | MQTT 认证 | **用户名/密码 + TLS 都支持** (按设备配置) | ✅ |
| 10 | MQTT QoS 级别 | **QoS 1** (至少一次) | ✅ |
| 11 | 故障判定阈值 | **30 分钟**无数据判定为故障 | ✅ |
| 12 | 阶段转换可逆性 | **完全可逆** (任何阶段双向转换) | ✅ |
| 13 | HTTP 上报认证 | **开发阶段不认证** | ✅ |
| 14 | 部署模式 | **SaaS 多租户** (行级 tenant_id) | ✅ |
| 15 | 审计日志保留 | **1 年** | ✅ |
| 16 | 设备健康度评分 | **在线率40% + 数据完整率30% + 异常率30%** | ✅ |

---

## 文档参考索引

| 主题 | URL |
|------|-----|
| 神策数据接入 API | https://manual.sensorsdata.cn/sa/docs/tech_super_access/v0203 |
| 神策数据模型 | https://manual.sensorsdata.cn/sa/docs/tech_knowledge_model |
| 神策查询 API | https://manual.sensorsdata.cn/sa/docs/queries_doc |
| 神策 OpenAPI | https://manual.sensorsdata.cn/sa/docs/open_api_iface_doc/v0204 |
| 神策漏斗分析 | https://manual.sensorsdata.cn/sa/docs/guide_analytics_funnel/ |
| 神策留存分析 | https://manual.sensorsdata.cn/sa/docs/guide_analytics_retention/ |
| 神策标签管理 | https://manual.sensorsdata.cn/sa/docs/tag_management/v0300 |
| 神策分群 API | https://manual.sensorsdata.cn/sa/docs/tech_super_api_function_group/v0205 |
| 神策智能预警 | https://manual.sensorsdata.cn/sa/docs/guide_warning/ |
| 神策权限管理 | https://manual.sensorsdata.cn/sa/docs/lFcMqlTw |
| ThingsBoard MQTT | https://thingsboard.io/docs/reference/mqtt-api/ |
| ThingsBoard Alarms | https://thingsboard.io/docs/user-guide/alarms/ |
| TimescaleDB IoT | https://docs.timescale.com/tutorials/latest/iot/ |
