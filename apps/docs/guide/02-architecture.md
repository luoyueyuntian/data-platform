# SSAS 平台架构设计

> 参考对标：神策数据平台，将用户行为分析模式映射到物联网传感器数据领域

---

## 核心映射

```
神策 (用户行为分析)          SSAS (传感器数据平台)
────────────────────────────────────────────────
User  (用户)           →  Device  (设备)
Event (行为事件)        →  DataPoint (传感数据点)
Item  (物品)           →  Sensor  (传感器/部件)
distinct_id (用户ID)   →  device_id (设备标识)
event (事件名)          →  metric (指标名)
profile (用户属性)      →  device_info (设备属性)
```

---

## 一、系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                     应用层 (apps/)                                │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐  │
│  │ API 网关  │  │ Web 管理后台   │  │ Worker   │  │ Docs 文档  │  │
│  └─────┬────┘  └──────┬───────┘  └────┬─────┘  └────────────┘  │
└────────┼──────────────┼───────────────┼─────────────────────────┘
         │              │               │
┌────────┴──────────────┴───────────────┴─────────────────────────┐
│                   服务层 (packages/)                              │
│                                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  │auth  │ │api   │ │ingest│ │stor. │ │anal. │ │alert │        │
│  │认证   │ │路由  │ │数据   │ │时序   │ │分析   │ │告警   │        │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘        │
│                        ┌──────┐ ┌──────┐                       │
│                        │cdp   │ │ mqtt │                       │
│                        │画像   │ │SDK   │                       │
│                        └──────┘ └──────┘                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ database            ┌──────┐                              │ │
│  │ ORM/迁移/Repository  │ core │  ← 零依赖基础库              │ │
│  │                     │ 类型  │                              │ │
│  └─────────────────────┴──────┘                              │ │
└───────────────────────────────────────────────────────────────┘
         │              │               │
┌────────┴──────────────┴───────────────┴─────────────────────────┐
│                   基础设施层 (docker/)                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ ┌─────────┐  │
│  │PostgreSQL│ │Timescale │ │ Mosquitto│ │Redis │ │ Kafka   │  │
│  │ 业务数据  │ │ 时序数据  │ │ MQTT代理  │ │缓存  │ │ 消息队列 │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────┘ └─────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## 二、数据管道

```
数据源 → 采集层 → 缓冲层 → 处理层 → 存储层 → 查询层
```

| 层次 | 组件 | 技术选型 |
|------|------|---------|
| 采集层 | HTTP API / MQTT / TCP | Nginx + 自定义服务 |
| 缓冲层 | 消息队列 | Kafka |
| 处理层 | ETL / 聚合 / 告警 | Worker (定时/流式) |
| 存储层 | 时序 / 业务 / 缓存 | TimescaleDB / PostgreSQL / Redis |
| 查询层 | REST API / SQL | Hono + Impala 模式 |

---

## 三、领域模型

```
┌─────────────────────────────────────────────┐
│                Device (设备)                 │
│  id, device_key, type, status, location,    │
│  group, metadata, last_seen_at              │
│  → 对应神策 User                            │
└─────────────────────┬───────────────────────┘
                      │ 一对多
                      ▼
┌─────────────────────────────────────────────┐
│              DataPoint (数据点)              │
│  device_id, time, metric_name, value,       │
│  sensor_id?, tags{}, quality (0-100)        │
│  → 对应神策 Event                           │
└─────────────────────┬───────────────────────┘
                      │ 关联
                      ▼
┌─────────────────────────────────────────────┐
│               Sensor (传感器)                │
│  id, device_id, type, unit, range,          │
│  precision, calibration                     │
│  → 对应神策 Item                            │
└─────────────────────────────────────────────┘
```

---

## 四、Package 一览

| Package | 职责 | 对标神策 |
|---------|------|---------|
| `@ssas/core` | 类型定义、常量、工具函数 | — |
| `@ssas/database` | ORM 模型、迁移、Repository | 数据仓库 |
| `@ssas/ingest` | 数据接入 (HTTP/MQTT/TCP) | SDK + 接入层 |
| `@ssas/storage` | 时序存储 (TimescaleDB/InfluxDB) | Kudu + Parquet |
| `@ssas/analytics` | 分析引擎 (14 个模型) | 分析云 |
| `@ssas/alerting` | 告警规则引擎 | 智能预警 |
| `@ssas/cdp` | 设备画像、标签、分群 | 用户画像 CDP |
| `@ssas/auth` | 认证、RBAC 权限 | 权限管理 |
| `@ssas/api` | API 路由定义、校验 | API 网关 |
| `@ssas/mqtt` | MQTT 客户端 SDK (设备端) | SDK |
| `@ssas/ui` | 前端组件库 | — |

