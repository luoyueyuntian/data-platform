# SSAS Platform

**Sensors as a Service** - 物联网传感器数据平台

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.5-2D3748.svg)](https://www.prisma.io/)
[![TimescaleDB](https://img.shields.io/badge/TimescaleDB-2-FDB515.svg)](https://www.timescale.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 简介

SSAS 是一个对标神策数据平台的物联网传感器数据分析平台，将用户行为分析模式映射到物联网传感器数据领域。

### 核心映射

| 神策 (用户行为分析) | SSAS (传感器数据平台) |
|---------------------|----------------------|
| User (用户) | Device (设备) |
| Event (行为事件) | DataPoint (传感数据点) |
| Item (物品) | Sensor (传感器/部件) |
| distinct_id (用户ID) | device_id (设备标识) |
| event (事件名) | metric (指标名) |

---

## 功能特性

### 数据采集
- **HTTP API** - RESTful 数据上报接口
- **MQTT** - 支持百万级设备并发连接
- **批量上报** - 单次最大 1000 条数据

### 数据分析
- **事件分析** - count/sum/avg/min/max/last 聚合
- **漏斗分析** - 多步骤转化率计算
- **留存分析** - 设备活跃度留存
- **分布分析** - 传感器值分布统计
- **归因分析** - 5 种归因模型（首次/末次/线性/位置/时间衰减）

### 设备管理
- **设备 CRUD** - 完整的设备生命周期管理
- **设备画像** - 健康度评分（在线率 40% + 数据完整率 30% + 异常率 30%）
- **标签系统** - 手动标签 + 规则标签
- **设备分群** - 基于属性/指标/标签的动态分群
- **生命周期** - 5 阶段模型（注册→激活→运行→维护→退役）

### 告警系统
- **规则引擎** - 阈值/同比/波动/异常检测
- **通知渠道** - Webhook（支持 Slack、Discord、自定义）
- **静默期** - 防止重复告警

### 可视化
- **看板** - 拖拽式布局
- **图表** - 折线图、面积图、仪表盘、统计卡片
- **时间选择** - 1h/6h/24h/7d/30d

### 企业功能
- **多租户** - 行级数据隔离
- **认证授权** - JWT + API Key + RBAC
- **审计日志** - 所有写操作记录
- **限流** - 按租户/IP 限流

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        应用层 (apps/)                            │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐ │
│  │ API 网关  │  │ Web 管理后台  │  │ Worker   │  │ Docs 文档  │ │
│  │  Hono    │  │   Next.js    │  │ KafkaJS  │  │ VitePress  │ │
│  └─────┬────┘  └──────┬───────┘  └────┬─────┘  └────────────┘ │
└────────┼──────────────┼───────────────┼─────────────────────────┘
         │              │               │
┌────────┴──────────────┴───────────────┴─────────────────────────┐
│                        服务层 (packages/)                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │auth  │ │api   │ │ingest│ │stor. │ │anal. │ │alert │       │
│  │JWT   │ │Zod   │ │HTTP  │ │TSDB  │ │分析  │ │告警  │       │
│  │RBAC  │ │路由  │ │MQTT  │ │查询  │ │引擎  │ │规则  │       │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘       │
│                       ┌──────┐ ┌──────┐ ┌──────┐              │
│                       │cdp   │ │ mqtt │ │ ui   │              │
│                       │画像  │ │SDK   │ │ECharts│              │
│                       └──────┘ └──────┘ └──────┘              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ database           ┌──────┐                              │ │
│  │ Prisma/Repository  │ core │ ← 零依赖基础库                │ │
│  │                    │ 类型 │                              │ │
│  └────────────────────┴──────┘                              │ │
└───────────────────────────────────────────────────────────────┘
         │              │               │
┌────────┴──────────────┴───────────────┴─────────────────────────┐
│                        基础设施层 (docker/)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ ┌─────────┐ │
│  │PostgreSQL│ │Timescale │ │ Mosquitto│ │Redis │ │ Kafka   │ │
│  │   16     │ │    2     │ │    2     │ │  7   │ │  7.9    │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose

### 安装步骤

```bash
# 1. 克隆项目
git clone <repository-url>
cd sensor-data

# 2. 安装依赖
pnpm install

# 3. 启动基础设施
docker compose -f docker/docker-compose.yml up -d

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等

# 5. 生成 Prisma Client
pnpm db:generate

# 6. 运行数据库迁移
pnpm db:migrate

# 7. 初始化 TimescaleDB
docker compose exec timescaledb psql -U ssas -d ssas_ts -f /docker-entrypoint-initdb.d/init-timescaledb.sql

# 8. 种子数据
pnpm db:seed

# 9. 启动开发服务器
pnpm dev
```

### 访问服务

| 服务 | 地址 | 说明 |
|------|------|------|
| API | http://localhost:4000 | REST API |
| Web | http://localhost:3000 | 管理后台 |
| Docs | http://localhost:5173 | 文档站点 |
| Prisma Studio | http://localhost:5555 | 数据库管理 |

### 默认账号

```
邮箱: admin@ssas.local
密码: admin123
```

---

## 项目结构

```
sensor-data/
├── apps/                           # 应用层
│   ├── api/                        # REST API 服务
│   │   └── src/
│   │       ├── index.ts            # 入口文件
│   │       ├── middleware/         # 中间件
│   │       │   ├── auth.ts         # 认证中间件
│   │       │   ├── audit.ts        # 审计日志
│   │       │   └── rate-limit.ts   # 限流
│   │       └── routes/             # API 路由
│   │           ├── auth.ts         # 认证路由
│   │           ├── data.ts         # 数据路由
│   │           ├── device.ts       # 设备路由
│   │           ├── analytics.ts    # 分析路由
│   │           ├── alerts.ts       # 告警路由
│   │           ├── dashboards.ts   # 看板路由
│   │           ├── cdp.ts          # 画像路由
│   │           └── settings.ts     # 设置路由
│   │
│   ├── web/                        # Web 管理后台
│   │   └── src/
│   │       ├── app/                # Next.js App Router
│   │       │   ├── (dashboard)/    # 仪表板布局
│   │       │   │   ├── devices/    # 设备管理
│   │       │   │   ├── data/       # 数据查询
│   │       │   │   ├── analytics/  # 数据分析
│   │       │   │   ├── alerts/     # 告警管理
│   │       │   │   ├── dashboards/ # 可视化看板
│   │       │   │   └── settings/   # 系统设置
│   │       │   └── login/          # 登录页面
│   │       ├── components/         # 组件
│   │       └── lib/                # 工具库
│   │
│   ├── worker/                     # 后台任务
│   │   └── src/
│   │       ├── index.ts            # Kafka 消费者
│   │       └── jobs/               # 任务定义
│   │           ├── alert-eval.ts   # 告警评估
│   │           ├── lifecycle-eval.ts # 生命周期评估
│   │           └── segment-calc.ts # 分群计算
│   │
│   └── docs/                       # 文档站点
│
├── packages/                       # 服务层
│   ├── core/                       # 核心库
│   │   └── src/
│   │       ├── types/              # 类型定义
│   │       ├── constants/          # 常量
│   │       └── utils/              # 工具函数
│   │
│   ├── database/                   # 数据库层
│   │   ├── prisma/
│   │   │   └── schema.prisma       # 数据库 Schema
│   │   └── src/
│   │       ├── client.ts           # Prisma Client
│   │       └── repositories/       # 数据访问层
│   │
│   ├── auth/                       # 认证授权
│   │   └── src/
│   │       ├── jwt/                # JWT 管理
│   │       ├── rbac/               # 角色权限
│   │       └── providers/          # 认证提供者
│   │
│   ├── ingest/                     # 数据采集
│   │   └── src/
│   │       ├── http/               # HTTP 接入
│   │       ├── mqtt/               # MQTT 接入
│   │       ├── tcp/                # TCP 接入
│   │       ├── buffer/             # Kafka 生产者
│   │       └── transform/          # 数据转换
│   │
│   ├── storage/                    # 存储层
│   │   └── src/
│   │       ├── timescale/          # TimescaleDB 读写
│   │       ├── query/              # 查询构建器
│   │       └── influx/             # InfluxDB 适配器
│   │
│   ├── analytics/                  # 分析引擎
│   │   └── src/
│   │       ├── aggregation/        # 聚合分析
│   │       │   ├── event-analysis.ts
│   │       │   ├── funnel.ts
│   │       │   ├── retention.ts
│   │       │   ├── distribution.ts
│   │       │   └── attribution.ts
│   │       ├── timeseries/         # 时序分析
│   │       ├── window/             # 窗口函数
│   │       └── query/              # 查询引擎
│   │
│   ├── alerting/                   # 告警系统
│   │   └── src/
│   │       ├── rules/              # 规则引擎
│   │       ├── channels/           # 通知渠道
│   │       └── scheduler/          # 调度器
│   │
│   ├── cdp/                        # 设备画像
│   │   └── src/
│   │       ├── profile/            # 设备画像
│   │       ├── tags/               # 标签管理
│   │       ├── segment/            # 设备分群
│   │       └── lifecycle/          # 生命周期
│   │
│   ├── api/                        # API 定义
│   │   └── src/
│   │       ├── validators/         # Zod 校验
│   │       └── middleware/         # 中间件定义
│   │
│   ├── mqtt/                       # MQTT SDK
│   │   └── src/
│   │
│   └── ui/                         # UI 组件库
│       └── src/
│           └── components/
│               └── charts/         # ECharts 组件
│
├── docker/                         # 基础设施
│   ├── docker-compose.yml          # 开发环境
│   ├── docker-compose.prod.yml     # 生产环境
│   └── services/
│       └── mosquitto/              # MQTT 配置
│
├── scripts/                        # 脚本
│   ├── setup.sh                    # 初始化脚本
│   ├── seed.ts                     # 种子数据
│   ├── migrate.ts                  # 迁移脚本
│   └── init-timescaledb.sql        # TimescaleDB 初始化
│
├── .env.example                    # 环境变量示例
├── package.json                    # 项目配置
├── pnpm-workspace.yaml             # 工作空间配置
├── turbo.json                      # Turbo 配置
├── tsconfig.base.json              # TypeScript 基础配置
├── vitest.config.ts                # Vitest 配置
├── eslint.config.js                # ESLint 配置
├── .prettierrc                     # Prettier 配置
├── CLAUDE.md                       # Claude Code 指令
└── AGENTS.md                       # AI Agent 架构文档
```

---

## 开发指南

### 常用命令

```bash
# 开发
pnpm dev                    # 启动所有服务
pnpm dev -F @ssas/app-api   # 只启动 API
pnpm dev -F @ssas/app-web   # 只启动 Web

# 构建
pnpm build                  # 构建所有包
pnpm build -F @ssas/core    # 构建指定包

# 测试
pnpm test                   # 运行所有测试
pnpm test:watch             # 监视模式
pnpm test:coverage          # 覆盖率报告

# 代码质量
pnpm lint                   # ESLint 检查
pnpm lint:fix               # 自动修复
pnpm format                 # Prettier 格式化
pnpm typecheck              # TypeScript 类型检查

# 数据库
pnpm db:generate            # 生成 Prisma Client
pnpm db:migrate             # 运行迁移
pnpm db:seed                # 种子数据
pnpm db:studio              # Prisma Studio
```

### 添加新功能

#### 添加 API 端点

```typescript
// 1. 创建路由文件 apps/api/src/routes/example.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getTenantId, authMiddleware } from '../middleware/auth';

const routes = new Hono();

const querySchema = z.object({
  name: z.string().min(1),
});

routes.get('/', authMiddleware, zValidator('query', querySchema), async (c) => {
  const tenantId = getTenantId(c);
  const params = c.req.valid('query');
  // ... 业务逻辑
  return c.json({ code: 0, message: 'ok', data: result });
});

export { routes as exampleRoutes };

// 2. 注册路由 apps/api/src/index.ts
import { exampleRoutes } from './routes/example';
app.route('/api/v1/example', exampleRoutes);
```

#### 添加分析模型

```typescript
// 1. 创建分析函数 packages/analytics/src/aggregation/my-analysis.ts
import { prisma } from '@ssas/database';

export async function myAnalysis(query: MyQuery) {
  const tenantId = (query as any).tenantId;
  const sql = `
    SELECT * FROM timescale.data_points dp
    ${tenantId ? 'INNER JOIN public.devices d ON d.id = dp.device_id' : ''}
    WHERE dp.metric_name = $1
  `;
  // ...
}

// 2. 注册到引擎 packages/analytics/src/query/engine.ts
import { myAnalysis } from '../aggregation/my-analysis';

export const AnalyticsEngine = {
  // ... 现有方法
  async my(query: TenantScoped<MyQuery>) {
    try {
      const result = await myAnalysis(query);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
};
```

#### 添加数据库模型

```prisma
// 1. 更新 Schema packages/database/prisma/schema.prisma
model MyModel {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  name      String   @db.VarChar(255)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@schema("public")
  @@map("my_models")
}

// 2. 生成 Client
pnpm db:generate

// 3. 创建迁移
pnpm db:migrate

// 4. 创建 Repository packages/database/src/repositories/my-model.repo.ts
import { prisma } from '../client';

export const MyModelRepository = {
  async findAll(tenantId: string) {
    return prisma.myModel.findMany({ where: { tenantId } });
  },
  // ...
};
```

### 测试

```typescript
// 测试文件与源文件同目录
// packages/core/src/utils/my-util.test.ts
import { describe, it, expect } from 'vitest';
import { myUtil } from './my-util';

describe('myUtil', () => {
  it('should do something', () => {
    expect(myUtil('input')).toBe('output');
  });
});
```

---

## API 文档

### 认证

所有 API 请求需要在 Header 中携带认证信息：

```bash
# JWT Token
Authorization: Bearer <token>

# 或 API Key
X-API-Key: <api-key>
```

### 响应格式

```json
{
  "code": 0,
  "message": "ok",
  "data": { ... }
}
```

### 错误码

| 码 | 说明 |
|----|------|
| 0 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

### 分页

```json
// 请求
GET /api/v1/devices?page=1&pageSize=20

// 响应
{
  "code": 0,
  "message": "ok",
  "data": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "totalPages": 5
}
```

---

## 部署

### Docker Compose (开发)

```bash
docker compose -f docker/docker-compose.yml up -d
```

### Docker Compose (生产)

```bash
# 1. 配置环境变量
cp .env.example .env.production
# 编辑 .env.production

# 2. 构建镜像
docker compose -f docker/docker-compose.prod.yml build

# 3. 启动服务
docker compose -f docker/docker-compose.prod.yml up -d
```

### Kubernetes

```bash
# 参考 k8s/ 目录下的配置文件
kubectl apply -f k8s/
```

---

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | ✅ | - | PostgreSQL 连接字符串 |
| `TIMESCALE_URL` | ✅ | - | TimescaleDB 连接字符串 |
| `REDIS_URL` | ✅ | - | Redis 连接字符串 |
| `KAFKA_BROKER` | ✅ | - | Kafka Broker 地址 |
| `MQTT_BROKER_URL` | ✅ | - | MQTT Broker 地址 |
| `JWT_SECRET` | ✅ | - | JWT 密钥 (32+ 字符) |
| `API_PORT` | ❌ | 4000 | API 端口 |
| `API_HOST` | ❌ | 0.0.0.0 | API 监听地址 |
| `NODE_ENV` | ❌ | development | 运行环境 |
| `CORS_ORIGIN` | ❌ | * | CORS 允许的源 |
| `WORKER_CONCURRENCY` | ❌ | 5 | Worker 并发数 |
