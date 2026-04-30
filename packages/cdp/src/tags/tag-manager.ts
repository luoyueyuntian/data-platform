import { prisma } from '@ssas/database';
import { DeviceRepository } from '@ssas/database';

export interface TagDefinition {
  key: string;
  label: string;
  /** 标签来源: manual | rule | computed */
  source: 'manual' | 'rule' | 'computed';
  /** 规则标签的规则表达式 (仅 source=rule 时使用) */
  rule?: TagRule;
  /** 可选值列表 */
  possibleValues?: string[];
}

export interface TagRule {
  /** 条件逻辑: all (AND) | any (OR) */
  logic: 'all' | 'any';
  conditions: TagCondition[];
  /** 满足条件时设置的标签值 */
  thenValue: string;
  /** 不满足条件时的标签值 (可选) */
  elseValue?: string;
}

export interface TagCondition {
  field: 'status' | 'type' | 'phase' | 'health_score' | 'metric_avg' | 'online_hours' | 'data_count';
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in';
  value: unknown;
}

/**
 * Add a manual tag to a device.
 */
export async function addManualTag(deviceId: string, key: string, value: string): Promise<void> {
  await prisma.deviceTag.create({
    data: { deviceId, key, value, source: 'manual' },
  });
}

/**
 * Remove a tag from a device.
 */
export async function removeTag(tagId: string): Promise<void> {
  await prisma.deviceTag.delete({ where: { id: tagId } });
}

/**
 * Evaluate a rule-based tag against a device.
 * Returns the tag value if conditions are met, or undefined.
 */
export async function evaluateTagRule(deviceId: string, rule: TagRule): Promise<string | undefined> {
  const results = await Promise.all(
    rule.conditions.map((cond) => evaluateCondition(deviceId, cond))
  );

  const met = rule.logic === 'all' ? results.every(Boolean) : results.some(Boolean);
  return met ? rule.thenValue : rule.elseValue;
}

/**
 * Evaluate a single condition against a device.
 */
async function evaluateCondition(deviceId: string, cond: TagCondition): Promise<boolean> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return false;

  switch (cond.field) {
    case 'status':
      return compare(device.status, cond.operator, cond.value);
    case 'type':
      return compare(device.type, cond.operator, cond.value);
    case 'phase':
      return compare(device.phase, cond.operator, cond.value);
    case 'online_hours': {
      if (!device.lastSeenAt) return false;
      const hoursSinceLastSeen = (Date.now() - device.lastSeenAt.getTime()) / 3600000;
      return compare(hoursSinceLastSeen, cond.operator, cond.value);
    }
    case 'data_count': {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        'SELECT COUNT(*) as count FROM timescale.data_points WHERE device_id = $1 AND time >= $2',
        deviceId, sevenDaysAgo
      );
      return compare(Number(result[0]?.count ?? 0), cond.operator, cond.value);
    }
    case 'health_score': {
      const { buildDeviceProfile } = await import('../profile/device-profile');
      const profile = await buildDeviceProfile(deviceId);
      if (!profile) return false;
      return compare(profile.healthScore, cond.operator, cond.value);
    }
    default:
      return false;
  }
}

function compare(actual: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case '=':  return actual === expected;
    case '!=': return actual !== expected;
    case '>':  return Number(actual) > Number(expected);
    case '<':  return Number(actual) < Number(expected);
    case '>=': return Number(actual) >= Number(expected);
    case '<=': return Number(actual) <= Number(expected);
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    default:   return false;
  }
}
