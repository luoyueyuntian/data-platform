import { prisma } from '../client.js';
import { Prisma } from '@prisma/client';

const entityInclude = {
  group: { select: { id: true, name: true } },
  tags: { select: { id: true, key: true, value: true, source: true } },
} satisfies Prisma.EntityInclude;

export interface EntityListParams {
  tenantId: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  type?: string;
  groupId?: string;
  phase?: string;
}

export interface EntityListResult {
  data: Array<{
    id: string;
    name: string;
    entityKey: string;
    type: string;
    status: string;
    phase: string;
    group: { id: string; name: string } | null;
    location: Record<string, unknown> | null;
    lastSeenAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { tags: number };
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const EntityRepository = {
  /**
   * List entities with pagination, search, and filtering.
   */
  async findAll(params: EntityListParams): Promise<EntityListResult> {
    const { tenantId, page, pageSize, search, status, type, groupId, phase } = params;

    const where: Prisma.EntityWhereInput = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { entityKey: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (type) where.type = type;
    if (groupId) where.groupId = groupId;
    if (phase) where.phase = phase;

    const [data, total] = await Promise.all([
      prisma.entity.findMany({
        where,
        include: {
          group: { select: { id: true, name: true } },
          _count: { select: { tags: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.entity.count({ where }),
    ]);

    return {
      data: data.map((d) => ({
        id: d.id,
        name: d.name,
        entityKey: d.entityKey,
        type: d.type,
        status: d.status,
        phase: d.phase,
        group: d.group,
        location: d.location as Record<string, unknown> | null,
        lastSeenAt: d.lastSeenAt,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        _count: { tags: d._count.tags },
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  /**
   * Find entity by ID with full relations.
   */
  async findById(id: string, tenantId: string) {
    return prisma.entity.findFirst({
      where: { id, tenantId },
      include: entityInclude,
    });
  },

  /**
   * Find entity by entityKey (unique across tenant).
   */
  async findByEntityKey(entityKey: string, tenantId: string) {
    return prisma.entity.findFirst({
      where: { entityKey, tenantId },
    });
  },

  /**
   * Create a new entity.
   */
  async create(data: {
    tenantId: string;
    name: string;
    entityKey: string;
    type?: string;
    status?: string;
    groupId?: string;
    location?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const location = data.location === undefined
      ? Prisma.DbNull
      : data.location as Prisma.InputJsonValue;
    const metadata = data.metadata === undefined
      ? Prisma.DbNull
      : data.metadata as Prisma.InputJsonValue;

    return prisma.entity.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        entityKey: data.entityKey,
        type: data.type ?? 'custom',
        status: data.status ?? 'inactive',
        groupId: data.groupId,
        location,
        metadata,
      },
      include: entityInclude,
    });
  },

  /**
   * Update an existing entity.
   */
  async update(id: string, tenantId: string, data: {
    name?: string;
    type?: string;
    status?: string;
    phase?: string;
    groupId?: string | null;
    location?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const updateData: Prisma.EntityUncheckedUpdateManyInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.phase !== undefined) updateData.phase = data.phase;
    if (data.groupId !== undefined) updateData.groupId = data.groupId;
    if (data.location !== undefined) {
      updateData.location = data.location === null
        ? Prisma.DbNull
        : data.location as Prisma.InputJsonValue;
    }
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata === null
        ? Prisma.DbNull
        : data.metadata as Prisma.InputJsonValue;
    }

    return prisma.entity.updateMany({
      where: { id, tenantId },
      data: updateData,
    });
  },

  /**
   * Delete an entity (hard delete).
   */
  async delete(id: string, tenantId: string) {
    return prisma.entity.deleteMany({
      where: { id, tenantId },
    });
  },

  /**
   * Update entity status.
   */
  async updateStatus(id: string, tenantId: string, status: string, lastSeenAt?: Date) {
    const data: Prisma.EntityUncheckedUpdateManyInput = { status };
    if (lastSeenAt) data.lastSeenAt = lastSeenAt;
    // Phase transitions
    if (status === 'active' || status === 'inactive') {
      const entity = await prisma.entity.findFirst({ where: { id, tenantId } });
      if (entity && entity.phase === 'registered') {
        data.phase = 'active';
      }
    }
    return prisma.entity.updateMany({
      where: { id, tenantId },
      data,
    });
  },

  /**
   * Update last seen timestamp.
   */
  async updateLastSeen(id: string, tenantId: string) {
    return prisma.entity.updateMany({
      where: { id, tenantId },
      data: { lastSeenAt: new Date(), status: 'active' },
    });
  },

  /**
   * Get entity statistics for a tenant.
   */
  async getStats(tenantId: string) {
    const [total, byStatus, byType] = await Promise.all([
      prisma.entity.count({ where: { tenantId } }),
      prisma.entity.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
      prisma.entity.groupBy({
        by: ['type'],
        where: { tenantId },
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      byType: Object.fromEntries(byType.map((t) => [t.type, t._count])),
    };
  },
};
