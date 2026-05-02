import { prisma } from '@ssas/database';
import { evaluateTagRule, type TagRule } from './tag-manager.js';

/**
 * Predefined tag rules for common device classifications.
 * These can be stored in DB and managed via UI in the future.
 */
const PREDEFINED_TAG_RULES: Array<{ key: string; label: string; rule: TagRule }> = [
  {
    key: 'device_status_category',
    label: '设备状态分类',
    rule: {
      logic: 'any',
      conditions: [{ field: 'status', operator: '=', value: 'error' }],
      thenValue: '异常',
      elseValue: '正常',
    },
  },
  {
    key: 'activity_level',
    label: '活跃度',
    rule: {
      logic: 'all',
      conditions: [
        { field: 'online_hours', operator: '<=', value: 0.5 },
      ],
      thenValue: '在线',
      elseValue: '离线',
    },
  },
  {
    key: 'data_quality',
    label: '数据质量',
    rule: {
      logic: 'any',
      conditions: [
        { field: 'health_score', operator: '>=', value: 80 },
      ],
      thenValue: '良好',
      elseValue: '需关注',
    },
  },
];

/**
 * Calculate and update computed tags for a single device.
 * Evaluates all predefined rules and persists results.
 */
export async function calculateDeviceTags(deviceId: string): Promise<string[]> {
  const appliedTags: string[] = [];

  for (const def of PREDEFINED_TAG_RULES) {
    const value = await evaluateTagRule(deviceId, def.rule);
    if (value) {
      await prisma.$transaction(async (tx) => {
        await tx.deviceTag.deleteMany({
          where: { deviceId, key: def.key, source: 'computed' },
        });
        await tx.deviceTag.create({
          data: {
            deviceId,
            key: def.key,
            value,
            source: 'computed',
          },
        });
      });

      appliedTags.push(`${def.key}=${value}`);
    }
  }

  return appliedTags;
}

/**
 * Batch calculate tags for all devices in a tenant.
 */
export async function calculateTenantTags(tenantId: string): Promise<{ deviceId: string; tags: string[] }[]> {
  const devices = await prisma.device.findMany({
    where: { tenantId },
    select: { id: true },
  });

  const results: { deviceId: string; tags: string[] }[] = [];

  for (const device of devices) {
    const tags = await calculateDeviceTags(device.id);
    results.push({ deviceId: device.id, tags });
  }

  return results;
}
