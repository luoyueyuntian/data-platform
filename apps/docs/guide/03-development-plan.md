# SSAS 平台开发计划

> 基于架构设计，分为 5 个 Phase、18 个里程碑，按依赖顺序执行。

---

## 依赖总图

```
Phase 1 ──────→ Phase 2 ──────→ Phase 3 ──────→ Phase 4
   │                                │                │
   └────────────┬───────────────────┘                │
                ▼                                   ▼
          Phase 5 (Enterprise)             Phase 4 (续)
```

前一 Phase 未完成，后一 Phase 不启动。Phase 内里程碑可按依赖并行。

---

## Phase 1: 数据基础 (P0)

**目标**：完成"设备上报 → 数据接入 → 时序存储 → API 查询"全链路闭环。

### M1: 基础设施搭建

| 任务 | 文件 | 说明 |
|------|------|------|
| 1.1 启动 docker 服务 | `docker/docker-compose.yml` | PostgreSQL + TimescaleDB + Mosquitto + Redis + Kafka |
| 1.2 选择 ORM 并集成 | `packages/database/package.json` | 选择 Prisma 或 Drizzle，添加依赖 |
| 1.3 定义数据库 Schema | `packages/database/src/models/` | 实现 Device/Sensor/User/Tenant/AlertRule/Dashboard 表 |
| 1.4 TimescaleDB 超表 | `packages/database/src/migrations/` | 创建 `data_points` 超表 + 连续聚合视图 |
| 1.5 初始化脚本 | `scripts/setup.sh` | 完善：`docker compose up` + `db:migrate` + `db:seed` |

**交付物**：`docker compose up` 后所有服务可用，`pnpm db:migrate` 成功创建表结构。

### M2: 数据接入 (Ingest HTTP)

| 任务 | 文件 | 说明 |
|------|------|------|
| 2.1 HTTP server | `packages/ingest/src/http/server.ts` | 基于 Hono 的 POST /ingest 端点 |
| 2.2 数据校验 | `packages/ingest/src/http/validator.ts` | Zod schema 校验 DataPoint 格式 |
| 2.3 Kafka producer | `packages/ingest/src/buffer/producer.ts` | 将原始数据写入 Kafka topic |
| 2.4 数据标准化 | `packages/ingest/src/transform/normalizer.ts` | 统一 DataPoint 格式 |
| 2.5 数据补充 | `packages/ingest/src/transform/enricher.ts` | IP→地理位置、设备信息补充 |

### M3: 数据接入 (Ingest MQTT)

| 任务 | 文件 | 说明 |
|------|------|------|
| 3.1 MQTT 客户端 | `packages/ingest/src/mqtt/client.ts` | MQTT v3.1/v5 连接管理 |
| 3.2 主题路由 | `packages/ingest/src/mqtt/topics.ts` | 根据 topic 映射到 metric/device |
| 3.3 消息解析 | `packages/ingest/src/mqtt/parser.ts` | 解析 MQTT payload → DataPoint |

### M4: 时序存储

| 任务 | 文件 | 说明 |
|------|------|------|
| 4.1 批量写入 | `packages/storage/src/timescale/writer.ts` | COPY 协议批量写入，自动 chunk 管理 |
| 4.2 时序查询 | `packages/storage/src/timescale/reader.ts` | 按时间/设备/metric 查询，支持聚合参数 |
| 4.3 连续聚合管理 | `packages/storage/src/timescale/continuous-aggregate.ts` | 1min/5min/1h 预聚合视图自动刷新 |
| 4.4 查询构建器 | `packages/storage/src/query/builder.ts` | SQL 构建 + 参数化查询 |
| 4.5 查询缓存 | `packages/storage/src/query/cache.ts` | Redis 缓存高频查询 |

### M5: API 路由 & Worker

| 任务 | 文件 | 说明 |
|------|------|------|
| 5.1 API 服务入口 | `apps/api/src/index.ts` | Hono 服务器，注册所有路由 |
| 5.2 数据上报路由 | `apps/api/src/routes/data.ts` | POST /api/v1/data/ingest，代理到 ingest |
| 5.3 数据查询路由 | `apps/api/src/routes/data.ts` | GET /api/v1/data/query |
| 5.4 Worker 入口 | `apps/worker/src/index.ts` | BullMQ worker，消费 Kafka |
| 5.5 数据写入 Job | `apps/worker/src/jobs/ingest.ts` | 从 Kafka 消费 → transform → 写入 TimescaleDB |

