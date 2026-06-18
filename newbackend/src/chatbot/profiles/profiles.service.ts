import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.chatbotProfile.findMany({
      orderBy: { createdAt: 'desc' },
      include: { channels: true },
    });
  }

  async findOne(id: number) {
    const profile = await this.prisma.chatbotProfile.findUnique({
      where: { id },
      include: { channels: true },
    });
    if (!profile) throw new NotFoundException(`Profile #${id} not found`);
    return profile;
  }

  async create(data: {
    name: string;
    slug: string;
    avatar?: string;
    personality?: string;
    tone?: string;
    responseDelay?: number;
    typingIndicator?: boolean;
    isEnabled?: boolean;
    workingHoursOnly?: boolean;
    workingHoursStart?: string;
    workingHoursEnd?: string;
    workingTimezone?: string;
  }) {
    return this.prisma.chatbotProfile.create({ data });
  }

  async update(id: number, data: Partial<Parameters<typeof this.create>[0]>) {
    await this.findOne(id);
    return this.prisma.chatbotProfile.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotProfile.delete({ where: { id } });
  }

  async toggle(id: number) {
    const profile = await this.findOne(id);
    return this.prisma.chatbotProfile.update({
      where: { id },
      data: { isEnabled: !profile.isEnabled },
    });
  }

  async getStats(id: number) {
    await this.findOne(id);
    const channelCount = await this.prisma.chatbotChannelConfig.count({
      where: { botId: id },
    });
    return { profileId: id, channelCount };
  }
}
