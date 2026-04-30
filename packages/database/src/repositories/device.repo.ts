import { prisma } from '../client';
import { Prisma } from '@prisma/client';

const deviceInclude = {
  group: { select: { id: true, name: true } },
  sensors: { select: { id: true, name: true, type: true, unit: true } },
  tags: { select: { id: true, key: true, value: true, source: true } },
} satisfies Prisma.DeviceInclude;

export interface DeviceListParams {
  tenantId: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  type?: string;
  groupId?: string;
  phase?: string;
}

export interface DeviceListResult {
  data: Array<{
    id: string;
    name: string;
    deviceKey: string;
    type: string;
    status: string;
    phase: string;
    group: { id: string; name: string } | null;
    location: Record<string, unknown> | null;
    lastSeenAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { sensors: number; tags: number };
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const DeviceRepository = {
  /**
   * List devices with pagination, search, and filtering.
   */
  async findAll(params: DeviceListParams): Promise<DeviceListResult> {
    const { tenantId, page, pageSize, search, status, type, groupId, phase } = params;

    const where: Prisma.DeviceWhereInput = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { deviceKey: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (type) where.type = type;
    if (groupId) where.groupId = groupId;
    if (phase) where.phase = phase;

    const [data, total] = await Promise.all([
      prisma.device.findMany({
        where,
        include: {
          group: { select: { id: true, name: true } },
          _count: { select: { sensors: true, tags: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.device.count({ where }),
    ]);

    return {
      data: data.map((d) => ({
        id: d.id,
        name: d.name,
        deviceKey: d.deviceKey,
        type: d.type,
        status: d.status,
        phase: d.phase,
        group: d.group,
        location: d.location as Record<string, unknown> | null,
        lastSeenAt: d.lastSeenAt,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        _count: { sensors: d._count.sensors, tags: d._count.tags },
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  /**
   * Find device by ID with full relations.
   */
  async findById(id: string, tenantId: string) {
    return prisma.device.findFirst({
      where: { id, tenantId },
      include: deviceInclude,
    });
  },

  /**
   * Find device by deviceKey (unique across tenant).
   */
  async findByDeviceKey(deviceKey: string, tenantId: string) {
    return prisma.device.findFirst({
      where: { deviceKey, tenantId },
    });
  },

  /**
   * Create a new device.
   */
  async create(data: {
    tenantId: string;
    name: string;
    deviceKey: string;
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

    return prisma.device.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        deviceKey: data.deviceKey,
        type: data.type ?? 'custom',
        status: data.status ?? 'offline',
        groupId: data.groupId,
        location,
        metadata,
      },
      include: deviceInclude,
    });
  },

  /**
   * Update an existing device.
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
    // Build update payload, handling null/undefined
    const updateData: Prisma.DeviceUncheckedUpdateManyInput = {};
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

    return prisma.device.updateMany({
      where: { id, tenantId },
      data: updateData,
    });
  },

  /**
   * Delete a device (hard delete).
   */
  async delete(id: string, tenantId: string) {
    return prisma.device.deleteMany({
      where: { id, tenantId },
    });
  },

  /**
   * Update device status.
   */
  async updateStatus(id: string, tenantId: string, status: string, lastSeenAt?: Date) {
    const data: Prisma.DeviceUncheckedUpdateManyInput = { status };
    if (lastSeenAt) data.lastSeenAt = lastSeenAt;
    // Phase transitions
    if (status === 'online' || status === 'offline') {
      // Auto-transition from registered → active on first data
      const device = await prisma.device.findFirst({ where: { id, tenantId } });
      if (device && device.phase === 'registered') {
        data.phase = 'active';
      }
    }
    return prisma.device.updateMany({
      where: { id, tenantId },
      data,
    });
  },

  /**
   * Update last seen timestamp.
   */
  async updateLastSeen(id: string, tenantId: string) {
    return prisma.device.updateMany({
      where: { id, tenantId },
      data: { lastSeenAt: new Date(), status: 'online' },
    });
  },

  /**
   * Get device statistics for a tenant.
   */
  async getStats(tenantId: string) {
    const [total, byStatus, byType] = await Promise.all([
      prisma.device.count({ where: { tenantId } }),
      prisma.device.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
      prisma.device.groupBy({
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
