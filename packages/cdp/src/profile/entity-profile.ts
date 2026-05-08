import { prisma } from '@ssas/database';

/**
 * Entity profile — aggregated metrics for an entity.
 * 对标神策用户画像: 实体属性聚合统计
 */
export interface EntityProfile {
  entityId: string;
  /** 活跃率 (过去 7 天) */
  activeRate: number;
  /** 数据完整率 */
  dataCompleteness: number;
  /** 异常率 (quality < 100 的事件占比) */
  anomalyRate: number;
  /** 平均上报间隔 (秒) */
  avgReportInterval: number;
  /** 总事件数 */
  totalEvents: number;
  /** 首次事件时间 */
  firstSeen: Date | null;
  /** 最后事件时间 */
  lastSeen: Date | null;
  /** 健康度评分 (0-100) */
  healthScore: number;
  /** 评分各维度明细 */
  scoreBreakdown: {
    activeScore: number;      // 40%
    completenessScore: number; // 30%
    anomalyScore: number;     // 30%
  };
}

/**
 * Build an entity profile by aggregating TimescaleDB data.
 */
export async function buildEntityProfile(entityId: string): Promise<EntityProfile | null> {
  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    select: { id: true, status: true, lastSeenAt: true, createdAt: true },
  });

  if (!entity) return null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const stats = await prisma.$queryRawUnsafe<{
    total: bigint;
    abnormal: bigint;
    first_time: Date;
    last_time: Date;
    avg_interval: number;
  }[]>(`
    WITH base AS (
      SELECT time, quality,
        EXTRACT(EPOCH FROM time - LAG(time) OVER (ORDER BY time)) AS gap
      FROM timescale.events
      WHERE entity_id = $1::uuid AND time >= $2
    )
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE quality < 100) AS abnormal,
      MIN(time) AS first_time,
      MAX(time) AS last_time,
      AVG(gap) AS avg_interval
    FROM base
  `, entityId, sevenDaysAgo);

  const row = stats[0];

  if (!row || Number(row.total) === 0) {
    return {
      entityId,
      activeRate: 0,
      dataCompleteness: 0,
      anomalyRate: 0,
      avgReportInterval: 0,
      totalEvents: 0,
      firstSeen: null,
      lastSeen: entity.lastSeenAt,
      healthScore: 0,
      scoreBreakdown: { activeScore: 0, completenessScore: 0, anomalyScore: 0 },
    };
  }

  const totalEvents = Number(row.total);
  const abnormalCount = Number(row.abnormal);
  const anomalyRate = totalEvents > 0 ? abnormalCount / totalEvents : 0;

  const isActive = entity.status === 'active';
  const lastSeen = entity.lastSeenAt;
  let activeRate = 0;

  if (isActive && lastSeen) {
    const minutesSinceLastSeen = (Date.now() - lastSeen.getTime()) / 60000;
    activeRate = minutesSinceLastSeen < 30 ? 1.0 : Math.max(0, 1 - minutesSinceLastSeen / 1440);
  }

  const expectedEvents = 7 * 24 * 60;
  const dataCompleteness = Math.min(1, totalEvents / expectedEvents);

  const activeScore = activeRate * 40;
  const completenessScore = dataCompleteness * 30;
  const anomalyScore = (1 - anomalyRate) * 30;
  const healthScore = Math.round(activeScore + completenessScore + anomalyScore);

  return {
    entityId,
    activeRate: Math.round(activeRate * 100) / 100,
    dataCompleteness: Math.round(dataCompleteness * 100) / 100,
    anomalyRate: Math.round(anomalyRate * 100) / 100,
    avgReportInterval: Math.round(row.avg_interval || 0),
    totalEvents,
    firstSeen: row.first_time,
    lastSeen: row.last_time,
    healthScore: Math.min(100, Math.max(0, healthScore)),
    scoreBreakdown: {
      activeScore: Math.round(activeScore * 10) / 10,
      completenessScore: Math.round(completenessScore * 10) / 10,
      anomalyScore: Math.round(anomalyScore * 10) / 10,
    },
  };
}

/**
 * Batch build profiles for all entities in a tenant.
 */
export async function buildTenantEntityProfiles(tenantId: string): Promise<EntityProfile[]> {
  const entities = await prisma.entity.findMany({
    where: { tenantId },
    select: { id: true },
  });

  const profiles: EntityProfile[] = [];

  for (const entity of entities) {
    const profile = await buildEntityProfile(entity.id);
    if (profile) profiles.push(profile);
  }

  return profiles;
}

// Backward compatibility aliases
export const buildDeviceProfile = buildEntityProfile;
export const buildTenantDeviceProfiles = buildTenantEntityProfiles;
export type DeviceProfile = EntityProfile;
