import { prisma } from '@ssas/database';
import { EntityRepository } from '@ssas/database';

export interface TagDefinition {
  key: string;
  label: string;
  source: 'manual' | 'rule' | 'computed';
  rule?: TagRule;
  possibleValues?: string[];
}

export interface TagRule {
  logic: 'all' | 'any';
  conditions: TagCondition[];
  thenValue: string;
  elseValue?: string;
}

export interface TagCondition {
  field: 'status' | 'type' | 'phase' | 'health_score' | 'event_avg' | 'online_hours' | 'event_count';
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in';
  value: unknown;
}

/**
 * Add a manual tag to an entity.
 */
export async function addManualTag(entityId: string, key: string, value: string): Promise<void> {
  await prisma.entityTag.create({
    data: { entityId, key, value, source: 'manual' },
  });
}

/**
 * Remove a tag from an entity.
 */
export async function removeTag(tagId: string): Promise<void> {
  await prisma.entityTag.delete({ where: { id: tagId } });
}

/**
 * Evaluate a rule-based tag against an entity.
 */
export async function evaluateTagRule(entityId: string, rule: TagRule): Promise<string | undefined> {
  const results = await Promise.all(
    rule.conditions.map((cond) => evaluateCondition(entityId, cond))
  );

  const met = rule.logic === 'all' ? results.every(Boolean) : results.some(Boolean);
  return met ? rule.thenValue : rule.elseValue;
}

async function evaluateCondition(entityId: string, cond: TagCondition): Promise<boolean> {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) return false;

  switch (cond.field) {
    case 'status':
      return compare(entity.status, cond.operator, cond.value);
    case 'type':
      return compare(entity.type, cond.operator, cond.value);
    case 'phase':
      return compare(entity.phase, cond.operator, cond.value);
    case 'online_hours': {
      if (!entity.lastSeenAt) return false;
      const hoursSinceLastSeen = (Date.now() - entity.lastSeenAt.getTime()) / 3600000;
      return compare(hoursSinceLastSeen, cond.operator, cond.value);
    }
    case 'event_count': {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        'SELECT COUNT(*) as count FROM timescale.events WHERE entity_id = $1 AND time >= $2',
        entityId, sevenDaysAgo
      );
      return compare(Number(result[0]?.count ?? 0), cond.operator, cond.value);
    }
    case 'health_score': {
      const { buildEntityProfile } = await import('../profile/entity-profile.js');
      const profile = await buildEntityProfile(entityId);
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
