import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BotConversation,
  BotConversationDocument,
} from '../schemas/bot-conversation.schema';
import {
  BotMessage,
  BotMessageDocument,
} from '../schemas/bot-message.schema';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(BotConversation.name)
    private readonly conversationModel: Model<BotConversationDocument>,
    @InjectModel(BotMessage.name)
    private readonly messageModel: Model<BotMessageDocument>,
  ) {}

  async findAll(query: {
    status?: string;
    channel?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, channel, page = 1, limit = 20 } = query;
    const filter: any = {};
    if (status) filter.status = status;
    if (channel) filter.channel = channel;

    const [data, total] = await Promise.all([
      this.conversationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.conversationModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(sessionId: string) {
    const conversation = await this.conversationModel
      .findOne({ sessionId })
      .exec();
    if (!conversation)
      throw new NotFoundException(
        `Conversation with session ${sessionId} not found`,
      );
    return conversation;
  }

  async getMessages(sessionId: string, page = 1, limit = 50) {
    const [data, total] = await Promise.all([
      this.messageModel
        .find({ conversationId: sessionId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.messageModel
        .countDocuments({ conversationId: sessionId })
        .exec(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async takeover(sessionId: string, adminId: number) {
    const conversation = await this.findOne(sessionId);
    conversation.status = 'escalated';
    conversation.escalatedTo = adminId;
    conversation.escalatedAt = new Date();
    return conversation.save();
  }

  async release(sessionId: string) {
    const conversation = await this.findOne(sessionId);
    conversation.status = 'active';
    conversation.escalatedTo = undefined;
    conversation.escalatedAt = undefined;
    return conversation.save();
  }

  async close(sessionId: string) {
    const conversation = await this.findOne(sessionId);
    conversation.status = 'closed';
    return conversation.save();
  }

  async addTag(sessionId: string, tag: string) {
    return this.conversationModel
      .findOneAndUpdate(
        { sessionId },
        { $addToSet: { tags: tag } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  async removeTag(sessionId: string, tag: string) {
    return this.conversationModel
      .findOneAndUpdate(
        { sessionId },
        { $pull: { tags: tag } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  async bulkClose(sessionIds: string[]) {
    return this.conversationModel
      .updateMany(
        { sessionId: { $in: sessionIds } },
        { $set: { status: 'closed' } },
      )
      .exec();
  }

  async bulkTag(sessionIds: string[], tags: string[]) {
    return this.conversationModel
      .updateMany(
        { sessionId: { $in: sessionIds } },
        { $addToSet: { tags: { $each: tags } } },
      )
      .exec();
  }

  async search(query: {
    q?: string;
    dateFrom?: string;
    dateTo?: string;
    userId?: number;
  }) {
    const filter: any = {};

    if (query.q) {
      filter.$or = [
        { sessionId: { $regex: query.q, $options: 'i' } },
        { username: { $regex: query.q, $options: 'i' } },
        { tags: { $in: [query.q] } },
      ];
    }
    if (query.userId) {
      filter.userId = query.userId;
    }
    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
    }

    return this.conversationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
  }
}
