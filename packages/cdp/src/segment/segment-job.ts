import { prisma } from '@ssas/database';
import { buildSegmentSQL, type SegmentDefinition } from './segment-builder.js';

/**
 * Segment calculation result.
 */
export interface SegmentResult {
  segmentName: string;
  deviceCount: number;
  deviceIds: string[];
  sql: string;
}

/**
 * Execute a segment definition and return matching device IDs.
 */
export async function calculateSegment(
  tenantId: string,
  segment: SegmentDefinition
): Promise<SegmentResult> {
  const { sql, params } = buildSegmentSQL(segment);

  const fullSQL = `
    SELECT d.id, d.name, d.status, d.type
    FROM devices d
    WHERE d.tenant_id = $1 AND (${sql})
    ORDER BY d.name ASC
  `;

  const rows = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
    fullSQL,
    tenantId,
    ...params
  );

  return {
    segmentName: segment.name,
    deviceCount: rows.length,
    deviceIds: rows.map((r) => r.id),
    sql: fullSQL.replace(/\$1/, `'${tenantId}'`).replace(/\$\d+/g, (m) => {
      const i = parseInt(m.slice(1)) - 2;
      const val = params[i];
      return typeof val === 'string' ? `'${val}'` : String(val);
    }),
  };
}

/**
 * Predefined segments for common device groupings.
 */
export const PREDEFINED_SEGMENTS: SegmentDefinition[] = [
  {
    name: '在线设备',
    description: '当前状态为在线的所有设备',
    relation: 'or',
    rules: [{ type: 'profile', field: 'status', operator: '=', value: 'online' }],
  },
  {
    name: '异常设备',
    description: '状态为异常或健康度偏低的设备',
    relation: 'or',
    rules: [
      { type: 'profile', field: 'status', operator: '=', value: 'error' },
    ],
  },
  {
    name: '离线设备',
    description: '超过 1 小时未上报数据的设备',
    relation: 'or',
    rules: [
      { type: 'profile', field: 'status', operator: '=', value: 'offline' },
    ],
  },
];
