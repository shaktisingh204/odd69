import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma.service';
import {
  BotConversation,
  BotConversationDocument,
} from '../schemas/bot-conversation.schema';

@Injectable()
export class EscalationService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(BotConversation.name)
    private readonly conversationModel: Model<BotConversationDocument>,
  ) {}

  async findAll() {
    return this.prisma.chatbotEscalationRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const rule = await this.prisma.chatbotEscalationRule.findUnique({
      where: { id },
    });
    if (!rule)
      throw new NotFoundException(`Escalation rule #${id} not found`);
    return rule;
  }

  async create(data: any) {
    return this.prisma.chatbotEscalationRule.create({ data });
  }

  async update(id: number, data: any) {
    await this.findOne(id);
    return this.prisma.chatbotEscalationRule.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chatbotEscalationRule.delete({ where: { id } });
  }

  async toggle(id: number) {
    const rule = await this.findOne(id);
    return this.prisma.chatbotEscalationRule.update({
      where: { id },
      data: { isEnabled: !rule.isEnabled },
    });
  }

  async getActiveEscalations() {
    return this.conversationModel
      .find({ status: 'escalated' })
      .sort({ escalatedAt: -1 })
      .exec();
  }
}
