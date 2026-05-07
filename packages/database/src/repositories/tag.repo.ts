import { prisma } from '../client.js';

export const TagRepository = {
  async findById(id: string) {
    return prisma.entityTag.findUnique({ where: { id } });
  },

  async findByEntityId(entityId: string) {
    return prisma.entityTag.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: {
    entityId: string;
    key: string;
    value: string;
    source?: string;
  }) {
    return prisma.entityTag.create({ data });
  },

  async delete(id: string) {
    return prisma.entityTag.delete({ where: { id } });
  },

  async deleteByKey(entityId: string, key: string) {
    return prisma.entityTag.deleteMany({ where: { entityId, key } });
  },
};
