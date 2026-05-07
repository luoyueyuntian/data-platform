import { prisma } from '@ssas/database';
import { buildSegmentSQL, type SegmentDefinition } from './segment-builder.js';

/**
 * Segment calculation result.
 */
export interface SegmentResult {
  segmentName: string;
  entityCount: number;
  entityIds: string[];
  sql: string;
}

/**
 * Execute a segment definition and return matching entity IDs.
 */
export async function calculateSegment(
  tenantId: string,
  segment: SegmentDefinition
): Promise<SegmentResult> {
  const { sql, params } = buildSegmentSQL(segment);

  const fullSQL = `
    SELECT e.id, e.name, e.status, e.type
    FROM entities e
    WHERE e.tenant_id = $1 AND (${sql})
    ORDER BY e.name ASC
  `;

  const rows = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
    fullSQL,
    tenantId,
    ...params
  );

  return {
    segmentName: segment.name,
    entityCount: rows.length,
    entityIds: rows.map((r) => r.id),
    sql: fullSQL.replace(/\$1/, `'${tenantId}'`).replace(/\$\d+/g, (m) => {
      const i = parseInt(m.slice(1)) - 2;
      const val = params[i];
      return typeof val === 'string' ? `'${val}'` : String(val);
    }),
  };
}

/**
 * Predefined segments for common entity groupings.
 */
export const PREDEFINED_SEGMENTS: SegmentDefinition[] = [
  {
    name: '活跃实体',
    description: '当前状态为活跃的所有实体',
    relation: 'or',
    rules: [{ type: 'profile', field: 'status', operator: '=', value: 'active' }],
  },
  {
    name: '异常实体',
    description: '状态为异常的实体',
    relation: 'or',
    rules: [
      { type: 'profile', field: 'status', operator: '=', value: 'error' },
    ],
  },
  {
    name: '不活跃实体',
    description: '状态为不活跃的实体',
    relation: 'or',
    rules: [
      { type: 'profile', field: 'status', operator: '=', value: 'inactive' },
    ],
  },
];
