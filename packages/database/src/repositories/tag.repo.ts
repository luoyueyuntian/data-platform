import { prisma } from '../client';

export const TagRepository = {
  async findById(id: string) {
    return prisma.deviceTag.findUnique({ where: { id } });
  },

  async findByDeviceId(deviceId: string) {
    return prisma.deviceTag.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: {
    deviceId: string;
    key: string;
    value: string;
    source?: string;
  }) {
    return prisma.deviceTag.create({ data });
  },

  async delete(id: string) {
    return prisma.deviceTag.delete({ where: { id } });
  },

  async deleteByKey(deviceId: string, key: string) {
    return prisma.deviceTag.deleteMany({ where: { deviceId, key } });
  },
};
