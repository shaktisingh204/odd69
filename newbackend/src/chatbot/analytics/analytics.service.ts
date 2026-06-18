import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma.service';
import {
  BotAnalyticsEvent,
  BotAnalyticsEventDocument,
} from '../schemas/bot-analytics-event.schema';
import {
  BotConversation,
  BotConversationDocument,
} from '../schemas/bot-conversation.schema';
import {
  BotMessage,
  BotMessageDocument,
} from '../schemas/bot-message.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(BotAnalyticsEvent.name)
    private readonly botAnalyticsEventModel: Model<BotAnalyticsEventDocument>,
    @InjectModel(BotConversation.name)
    private readonly botConversationModel: Model<BotConversationDocument>,
    @InjectModel(BotMessage.name)
    private readonly botMessageModel: Model<BotMessageDocument>,
  ) {}

  async getDashboard() {
    const [
      totalConversations,
      activeConversations,
      resolvedConversations,
      escalatedConversations,
      satisfactionResult,
      totalMessages,
    ] = await Promise.all([
      this.botConversationModel.countDocuments(),
      this.botConversationModel.countDocuments({ status: 'active' }),
      this.botConversationModel.countDocuments({ status: 'resolved' }),
      this.botConversationModel.countDocuments({ status: 'escalated' }),
      this.botConversationModel.aggregate([
        { $match: { satisfaction: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$satisfaction' } } },
      ]),
      this.botMessageModel.countDocuments(),
    ]);

    return {
      totalConversations,
      activeConversations,
      resolvedConversations,
      escalatedConversations,
      avgSatisfaction: satisfactionResult[0]?.avg ?? null,
      totalMessages,
    };
  }

  async getConversationVolume(
    dateFrom?: string,
    dateTo?: string,
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day',
  ) {
    const match: Record<string, any> = {};
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
      if (dateTo) match.createdAt.$lte = new Date(dateTo);
    }

    const dateFormat: Record<string, any> = {
      hour: {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
        hour: { $hour: '$createdAt' },
      },
      day: {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      },
      week: {
        year: { $isoWeekYear: '$createdAt' },
        week: { $isoWeek: '$createdAt' },
      },
      month: {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
      },
    };

    return this.botConversationModel.aggregate([
      ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
      { $group: { _id: dateFormat[granularity], count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
  }

  async getIntentAnalytics(dateFrom?: string, dateTo?: string) {
    const match: Record<string, any> = {
      eventType: { $in: ['intent_matched', 'intent_missed', 'fallback'] },
    };
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
      if (dateTo) match.createdAt.$lte = new Date(dateTo);
    }

    return this.botAnalyticsEventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { eventType: '$eventType', intentId: '$intentId' },
          count: { $sum: 1 },
          avgConfidence: { $avg: '$data.confidence' },
        },
      },
      { $sort: { count: -1 } },
    ]);
  }

  async getFlowAnalytics(dateFrom?: string, dateTo?: string) {
    const match: Record<string, any> = {
      eventType: { $in: ['flow_completed', 'flow_abandoned', 'flow_response'] },
    };
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
      if (dateTo) match.createdAt.$lte = new Date(dateTo);
    }

    return this.botAnalyticsEventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { eventType: '$eventType', flowId: '$flowId' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);
  }

  async getSatisfaction(dateFrom?: string, dateTo?: string) {
    const match: Record<string, any> = {
      satisfaction: { $ne: null },
    };
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
      if (dateTo) match.createdAt.$lte = new Date(dateTo);
    }

    return this.botConversationModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$satisfaction',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  async getResponseAnalytics(dateFrom?: string, dateTo?: string) {
    const match: Record<string, any> = {
      sender: 'bot',
      responseTemplateId: { $ne: null },
    };
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
      if (dateTo) match.createdAt.$lte = new Date(dateTo);
    }

    return this.botMessageModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$responseTemplateId',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);
  }

  async getEscalationAnalytics(dateFrom?: string, dateTo?: string) {
    const match: Record<string, any> = {
      eventType: 'escalation',
    };
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
      if (dateTo) match.createdAt.$lte = new Date(dateTo);
    }

    return this.botAnalyticsEventModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            channel: '$channel',
            reason: '$data.ruleId',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);
  }

  async getResolution(dateFrom?: string, dateTo?: string) {
    const match: Record<string, any> = {};
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
      if (dateTo) match.createdAt.$lte = new Date(dateTo);
    }

    const [total, resolved] = await Promise.all([
      this.botConversationModel.countDocuments(match),
      this.botConversationModel.countDocuments({
        ...match,
        status: 'resolved',
      }),
    ]);

    return {
      total,
      resolved,
      rate: total > 0 ? resolved / total : 0,
    };
  }

  async getResponseTime(dateFrom?: string, dateTo?: string) {
    const match: Record<string, any> = {};
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
      if (dateTo) match.createdAt.$lte = new Date(dateTo);
    }

    // Get pairs of consecutive user + bot messages, compute time difference
    const result = await this.botMessageModel.aggregate([
      ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
      { $sort: { conversationId: 1, createdAt: 1 } },
      {
        $group: {
          _id: '$conversationId',
          messages: {
            $push: {
              sender: '$sender',
              createdAt: '$createdAt',
            },
          },
        },
      },
      {
        $project: {
          responseTimes: {
            $reduce: {
              input: { $range: [1, { $size: '$messages' }] },
              initialValue: [],
              in: {
                $cond: {
                  if: {
                    $and: [
                      {
                        $eq: [
                          {
                            $arrayElemAt: [
                              '$messages.sender',
                              { $subtract: ['$$this', 1] },
                            ],
                          },
                          'user',
                        ],
                      },
                      {
                        $eq: [
                          { $arrayElemAt: ['$messages.sender', '$$this'] },
                          'bot',
                        ],
                      },
                    ],
                  },
                  then: {
                    $concatArrays: [
                      '$$value',
                      [
                        {
                          $subtract: [
                            {
                              $arrayElemAt: [
                                '$messages.createdAt',
                                '$$this',
                              ],
                            },
                            {
                              $arrayElemAt: [
                                '$messages.createdAt',
                                { $subtract: ['$$this', 1] },
                              ],
                            },
                          ],
                        },
                      ],
                    ],
                  },
                  else: '$$value',
                },
              },
            },
          },
        },
      },
      { $unwind: '$responseTimes' },
      {
        $group: {
          _id: null,
          avgResponseTimeMs: { $avg: '$responseTimes' },
          minResponseTimeMs: { $min: '$responseTimes' },
          maxResponseTimeMs: { $max: '$responseTimes' },
          count: { $sum: 1 },
        },
      },
    ]);

    return result[0] ?? {
      avgResponseTimeMs: 0,
      minResponseTimeMs: 0,
      maxResponseTimeMs: 0,
      count: 0,
    };
  }

  async exportData(type: string, dateFrom?: string, dateTo?: string) {
    const dateFilter: Record<string, any> = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) dateFilter.createdAt.$lte = new Date(dateTo);
    }

    switch (type) {
      case 'conversations':
        return this.botConversationModel.find(dateFilter).lean();
      case 'messages':
        return this.botMessageModel.find(dateFilter).lean();
      case 'events':
        return this.botAnalyticsEventModel.find(dateFilter).lean();
      default:
        return { error: `Unknown export type: ${type}` };
    }
  }
}