**Phase 1 验证**：
```
设备模拟器 → POST /api/v1/data/ingest → Kafka → Worker → TimescaleDB → GET /api/v1/data/query?deviceId=xxx
```

---

## Phase 2: 分析与告警 (P0-P1)

**目标**：实现事件分析引擎 + 告警规则引擎，让数据产生业务价值。

### M6: 事件分析引擎

| 任务 | 文件 | 说明 |
|------|------|------|
| 6.1 指标统计 | `packages/analytics/src/aggregation/event-analysis.ts` | count/sum/avg/min/max 查询 + 分组 |
| 6.2 滚动窗口 | `packages/analytics/src/window/tumbling.ts` | 1m/5m/1h/1d 等固定窗口聚合 |
| 6.3 趋势分析 | `packages/analytics/src/timeseries/trend.ts` | 环比/同比计算 |
| 6.4 查询引擎 | `packages/analytics/src/query/engine.ts` | 查询计划构建、执行、结果格式化 |
| 6.5 分析路由 | `apps/api/src/routes/analytics.ts` | POST /api/v1/analytics/event + trend |

### M7: 告警规则引擎

| 任务 | 文件 | 说明 |
|------|------|------|
| 7.1 规则评估 | `packages/alerting/src/rules/rule-evaluator.ts` | 阈值/同比/波动 等条件判定 |
| 7.2 规则表达式 | `packages/alerting/src/rules/rule-parser.ts` | DSL 解析 |
| 7.3 Webhook 通知 | `packages/alerting/src/channels/webhook.ts` | HTTP POST 通知 |
| 7.4 定时评估 | `packages/alerting/src/scheduler/interval.ts` | 定期拉取数据并评估规则 |
| 7.5 告警路由 | `apps/api/src/routes/alerts.ts` | CRUD /api/v1/alerts/rules |
| 7.6 Worker 告警 Job | `apps/worker/src/jobs/alert-eval.ts` | 定时执行告警评估 |

### M8: Web 管理后台 (基础)

| 任务 | 文件 | 说明 |
|------|------|------|
| 8.1 布局 & 导航 | `apps/web/src/app/layout.tsx` | 侧边栏导航 (设备/数据/分析/告警/看板) |
| 8.2 设备列表页 | `apps/web/src/app/devices/page.tsx` | 表格展示设备，搜索/筛选 |
| 8.3 设备详情页 | `apps/web/src/app/devices/[id]/page.tsx` | 设备信息 + 实时数据 + 历史曲线 |
| 8.4 数据查询页 | `apps/web/src/app/data/page.tsx` | 时间范围/设备/metric 选择，图表展示 |
| 8.5 基础图表 | `packages/ui/src/components/charts/` | ECharts 或 Chart.js 封装的 Line/Bar |

**Phase 2 验证**：
```
设备上报数据 → 事件分析 API 返回聚合正确 → 配置告警规则 → 超阈值触发 Webhook 通知
```

---

## Phase 3: 设备管理与画像 (P1)

**目标**：构建完整的设备生命周期管理 + CDP 画像标签体系。

### M9: 设备 CRUD API

| 任务 | 文件 | 说明 |
|------|------|------|
| 9.1 设备路由 | `apps/api/src/routes/device.ts` | 完整 CRUD + 搜索 + 分页 |
| 9.2 传感器路由 | `apps/api/src/routes/device.ts` | 设备下传感器管理 |
| 9.3 设备分组 API | `apps/api/src/routes/device.ts` | 设备组 CRUD |
| 9.4 设备 Repository | `packages/database/src/repositories/device.repo.ts` | 数据访问实现 |

### M10: 设备画像 (CDP Profile)

| 任务 | 文件 | 说明 |
|------|------|------|
| 10.1 设备属性聚合 | `packages/cdp/src/profile/device-profile.ts` | 聚合统计：在线时长/数据量/异常次数 |
| 10.2 健康度评分 | `packages/cdp/src/profile/device-scoring.ts` | 基于多维度评分模型 |

### M11: 标签与分群 (CDP Tags & Segment)

