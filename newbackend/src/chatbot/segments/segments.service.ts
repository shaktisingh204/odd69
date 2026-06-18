import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class SegmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.chatbotUserSegment.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const segment = await this.prisma.chatbotUserSegment.findUnique({
      where: { id },
    });
    if (!segment) throw new NotFoundException(`Segment #${id} not found`);
    return segment;
  }

  async create(data: any) {
    return this.prisma.chatbotUserSegment.create({ data });
  }

  async update(id: number, data: any) {
    await this.findOne(id);
    return this.prisma.chatbotUserSegment.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotUserSegment.delete({ where: { id } });
  }

  async previewUsers(id: number, limit = 50) {
    const segment = await this.findOne(id);
    const conditions = segment.conditions as any;

    const where: any = {};

    if (conditions?.role) {
      where.role = conditions.role;
    }
    if (conditions?.vipTier) {
      where.vipTier = conditions.vipTier;
    }
    if (conditions?.isBanned !== undefined) {
      where.isBanned = conditions.isBanned;
    }
    if (conditions?.createdAfter) {
      where.createdAt = { ...where.createdAt, gte: new Date(conditions.createdAfter) };
    }
    if (conditions?.createdBefore) {
      where.createdAt = { ...where.createdAt, lte: new Date(conditions.createdBefore) };
    }

    const users = await this.prisma.user.findMany({
      where,
      take: limit,
      select: {
        id: true,
        username: true,
        role: true,
        isBanned: true,
        createdAt: true,
      },
    });

    const total = await this.prisma.user.count({ where });

    return { users, total, limit };
  }

  async addToBlacklist(userId: number, reason?: string) {
    return this.prisma.chatbotUserBlacklist.create({
      data: { userId, reason },
    });
  }

  async removeFromBlacklist(userId: number) {
    return this.prisma.chatbotUserBlacklist.delete({
      where: { userId },
    });
  }

  async getBlacklist() {
    return this.prisma.chatbotUserBlacklist.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
