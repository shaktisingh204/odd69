import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class QuickRepliesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.chatbotQuickReplySet.findMany({
      include: { replies: true },
    });
  }

  async findOne(id: number) {
    const set = await this.prisma.chatbotQuickReplySet.findUnique({
      where: { id },
      include: { replies: true },
    });
    if (!set) throw new NotFoundException(`Quick reply set #${id} not found`);
    return set;
  }

  async create(data: any) {
    return this.prisma.chatbotQuickReplySet.create({ data });
  }

  async update(id: number, data: any) {
    await this.findOne(id);
    return this.prisma.chatbotQuickReplySet.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotQuickReplySet.delete({ where: { id } });
  }

  async addReply(setId: number, data: any) {
    await this.findOne(setId);
    return this.prisma.chatbotQuickReply.create({
      data: { ...data, setId },
    });
  }

  async updateReply(replyId: number, data: any) {
    const reply = await this.prisma.chatbotQuickReply.findUnique({
      where: { id: replyId },
    });
    if (!reply) throw new NotFoundException(`Quick reply #${replyId} not found`);
    return this.prisma.chatbotQuickReply.update({
      where: { id: replyId },
      data,
    });
  }

  async removeReply(replyId: number) {
    const reply = await this.prisma.chatbotQuickReply.findUnique({
      where: { id: replyId },
    });
    if (!reply) throw new NotFoundException(`Quick reply #${replyId} not found`);
    return this.prisma.chatbotQuickReply.delete({ where: { id: replyId } });
  }
}