| 任务 | 文件 | 说明 |
|------|------|------|
| 11.1 标签管理 | `packages/cdp/src/tags/tag-manager.ts` | 标签 CRUD，支持规则标签和手动标签 |
| 11.2 标签计算 | `packages/cdp/src/tags/tag-calculator.ts` | 规则标签引擎 |
| 11.3 分群构建器 | `packages/cdp/src/segment/segment-builder.ts` | 条件组合构建分群 |
| 11.4 分群计算 | `packages/cdp/src/segment/segment-job.ts` | 后台计算任务 |
| 11.5 Worker 分群 Job | `apps/worker/src/jobs/segment-calc.ts` | 定时重新计算分群 |

### M12: 设备生命周期

| 任务 | 文件 | 说明 |
|------|------|------|
| 12.1 阶段定义 | `packages/cdp/src/lifecycle/life-cycle.ts` | 阶段模型 (注册/激活/运行/维护/退役) |
| 12.2 转换规则 | `packages/cdp/src/lifecycle/life-cycle.ts` | 条件触发的阶段转换 |

**Phase 3 验证**：
```
创建设备 → 上报数据 → 查看设备画像 → 自动打标签 → 查看设备分群结果
```

---

## Phase 4: 看板与高级分析 (P1-P2)

**目标**：实现漏斗/留存/分布分析模型 + 可视化看板。

### M13: 高级分析模型

| 任务 | 文件 | 说明 |
|------|------|------|
| 13.1 漏斗分析 | `packages/analytics/src/aggregation/funnel.ts` | 多步骤转化计算 |
| 13.2 留存分析 | `packages/analytics/src/aggregation/retention.ts` | 初始/后续行为留存率 |
| 13.3 分布分析 | `packages/analytics/src/aggregation/distribution.ts` | 频率/数值分段分布 |
| 13.4 归因分析 | `packages/analytics/src/aggregation/attribution.ts` | 5 种归因模型 |

### M14: 可视化看板

| 任务 | 文件 | 说明 |
|------|------|------|
| 14.1 看板 API | `apps/api/src/routes/dashboards.ts` | CRUD 看板 + Panel |
| 14.2 看板 Repository | `packages/database/src/repositories/dashboard.repo.ts` | 数据访问 |
| 14.3 看板页面 | `apps/web/src/app/dashboards/page.tsx` | 看板列表 + 创建 |
| 14.4 看板编辑 | `apps/web/src/app/dashboards/[id]/page.tsx` | 拖拽布局 + 添加图表 |
| 14.5 图表组件库 | `packages/ui/src/components/charts/` | Line/Bar/Pie/Gauge/Table/Stat |
| 14.6 数据导出 | `apps/api/src/routes/data.ts` | GET /api/v1/data/export → CSV/JSON |

### M15: Web 管理后台 (增强)

| 任务 | 文件 | 说明 |
|------|------|------|
| 15.1 分析查询页 | `apps/web/src/app/analytics/page.tsx` | 选择分析模型 + 参数 → 图表 |
| 15.2 告警管理页 | `apps/web/src/app/alerts/page.tsx` | 规则 CRUD + 告警记录列表 |
| 15.3 设置页面 | `apps/web/src/app/settings/page.tsx` | 用户/API Key 管理 |

**Phase 4 验证**：
```
配置漏斗步骤 → 返回转化率 → 创建看板 → 添加图表 → 看板展示正确
```

---

## Phase 5: 企业能力 (P1-P2)

**目标**：认证授权、多租户、审计日志，使平台达到生产可用。

### M16: 认证体系

| 任务 | 文件 | 说明 |
|------|------|------|
| 16.1 JWT 令牌 | `packages/auth/src/jwt/index.ts` | sign/verify/refresh |
| 16.2 本地认证 | `packages/auth/src/providers/local.ts` | 用户名+密码登录 |
| 16.3 API Key 认证 | `packages/auth/src/providers/api-key.ts` | M2M 认证 |
| 16.4 认证中间件 | `packages/api/src/middleware/auth.ts` | JWT + API Key 校验 |
| 16.5 登录路由 | `apps/api/src/routes/auth.ts` | POST /api/v1/auth/login |

### M17: RBAC 权限

