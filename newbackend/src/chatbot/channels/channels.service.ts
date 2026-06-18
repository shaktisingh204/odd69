import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.chatbotChannelConfig.findMany({
      orderBy: { createdAt: 'desc' },
      include: { bot: true },
    });
  }

  async findOne(id: number) {
    const channel = await this.prisma.chatbotChannelConfig.findUnique({
      where: { id },
      include: { bot: true },
    });
    if (!channel) throw new NotFoundException(`Channel config #${id} not found`);
    return channel;
  }

  async create(data: {
    botId: number;
    channel: string;
    isEnabled?: boolean;
    priority?: number;
    settings?: any;
  }) {
    return this.prisma.chatbotChannelConfig.create({ data });
  }

  async update(id: number, data: Partial<Parameters<typeof this.create>[0]>) {
    await this.findOne(id);
    return this.prisma.chatbotChannelConfig.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotChannelConfig.delete({ where: { id } });
  }

  async toggle(id: number) {
    const channel = await this.findOne(id);
    return this.prisma.chatbotChannelConfig.update({
      where: { id },
      data: { isEnabled: !channel.isEnabled },
    });
  }
}
