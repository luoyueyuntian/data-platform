import { prisma } from '@ssas/database';

/**
 * Device profile — aggregated metrics for a device.
 * 对标神策用户画像: 设备属性聚合统计
 */
export interface DeviceProfile {
  deviceId: string;
  /** 在线率 (过去 7 天) */
  onlineRate: number;
  /** 数据完整率 (实际数据点 / 期望数据点) */
  dataCompleteness: number;
  /** 异常率 (quality < 100 的数据点占比) */
  anomalyRate: number;
  /** 平均上报间隔 (秒) */
  avgReportInterval: number;
  /** 总数据点数 */
  totalDataPoints: number;
  /** 首次数据时间 */
  firstSeen: Date | null;
  /** 最后数据时间 */
  lastSeen: Date | null;
  /** 健康度评分 (0-100) */
  healthScore: number;
  /** 评分各维度明细 */
  scoreBreakdown: {
    onlineScore: number;      // 40%
    completenessScore: number; // 30%
    anomalyScore: number;     // 30%
  };
}

/**
 * Build a device profile by aggregating TimescaleDB data.
 *
 * 健康度评分模型 (已确认):
 *   在线率 40% + 数据完整率 30% + 异常率 30%
 */
export async function buildDeviceProfile(deviceId: string): Promise<DeviceProfile | null> {
  // 1. Get device info
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { id: true, status: true, lastSeenAt: true, createdAt: true },
  });

  if (!device) return null;

  // 2. Query data stats from TimescaleDB (past 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const stats = await prisma.$queryRawUnsafe<{
    total: bigint;
    abnormal: bigint;
    first_time: Date;
    last_time: Date;
    avg_interval: number;
  }[]>(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE quality < 100) AS abnormal,
      MIN(time) AS first_time,
      MAX(time) AS last_time,
      EXTRACT(EPOCH FROM AVG(time - LAG(time) OVER (ORDER BY time))) AS avg_interval
    FROM timescale.data_points
    WHERE device_id = $1 AND time >= $2
  `, deviceId, sevenDaysAgo);

  const row = stats[0];

  if (!row || Number(row.total) === 0) {
    // Device exists but no data yet
    return {
      deviceId,
      onlineRate: 0,
      dataCompleteness: 0,
      anomalyRate: 0,
      avgReportInterval: 0,
      totalDataPoints: 0,
      firstSeen: null,
      lastSeen: device.lastSeenAt,
      healthScore: 0,
      scoreBreakdown: { onlineScore: 0, completenessScore: 0, anomalyScore: 0 },
    };
  }

  const totalDataPoints = Number(row.total);
  const abnormalCount = Number(row.abnormal);
  const anomalyRate = totalDataPoints > 0 ? abnormalCount / totalDataPoints : 0;

  // 3. Calculate online rate based on device status and lastSeen
  const isOnline = device.status === 'online';
  const lastSeen = device.lastSeenAt;
  let onlineRate = 0;

  if (isOnline && lastSeen) {
    const minutesSinceLastSeen = (Date.now() - lastSeen.getTime()) / 60000;
    // If seen within last 30 minutes, consider 100% online
    onlineRate = minutesSinceLastSeen < 30 ? 1.0 : Math.max(0, 1 - minutesSinceLastSeen / 1440);
  }

  // 4. Calculate data completeness (expected vs actual)
  // Expected: 1 data point per minute = 10080 points per week
  const expectedDataPoints = 7 * 24 * 60; // 1 point per minute
  const dataCompleteness = Math.min(1, totalDataPoints / expectedDataPoints);

  // 5. Calculate health score
  const onlineScore = onlineRate * 40;     // 40% weight
  const completenessScore = dataCompleteness * 30; // 30% weight
  const anomalyScore = (1 - anomalyRate) * 30;     // 30% weight
  const healthScore = Math.round(onlineScore + completenessScore + anomalyScore);

  return {
    deviceId,
    onlineRate: Math.round(onlineRate * 100) / 100,
    dataCompleteness: Math.round(dataCompleteness * 100) / 100,
    anomalyRate: Math.round(anomalyRate * 100) / 100,
    avgReportInterval: Math.round(row.avg_interval || 0),
    totalDataPoints,
    firstSeen: row.first_time,
    lastSeen: row.last_time,
    healthScore: Math.min(100, Math.max(0, healthScore)),
    scoreBreakdown: {
      onlineScore: Math.round(onlineScore * 10) / 10,
      completenessScore: Math.round(completenessScore * 10) / 10,
      anomalyScore: Math.round(anomalyScore * 10) / 10,
    },
  };
}

/**
 * Batch build profiles for all devices in a tenant.
 */
export async function buildTenantDeviceProfiles(tenantId: string): Promise<DeviceProfile[]> {
  const devices = await prisma.device.findMany({
    where: { tenantId },
    select: { id: true },
  });

  const profiles: DeviceProfile[] = [];

  for (const device of devices) {
    const profile = await buildDeviceProfile(device.id);
    if (profile) profiles.push(profile);
  }

  return profiles;
}
