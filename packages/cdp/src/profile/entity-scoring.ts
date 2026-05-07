import { buildEntityProfile } from './entity-profile.js';

/**
 * Entity scoring result with interpretation.
 */
export interface EntityScoreResult {
  entityId: string;
  healthScore: number;
  level: 'healthy' | 'normal' | 'warning' | 'critical';
  breakdown: {
    activeScore: number;
    completenessScore: number;
    anomalyScore: number;
  };
  suggestions: string[];
}

const HEALTHY_THRESHOLD = 80;
const NORMAL_THRESHOLD = 60;
const WARNING_THRESHOLD = 40;

/**
 * Score an entity and return an interpreted result.
 */
export async function scoreEntity(entityId: string): Promise<EntityScoreResult | null> {
  const profile = await buildEntityProfile(entityId);
  if (!profile) return null;

  let level: EntityScoreResult['level'];
  const suggestions: string[] = [];

  if (profile.healthScore >= HEALTHY_THRESHOLD) {
    level = 'healthy';
  } else if (profile.healthScore >= NORMAL_THRESHOLD) {
    level = 'normal';
    if (profile.activeRate < 0.8) suggestions.push('活跃率偏低，请检查连接');
    if (profile.dataCompleteness < 0.8) suggestions.push('数据上报不完整，可能存在丢包');
    if (profile.anomalyRate > 0.1) suggestions.push('异常数据比例偏高');
  } else if (profile.healthScore >= WARNING_THRESHOLD) {
    level = 'warning';
    if (profile.activeRate < 0.5) suggestions.push('实体频繁离线，建议检查');
    if (profile.dataCompleteness < 0.5) suggestions.push('数据大量缺失');
    if (profile.anomalyRate > 0.3) suggestions.push('异常数据占比过高');
  } else {
    level = 'critical';
    suggestions.push('健康度极低，建议立即处理');
  }

  return {
    entityId,
    healthScore: profile.healthScore,
    level,
    breakdown: profile.scoreBreakdown,
    suggestions,
  };
}

/**
 * Get score distribution for all entities in a tenant.
 */
export async function getTenantScoreDistribution(tenantId: string): Promise<{
  healthy: number;
  normal: number;
  warning: number;
  critical: number;
  noData: number;
}> {
  const { buildTenantEntityProfiles } = await import('./entity-profile.js');
  const profiles = await buildTenantEntityProfiles(tenantId);

  const dist = { healthy: 0, normal: 0, warning: 0, critical: 0, noData: 0 };

  for (const p of profiles) {
    if (p.totalEvents === 0) {
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

// Backward compatibility aliases
export const scoreDevice = scoreEntity;
export type DeviceScoreResult = EntityScoreResult;
