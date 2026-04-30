#!/bin/bash
set -e

echo "=== SSAS Platform Setup ==="
echo ""

# 1. Start infrastructure services
echo "[1/6] Starting Docker services..."
docker compose -f docker/docker-compose.yml up -d
echo "  Waiting for services to be ready..."
sleep 5

# 2. Install dependencies
echo "[2/6] Installing dependencies..."
pnpm install

# 3. Generate Prisma client
echo "[3/6] Generating Prisma client..."
pnpm db:generate

# 4. Run database migrations (creates all tables)
echo "[4/6] Running database migrations..."
pnpm db:migrate

# 5. Initialize TimescaleDB hypertable
echo "[5/6] Initializing TimescaleDB hypertable..."
# The data_points hypertable and continuous aggregates are created via
# the custom migration step. If using db:migrate, edit the generated
# migration SQL to include the TimescaleDB commands from:
#   scripts/init-timescaledb.sql
echo "  ⚠  If using Prisma migrations, manually add TimescaleDB SQL:"
echo "     See scripts/init-timescaledb.sql for hypertable setup."
echo "  💡 Alternative: apply directly to TimescaleDB:"
echo "     docker compose exec timescaledb psql -U ssas -d ssas_ts -f scripts/init-timescaledb.sql"

# 6. Build all packages
echo "[6/6] Building packages..."
pnpm build

echo ""
echo "=== Setup complete! ==="
echo "Run 'pnpm dev' to start development servers."
echo "Run 'pnpm db:studio' to open Prisma Studio."
echo ""
echo "Next steps:"
echo "  1. Apply TimescaleDB hypertable setup (see step 5)"
echo "  2. Start API server:  pnpm -F @ssas/app-api dev"
echo "  3. Start Worker:      pnpm -F @ssas/app-worker dev"
echo "  4. Start Web UI:      pnpm -F @ssas/app-web dev"