---

## 五、目录结构

```
sensor-data/
├── packages/           # 11 个共享包
│   ├── core/           → types/, constants/, utils/
│   ├── database/       → models/, repositories/, migrations/
│   ├── ingest/         → http/, mqtt/, tcp/, transform/, buffer/
│   ├── storage/        → timescale/, influx/, query/
│   ├── analytics/      → aggregation/, window/, timeseries/, query/
│   ├── alerting/       → rules/, channels/, scheduler/
│   ├── cdp/            → profile/, tags/, segment/, lifecycle/
│   ├── auth/           → jwt/, rbac/, providers/
│   ├── api/            → routers/, middleware/, validators/
│   ├── mqtt/           → (standalone SDK)
│   └── ui/             → components/, hooks/, layouts/
│
├── apps/               # 4 个可部署应用
│   ├── api/            → API 网关服务
│   ├── web/            → Next.js 管理后台
│   ├── worker/         → 后台任务 Worker
│   └── docs/           → VitePress 文档
```

---

## 六、数据流示例

### 6.1 设备上报数据

```
Device (MQTT) → Mosquitto → ingest/mqtt → Kafka → Worker
                                                      │
                                          ┌───────────┴───────────┐
                                          ▼                      ▼
                                    TimescaleDB              Alert Eval
                                    (时序存储)                  (告警判定)
                                          │                      │
                                          ▼                      ▼
                                    API Query              Webhook/通知
```

### 6.2 平台用户查询

```
Browser → app-web → app-api/routes → analytics/engine
                                          │
                                    storage/query
                                          │
                                    TimescaleDB
                                          │
                                    JSON Response → Browser Chart
```

---

## 七、关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| API 框架 | Hono (轻量) 或 Fastify | 高性能、TypeScript 原生 |
| 时序存储 | TimescaleDB (PostgreSQL 扩展) | 支持 SQL、连续聚合、与业务库同生态 |
| 消息队列 | Kafka | 高吞吐、持久化、流处理 |
| 分析引擎 | 应用层实现 (非 MOLAP) | ROLAP 理念，支持任意维度下钻 |
| 部署 | Docker Compose (开发) / K8s (生产) | 兼容私有化部署需求 |

---

## 八、实施路线

### Phase 1: 数据基础 (P0)
- core 类型定义完成
- database 模型 + TimescaleDB 超表
- ingest HTTP + MQTT 数据接入
- storage 时序写入/查询
- app-api 数据上报 API

### Phase 2: 分析与告警 (P0-P1)
- analytics 事件分析引擎
- alerting 告警规则引擎
- app-worker 定时聚合 + 告警评估
- app-web 基础管理页面

### Phase 3: 设备管理与画像 (P1)
- cdp 设备画像/标签/分群
- 设备生命周期管理
- 完整 CRUD API

### Phase 4: 看板与高级分析 (P1-P2)
- 漏斗/留存/分布分析
- 可视化看板
- 数据导出

### Phase 5: 企业能力 (P1-P2)
- auth RBAC 权限体系
- 多租户
- 审计日志

---

## 九、神策功能对照表

| 神策功能 | SSAS 实现 | 状态 |
|---------|-----------|------|
| 数据采集 SDK | ingest + mqtt | 骨架 |
| Event-User-Item 模型 | Device-DataPoint-Sensor | 类型定义 |
| 事件分析 | analytics/aggregation | 骨架 |
| 漏斗分析 | analytics/aggregation/funnel | 未实现 |
| 留存分析 | analytics/aggregation/retention | 未实现 |
| 分布分析 | analytics/aggregation/distribution | 未实现 |
| 归因分析 | analytics/aggregation/attribution | 未实现 |
| 用户画像 CDP | cdp | 骨架 |
| 可视化看板 | Dashboard API + web | 未实现 |
| 告警预警 | alerting | 骨架 |
| 权限管理 | auth RBAC | 骨架 |
| Sensors AI | 预留 | 未实现 |
