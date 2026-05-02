#!/bin/bash
set -e

echo "=== SSAS Platform Setup ==="
echo ""

DB_CONTAINER="postgres"
DB_USER="ssas"
DB_NAME="ssas"

# 1. Start infrastructure services
echo "[1/7] Starting Docker services..."
docker compose -f docker/docker-compose.yml up -d
echo "  Waiting for PostgreSQL to be ready..."
until docker compose -f docker/docker-compose.yml exec -T "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  sleep 1
done
echo "  PostgreSQL is ready."

# 2. Install dependencies
echo "[2/7] Installing dependencies..."
pnpm install

# 3. Generate Prisma client
echo "[3/7] Generating Prisma client..."
pnpm db:generate

# 4. Run database migrations (creates all tables)
echo "[4/7] Running database migrations..."
pnpm db:migrate

# 5. Initialize TimescaleDB hypertable and continuous aggregates
echo "[5/7] Initializing TimescaleDB hypertable..."
docker compose -f docker/docker-compose.yml exec -T "$DB_CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" -f /dev/stdin < scripts/init-timescaledb.sql
echo "  TimescaleDB hypertable + continuous aggregates created."

# 6. Seed demo data (optional, skip with SKIP_SEED=1)
if [ "${SKIP_SEED}" != "1" ]; then
  echo "[6/7] Seeding demo data..."
  pnpm db:seed || echo "  Seed skipped or failed (non-fatal)."
else
  echo "[6/7] Seeding skipped (SKIP_SEED=1)."
fi

# 7. Build all packages
echo "[7/7] Building packages..."
pnpm build

echo ""
echo "=== Setup complete! ==="
echo "Run 'pnpm dev' to start development servers."
echo "Run 'pnpm db:studio' to open Prisma Studio."
echo ""
echo "Services:"
echo "  API:   http://localhost:4000/health"
echo "  Web:   http://localhost:3000"
echo "  MQTT:  localhost:1883"
