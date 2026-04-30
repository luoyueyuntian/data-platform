-- ============================================================
-- SSAS Platform - TimescaleDB Initialization
-- Run this AFTER `pnpm db:migrate` has created the base tables.
-- This script converts the data_points table to a hypertable
-- and sets up continuous aggregates, compression, and retention.
-- ============================================================

-- 1. Create timescale schema if not exists
CREATE SCHEMA IF NOT EXISTS timescale;

-- 2. Convert data_points to hypertable
-- Note: This assumes the table already exists (created by Prisma migration)
SELECT create_hypertable(
  'timescale.data_points',
  'time',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- 3. Add space partition by device_id (optional, improves multi-device queries)
-- SELECT add_dimension('timescale.data_points', 'device_id', number_partitions => 4);

-- 4. Enable compression
ALTER TABLE timescale.data_points SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'device_id, metric_name',
  timescaledb.compress_orderby = 'time DESC'
);

-- 5. Auto-compress chunks older than 7 days
SELECT add_compression_policy(
  'timescale.data_points',
  INTERVAL '7 days',
  if_not_exists => TRUE
);

-- 6. Create continuous aggregate: 1-minute buckets
CREATE MATERIALIZED VIEW IF NOT EXISTS timescale.metric_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  device_id,
  metric_name,
  AVG(value) AS avg,
  MAX(value) AS max,
  MIN(value) AS min,
  COUNT(*) AS count,
  LAST(value, time) AS last
FROM timescale.data_points
GROUP BY bucket, device_id, metric_name
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'timescale.metric_1min',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 minute',
  if_not_exists => TRUE
);

-- 7. Create continuous aggregate: 1-hour buckets
CREATE MATERIALIZED VIEW IF NOT EXISTS timescale.metric_1hour
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  device_id,
  metric_name,
  AVG(value) AS avg,
  MAX(value) AS max,
  MIN(value) AS min,
  COUNT(*) AS count,
  LAST(value, time) AS last
FROM timescale.data_points
GROUP BY bucket, device_id, metric_name
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'timescale.metric_1hour',
  start_offset => INTERVAL '14 days',
  end_offset => INTERVAL '6 hours',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- 8. Create continuous aggregate: 1-day buckets
CREATE MATERIALIZED VIEW IF NOT EXISTS timescale.metric_1day
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS bucket,
  device_id,
  metric_name,
  AVG(value) AS avg,
  MAX(value) AS max,
  MIN(value) AS min,
  COUNT(*) AS count,
  LAST(value, time) AS last
FROM timescale.data_points
GROUP BY bucket, device_id, metric_name
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'timescale.metric_1day',
  start_offset => INTERVAL '90 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- 9. Set retention policy (2 years = 730 days)
SELECT add_retention_policy(
  'timescale.data_points',
  INTERVAL '730 days',
  if_not_exists => TRUE
);

-- 10. Create helpful indexes for common queries
CREATE INDEX IF NOT EXISTS idx_data_points_device_metric_time
  ON timescale.data_points (device_id, metric_name, time DESC);

CREATE INDEX IF NOT EXISTS idx_data_points_device_time
  ON timescale.data_points (device_id, time DESC);

-- 11. Verify setup
SELECT * FROM timescaledb_information.hypertables WHERE table_name = 'data_points';
