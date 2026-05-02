import { prisma } from '../client.js';
import { Prisma } from '@prisma/client';

export const SensorRepository = {
  async findByDeviceId(deviceId: string) {
    return prisma.sensor.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'asc' },
    });
  },

  async findById(id: string) {
    return prisma.sensor.findUnique({ where: { id } });
  },

  async create(data: {
    deviceId: string;
    name: string;
    type: string;
    unit: string;
    rangeMin?: number;
    rangeMax?: number;
    precision?: number;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.sensor.create({
      data: {
        ...data,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : Prisma.DbNull,
      },
    });
  },

  async update(id: string, data: {
    name?: string;
    type?: string;
    unit?: string;
    rangeMin?: number | null;
    rangeMax?: number | null;
    precision?: number | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const updateData: Prisma.SensorUpdateInput = {
      name: data.name,
      type: data.type,
      unit: data.unit,
      rangeMin: data.rangeMin,
      rangeMax: data.rangeMax,
      precision: data.precision,
    };
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata === null ? Prisma.DbNull : JSON.parse(JSON.stringify(data.metadata));
    }
    return prisma.sensor.update({ where: { id }, data: updateData });
  },

  async delete(id: string) {
    return prisma.sensor.delete({ where: { id } });
  },
};
