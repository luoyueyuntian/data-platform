# M1: 基础设施搭建 — 验收指引

> 在执行本验收前，确保已安装 Docker、pnpm、Node.js >= 20。

---

## 验收步骤

### Step 1: 启动基础设施

```bash
cd sensor-data
docker compose -f docker/docker-compose.yml up -d
```

验证所有服务健康运行：

```bash
docker compose ps
```

预期看到 6 个服务均为 `Up` 状态：

| 服务 | 端口 | 用途 |
|------|------|------|
| postgres | 5432 | 业务数据库 |
| timescaledb | 5433 | 时序数据库 |
| mosquitto | 1883/9001 | MQTT Broker |
| redis | 6379 | 缓存 |
| zookeeper | 2181 | Kafka 依赖 |
| kafka | 9092 | 消息队列 |

### Step 2: 安装依赖 & 生成 Prisma Client

```bash
pnpm install
pnpm db:generate
```

**预期**：
- `pnpm install` 安装所有依赖成功
- `pnpm db:generate` 在 `node_modules/.prisma/client` 生成类型

### Step 3: 数据库迁移

**第一步** — 创建业务表：

```bash
pnpm db:migrate
```

如果提示创建名称，输入 `init`。这会在 PostgreSQL 中创建除 DataPoint 外的所有表。

**第二步** — 初始化 TimescaleDB 超表：

```bash
# 方式 A: 在 db:migrate 生成的 SQL 末尾追加 scripts/init-timescaledb.sql 的内容
# 然后运行 pnpm db:migrate:prod

# 方式 B (推荐): 直接对 timescaledb 执行初始化脚本
docker compose exec timescaledb psql -U ssas -d ssas_ts
# 然后在 psql 中执行:
\i scripts/init-timescaledb.sql
```

验证 TimescaleDB 超表创建成功：

```sql
SELECT * FROM timescaledb_information.hypertables;
-- 应看到 data_points 超表

SELECT * FROM timescaledb_information.continuous_aggregates;
-- 应看到 metric_1min, metric_1hour, metric_1day
```

### Step 4: 种子数据

```bash
pnpm db:seed
```

**预期**：
- 创建 Demo Organization 租户
- 创建 admin@ssas.local 用户
- 创建 3 个设备 + 2 个传感器
- 输出验证信息

### Step 5: 数据写入验证 (手动)

通过 psql 连接到 TimescaleDB 写入一条测试数据：

```bash
docker compose exec timescaledb psql -U ssas -d ssas_ts
```

```sql
INSERT INTO timescale.data_points (time, device_id, metric_name, value, quality)
VALUES (NOW(), '00000000-0000-0000-0000-000000000100', 'temperature', 23.5, 100);

SELECT * FROM timescale.data_points ORDER BY time DESC LIMIT 5;

-- 验证连续聚合
SELECT * FROM timescale.metric_1min ORDER BY bucket DESC LIMIT 5;
```

### Step 6: 构建验证

```bash
pnpm build -F @ssas/core
pnpm build -F @ssas/database
```

**预期**：TypeScript 编译无错误，dist/ 目录生成。

---

## 验收检查清单

| # | 检查项 | 预期 | 状态 |
|---|--------|------|------|
| 1 | docker compose ps | 6 个服务 Up | ⬜ |
| 2 | pnpm install | 安装成功 | ⬜ |
| 3 | pnpm db:generate | 生成 Prisma Client | ⬜ |
| 4 | PostgreSQL 表 | 所有非时序表创建成功 | ⬜ |
| 5 | TimescaleDB 超表 | data_points 超表创建成功 | ⬜ |
| 6 | Continuous Aggregates | metric_1min / 1hour / 1day 创建成功 | ⬜ |
| 7 | pnpm db:seed | 种子数据插入成功 | ⬜ |
| 8 | 数据写入 & 查询 | INSERT + SELECT 正常 | ⬜ |
| 9 | pnpm build | core + database 编译成功 | ⬜ |

---

## 常见问题

**Q: TimescaleDB 超表创建报错 "relation already exists"**
A: Prisma migrate 已经创建了 `data_points` 表。使用 `create_hypertable` 时加 `if_not_exists => TRUE` 参数，或先删除再重建。

**Q: `pnpm db:migrate` 提示没有 DATABASE_URL**
A: 确认 `.env` 文件已从 `.env.example` 复制，且内容正确。

**Q: Prisma 不支持 TimescaleDB 的某些特性**
A: 这是已知的。Prisma 负责业务表的 CRUD，TimescaleDB 特性（超表、连续聚合）通过 `scripts/init-timescaledb.sql` 管理。DataPoint 的写入/查询建议使用 raw SQL。
