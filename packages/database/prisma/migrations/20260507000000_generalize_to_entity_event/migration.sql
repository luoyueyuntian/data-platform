-- ============================================================
-- Migration: Generalize IoT-specific models to generic Entity/Event
-- ============================================================

-- 1. Rename device_groups → entity_groups
ALTER TABLE "device_groups" RENAME TO "entity_groups";
ALTER TABLE "entity_groups" RENAME CONSTRAINT "device_groups_pkey" TO "entity_groups_pkey";
ALTER TABLE "entity_groups" RENAME CONSTRAINT "device_groups_tenant_id_fkey" TO "entity_groups_tenant_id_fkey";
ALTER TABLE "entity_groups" RENAME CONSTRAINT "device_groups_parent_id_fkey" TO "entity_groups_parent_id_fkey";
ALTER INDEX "device_groups_tenant_id_name_key" RENAME TO "entity_groups_tenant_id_name_key";

-- 2. Rename devices → entities
ALTER TABLE "devices" RENAME TO "entities";
ALTER TABLE "entities" RENAME CONSTRAINT "devices_pkey" TO "entities_pkey";
ALTER TABLE "entities" RENAME CONSTRAINT "devices_tenant_id_fkey" TO "entities_tenant_id_fkey";
ALTER TABLE "entities" RENAME CONSTRAINT "devices_group_id_fkey" TO "entities_group_id_fkey";
-- Rename columns
ALTER TABLE "entities" RENAME COLUMN "deviceKey" TO "entity_key";
ALTER TABLE "entities" ALTER COLUMN "status" SET DEFAULT 'inactive';
ALTER INDEX "devices_deviceKey_key" RENAME TO "entities_entity_key_key";
ALTER INDEX "devices_tenant_id_idx" RENAME TO "entities_tenant_id_idx";
ALTER INDEX "devices_status_idx" RENAME TO "entities_status_idx";
ALTER INDEX "devices_group_id_idx" RENAME TO "entities_group_id_idx";
ALTER INDEX "devices_deviceKey_idx" RENAME TO "entities_entity_key_idx";

-- 3. Drop sensors table (merged into entity metadata)
ALTER TABLE "sensors" DROP CONSTRAINT "sensors_device_id_fkey";
DROP TABLE "sensors";

-- 4. Rename device_tags → entity_tags
ALTER TABLE "device_tags" RENAME TO "entity_tags";
ALTER TABLE "entity_tags" RENAME CONSTRAINT "device_tags_pkey" TO "entity_tags_pkey";
ALTER TABLE "entity_tags" RENAME CONSTRAINT "device_tags_device_id_fkey" TO "entity_tags_entity_id_fkey";
ALTER TABLE "entity_tags" RENAME COLUMN "device_id" TO "entity_id";
ALTER INDEX "device_tags_device_id_idx" RENAME TO "entity_tags_entity_id_idx";
ALTER INDEX "device_tags_key_value_idx" RENAME TO "entity_tags_key_value_idx";

-- 5. Update alert_records: device_id → entity_id
ALTER TABLE "alert_records" RENAME COLUMN "device_id" TO "entity_id";
ALTER INDEX "alert_records_device_id_idx" RENAME TO "alert_records_entity_id_idx";

-- 6. Rename data_points → events (TimescaleDB hypertable)
-- Note: TimescaleDB hypertables need special handling
-- First drop the hypertable, then recreate
DROP TABLE IF EXISTS "timescale"."data_points" CASCADE;

CREATE TABLE "timescale"."events" (
    "time" TIMESTAMP(3) NOT NULL,
    "entity_id" UUID NOT NULL,
    "event_name" VARCHAR(100) NOT NULL,
    "value" DOUBLE PRECISION,
    "properties" JSONB,
    "tags" JSONB,
    "quality" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "events_pkey" PRIMARY KEY ("time","entity_id","event_name")
);

-- Create indexes for the new events table
CREATE INDEX "events_entity_id_event_name_time_idx" ON "timescale"."events"("entity_id", "event_name", "time");
CREATE INDEX "events_entity_id_time_idx" ON "timescale"."events"("entity_id", "time");

-- Convert to TimescaleDB hypertable (if TimescaleDB extension is available)
-- SELECT create_hypertable('timescale.events', 'time');
