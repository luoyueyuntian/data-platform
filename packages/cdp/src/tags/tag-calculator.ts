import { prisma } from '@ssas/database';
import { evaluateTagRule, type TagRule } from './tag-manager.js';

/**
 * Predefined tag rules for common entity classifications.
 */
const PREDEFINED_TAG_RULES: Array<{ key: string; label: string; rule: TagRule }> = [
  {
    key: 'entity_status_category',
    label: '状态分类',
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
      thenValue: '活跃',
      elseValue: '不活跃',
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
 * Calculate and update computed tags for a single entity.
 */
export async function calculateEntityTags(entityId: string): Promise<string[]> {
  const appliedTags: string[] = [];

  for (const def of PREDEFINED_TAG_RULES) {
    const value = await evaluateTagRule(entityId, def.rule);
    if (value) {
      await prisma.$transaction(async (tx) => {
        await tx.entityTag.deleteMany({
          where: { entityId, key: def.key, source: 'computed' },
        });
        await tx.entityTag.create({
          data: {
            entityId,
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
 * Batch calculate tags for all entities in a tenant.
 */
export async function calculateTenantTags(tenantId: string): Promise<{ entityId: string; tags: string[] }[]> {
  const entities = await prisma.entity.findMany({
    where: { tenantId },
    select: { id: true },
  });

  const results: { entityId: string; tags: string[] }[] = [];

  for (const entity of entities) {
    const tags = await calculateEntityTags(entity.id);
    results.push({ entityId: entity.id, tags });
  }

  return results;
}

// Backward compatibility aliases
export const calculateDeviceTags = calculateEntityTags;
export const calculateTenantDeviceTags = calculateTenantTags;
