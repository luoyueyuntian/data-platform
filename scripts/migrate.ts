/**
 * Database migration helper.
 *
 * This project uses Prisma Migrate for schema management:
 *   pnpm db:migrate    — apply migrations in dev
 *   pnpm db:migrate:prod — apply migrations in production
 *
 * For TimescaleDB-specific setup (hypertable, continuous aggregates),
 * run the SQL script manually:
 *   scripts/init-timescaledb.sql
 */
async function main() {
  console.log('Prisma migrations are managed via: pnpm db:migrate');
  console.log('');
  console.log('TimescaleDB setup:');
  console.log('  1. After Prisma migration creates the data_points table:');
  console.log('  2. Run: docker compose exec timescaledb psql -U ssas -d ssas_ts');
  console.log('  3. Then: \\i scripts/init-timescaledb.sql');
  console.log('');
  console.log('Or use Prisma migration SQL editing approach:');
  console.log('  Edit the generated migration .sql file to append');
  console.log('  TimescaleDB hypertable commands before applying.');
}

main().catch(console.error);