| 任务 | 文件 | 说明 |
|------|------|------|
| 17.1 角色定义 | `packages/auth/src/rbac/role.ts` | 预置角色 (admin/operator/analyst/viewer) |
| 17.2 权限点 | `packages/auth/src/rbac/permission.ts` | 数据/功能/脱敏 权限配置 |
| 17.3 权限中间件 | `packages/api/src/middleware/rbac.ts` | 路由级权限校验 |
| 17.4 用户管理路由 | `apps/api/src/routes/auth.ts` | 用户/角色 CRUD |

### M18: 多租户 & 审计

| 任务 | 文件 | 说明 |
|------|------|------|
| 18.1 租户隔离 | 全层数据查询加 `WHERE tenant_id` | 所有 Repository 层增加租户过滤 |
| 18.2 审计中间件 | `packages/api/src/middleware/audit.ts` | 记录操作日志到 AuditLog 表 |
| 18.3 限流中间件 | `packages/api/src/middleware/rate-limit.ts` | Redis + 令牌桶 |
| 18.4 管理员路由 | `apps/api/src/routes/admin.ts` | 系统管理功能 |

**Phase 5 验证**：
```
登录获取 token → 携带 token 访问 API → 不同角色看到不同数据 → 审计日志正确记录
```

---

## 技术选型明细

| 领域 | 技术 | 版本 | 备注 |
|------|------|------|------|
| 运行时 | Node.js | >= 20 | |
| 语言 | TypeScript | ^5.7 | |
| 包管理 | pnpm | ^9.15 | |
| API 框架 | Hono | ^4.6 | 轻量高性能 |
| ORM | Drizzle ORM | ^0.38 | SQL 优先类型安全 |
| 时序 DB | TimescaleDB | 2-pg16 | PostgreSQL 扩展 |
| 消息队列 | Kafka | 7.7 | Confluent |
| 缓存 | Redis | 7 | |
| MQTT Broker | Mosquitto | 2 | |
| 前端框架 | Next.js | ^15 | App Router |
| 图表 | ECharts | ^5.6 | 或 Chart.js |
| 请求校验 | Zod | ^3.24 | |
| 任务队列 | BullMQ | ^5.20 | |

---

## 测试策略

| 层级 | 工具 | 覆盖 |
|------|------|------|
| 单元测试 | Vitest | 各 package 核心逻辑 |
| 集成测试 | Vitest + Docker | 数据管道：ingest → Kafka → TimescaleDB |
| API 测试 | Hono Test Client | 所有 API 端点 |
| E2E 测试 | Playwright | Web 关键流程 |
| 性能测试 | k6 | 数据写入 QPS、查询延迟 |

### 关键测试场景

1. 设备上报 → 数据正确落库 (Phase 1 完成标准)
2. 聚合计算 → 结果与手动 SQL 一致 (Phase 2 完成标准)
3. 告警规则 → 阈值触发 → 通知送达 (Phase 2 完成标准)
4. 多租户隔离 → 租户 A 看不到租户 B 数据 (Phase 5 完成标准)

---

## 里程碑时间估算

| Phase | 里程碑 | 估算人天 | 累计 |
|-------|--------|---------|------|
| P1 | M1 基础设施 | 2 | 2 |
| P1 | M2-M3 数据接入 | 5 | 7 |
| P1 | M4 时序存储 | 3 | 10 |
| P1 | M5 API & Worker | 3 | 13 |
| P2 | M6 事件分析 | 4 | 17 |
| P2 | M7 告警引擎 | 3 | 20 |
| P2 | M8 Web 基础 | 3 | 23 |
| P3 | M9-M12 CDP | 6 | 29 |
| P4 | M13 高级分析 | 5 | 34 |
| P4 | M14-M15 看板 | 5 | 39 |
| P5 | M16-M18 企业 | 5 | 44 |

**合计约 44 人天**（含测试约 55 人天）

---

## 关键风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| TimescaleDB 写入性能不达标 | P1 阻塞 | 提前用 k6 压测，准备 InfluxDB 备选 |
| 分析模型设计复杂度过高 | P2/P4 延期 | 先实现最简单的 count/avg，后续优化 |
| 前端图表交互开发量大 | P4 延期 | 优先用 ECharts 模板，不追求自定义样式 |
| MQTT 设备端兼容性问题 | P1 延期 | 先实现 HTTP 数据上报，MQTT 作为增量 |
