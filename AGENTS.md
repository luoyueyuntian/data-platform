# AGENTS.md

This file provides context for Codex working on the SSAS (Sensors as a Service) Platform.

## Project

SSAS is a Monorepo (pnpm workspace + Turbo) for IoT sensor data platform, inspired by Sensors Data (神策数据).

### Architecture

```
apps/               # Deployable applications
├── api/            # Hono REST API server (port 4000)
├── web/            # Next.js 15 management console
├── worker/         # KafkaJS background worker
└── docs/           # VitePress documentation

packages/           # Shared packages
├── core/           # Types, constants, utils (zero dependencies)
├── database/       # Prisma ORM, migrations, repositories
├── auth/           # JWT, RBAC, API Key authentication
├── api/            # Route definitions, Zod validators
├── ingest/         # Data ingestion (HTTP, MQTT, TCP)
├── storage/        # TimescaleDB read/write, query builder, cache
├── analytics/      # Event/funnel/retention/distribution/attribution analysis
├── alerting/       # Alert rules, webhook channels, scheduler
├── cdp/            # Device profile, tags, segments, lifecycle
├── mqtt/           # MQTT client SDK
└── ui/             # ECharts components (Line, Gauge, Stat)
```

### Infrastructure

- PostgreSQL 16 (business data)
- TimescaleDB (time-series data)
- Mosquitto 2 (MQTT broker)
- Redis 7 (cache)
- Kafka 7.9 (message queue)

## Commands

```bash
pnpm install        # Install dependencies
pnpm dev            # Start dev server (all packages)
pnpm build          # Build all packages
pnpm typecheck      # TypeScript type check
pnpm test           # Run Vitest tests
pnpm lint           # ESLint check
pnpm format         # Prettier format

# Database
pnpm db:generate    # Generate Prisma Client
pnpm db:migrate     # Run migrations
pnpm db:seed        # Seed demo data
pnpm db:studio      # Prisma Studio

# Filter by package
pnpm build -F @ssas/core
pnpm test -F @ssas/auth
```

## Code Conventions

- **Language**: TypeScript strict mode
- **Module**: ESM (type: "module")
- **Quotes**: Single quotes
- **Semicolons**: Required
- **Naming**: kebab-case files, camelCase functions, PascalCase types
- **Components**: React function declarations
- **Validation**: Zod schemas for all inputs
- **Database**: Prisma for ORM, raw SQL for TimescaleDB
- **Testing**: Vitest with describe/it/expect

## Key Patterns

### Repository Pattern
```typescript
// packages/database/src/repositories/*.repo.ts
export const DeviceRepository = {
  async findAll(params: DeviceListParams): Promise<DeviceListResult> { ... },
  async findById(id: string, tenantId: string) { ... },
  async create(data: CreateDeviceInput) { ... },
  async update(id: string, tenantId: string, data: UpdateDeviceInput) { ... },
  async delete(id: string, tenantId: string) { ... },
};
```

### API Route Pattern
```typescript
// apps/api/src/routes/*.ts
const routes = new Hono();
routes.get('/', zValidator('query', schema), async (c) => {
  const params = c.req.valid('query');
  const tenantId = getTenantId(c);
  // ...
  return c.json({ code: 0, message: 'ok', data: result });
});
```

### Analytics Engine Pattern
```typescript
// packages/analytics/src/aggregation/*.ts
export async function analysis(query: QueryType): Promise<ResultType> {
  const tenantId = (query as any).tenantId;
  // Build SQL with tenant isolation
  const sql = `SELECT ... FROM timescale.data_points dp
    ${tenantId ? 'INNER JOIN public.devices d ON d.id = dp.device_id' : ''}
    WHERE ...`;
  // ...
}
```

### Multi-tenancy
All queries must include `tenantId` filter:
- Business data: `WHERE tenant_id = $1`
- Time-series data: `JOIN devices d ON d.id = dp.device_id WHERE d.tenant_id = $1`

## Import Patterns

```typescript
import { prisma } from '@ssas/database';
import { type DataPoint, type Device } from '@ssas/core';
import { writeDataPoints, queryDataPoints } from '@ssas/storage';
import { AnalyticsEngine } from '@ssas/analytics';
import { getTenantId, requireAuth } from '../middleware/auth';
```

## Environment Variables

Required in `.env`:
```
DATABASE_URL="postgresql://ssas:ssas@localhost:5432/ssas"
TIMESCALE_URL="postgresql://ssas:ssas@localhost:5433/ssas_ts"
REDIS_URL="redis://localhost:6379/0"
KAFKA_BROKER="localhost:9092"
MQTT_BROKER_URL="mqtt://localhost:1883"
JWT_SECRET="<32+ character secret>"
```

## Current Status

- ✅ Phase 1-5 complete (100%)
- ✅ 133 unit tests passing
- ✅ TypeScript strict mode
- ✅ ESLint + Prettier configured
- ✅ Multi-tenant isolation
- ✅ JWT + API Key authentication
