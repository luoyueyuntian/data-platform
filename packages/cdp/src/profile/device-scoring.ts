import { buildDeviceProfile } from './device-profile';

/**
 * Device scoring result with interpretation.
 */
export interface DeviceScoreResult {
  deviceId: string;
  healthScore: number;
  level: 'healthy' | 'normal' | 'warning' | 'critical';
  breakdown: {
    onlineScore: number;
    completenessScore: number;
    anomalyScore: number;
  };
  suggestions: string[];
}

const HEALTHY_THRESHOLD = 80;
const NORMAL_THRESHOLD = 60;
const WARNING_THRESHOLD = 40;

/**
 * Score a device and return an interpreted result.
 */
export async function scoreDevice(deviceId: string): Promise<DeviceScoreResult | null> {
  const profile = await buildDeviceProfile(deviceId);
  if (!profile) return null;

  let level: DeviceScoreResult['level'];
  const suggestions: string[] = [];

  if (profile.healthScore >= HEALTHY_THRESHOLD) {
    level = 'healthy';
  } else if (profile.healthScore >= NORMAL_THRESHOLD) {
    level = 'normal';
    if (profile.onlineRate < 0.8) suggestions.push('在线率偏低，请检查网络连接');
    if (profile.dataCompleteness < 0.8) suggestions.push('数据上报不完整，可能存在丢包');
    if (profile.anomalyRate > 0.1) suggestions.push('异常数据比例偏高，建议校准传感器');
  } else if (profile.healthScore >= WARNING_THRESHOLD) {
    level = 'warning';
    if (profile.onlineRate < 0.5) suggestions.push('设备频繁离线，建议检查供电和网络');
    if (profile.dataCompleteness < 0.5) suggestions.push('数据大量缺失，设备可能故障');
    if (profile.anomalyRate > 0.3) suggestions.push('异常数据占比过高，建议立即检修');
  } else {
    level = 'critical';
    suggestions.push('设备健康度极低，建议立即安排现场检修');
    suggestions.push('考虑将设备标记为"维护"状态');
  }

  return {
    deviceId,
    healthScore: profile.healthScore,
    level,
    breakdown: profile.scoreBreakdown,
    suggestions,
  };
}

/**
 * Get score distribution for all devices in a tenant.
 */
export async function getTenantScoreDistribution(tenantId: string): Promise<{
  healthy: number;
  normal: number;
  warning: number;
  critical: number;
  noData: number;
}> {
  const { buildTenantDeviceProfiles } = await import('./device-profile');
  const profiles = await buildTenantDeviceProfiles(tenantId);

  const dist = { healthy: 0, normal: 0, warning: 0, critical: 0, noData: 0 };

  for (const p of profiles) {
    if (p.totalDataPoints === 0) {
      dist.noData++;
    } else if (p.healthScore >= HEALTHY_THRESHOLD) {
      dist.healthy++;
    } else if (p.healthScore >= NORMAL_THRESHOLD) {
      dist.normal++;
    } else if (p.healthScore >= WARNING_THRESHOLD) {
      dist.warning++;
    } else {
      dist.critical++;
    }
  }

  return dist;
}
