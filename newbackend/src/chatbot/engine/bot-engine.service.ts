import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma.service';
import {
  BotConversation,
  BotConversationDocument,
} from '../schemas/bot-conversation.schema';
import {
  BotMessage,
  BotMessageDocument,
} from '../schemas/bot-message.schema';
import {
  BotAnalyticsEvent,
  BotAnalyticsEventDocument,
} from '../schemas/bot-analytics-event.schema';
import { IntentMatcherService } from './intent-matcher.service';
import { FlowExecutorService } from './flow-executor.service';
import { TemplateRendererService } from './template-renderer.service';

@Injectable()
export class BotEngineService {
  private readonly logger = new Logger(BotEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(BotConversation.name)
    private readonly botConversationModel: Model<BotConversationDocument>,
    @InjectModel(BotMessage.name)
    private readonly botMessageModel: Model<BotMessageDocument>,
    @InjectModel(BotAnalyticsEvent.name)
    private readonly botAnalyticsEventModel: Model<BotAnalyticsEventDocument>,
    private readonly intentMatcher: IntentMatcherService,
    private readonly flowExecutor: FlowExecutorService,
    private readonly templateRenderer: TemplateRendererService,
  ) {}

  async processMessage(
    userId: number,
    username: string,
    message: string,
    channel: string,
  ): Promise<{
    response: string;
    contentType: string;
    richMedia?: any;
    escalated?: boolean;
  }> {
    // 1. Check blacklist
    const blacklisted = await this.prisma.chatbotUserBlacklist.findUnique({
      where: { userId },
    });

    if (blacklisted) {
      return {
        response:
          'You are currently restricted from using the chatbot. Please contact support.',
        contentType: 'text',
      };
    }

    // 2. Find or create conversation
    const sessionId = `${userId}_${channel}`;
    let conversation = await this.botConversationModel.findOne({
      sessionId,
      status: { $in: ['active', 'escalated'] },
    });

    if (!conversation) {
      conversation = await this.botConversationModel.create({
        sessionId,
        userId,
        username,
        channel,
        status: 'active',
        metadata: {},
      });
    }

    // 3. Save user message
    await this.botMessageModel.create({
      conversationId: conversation.sessionId,
      sender: 'user',
      content: message,
      contentType: 'text',
    });

    // 4. Check if conversation is escalated
    if (conversation.status === 'escalated') {
      return null;
    }

    // 5. Check active flow
    if (conversation.currentFlowId) {
      const flowResult = await this.flowExecutor.executeNode(
        conversation,
        message,
      );

      if (flowResult) {
        await this.saveBotMessage(
          conversation.sessionId,
          flowResult.response,
          flowResult.contentType,
          flowResult.richMedia,
        );

        await this.logAnalyticsEvent({
          eventType: 'flow_response',
          userId,
          channel,
          conversationId: conversation.sessionId,
          flowId: conversation.currentFlowId,
          data: { flowCompleted: flowResult.flowCompleted },
        });

        return {
          response: flowResult.response,
          contentType: flowResult.contentType,
          richMedia: flowResult.richMedia,
        };
      }
    }

    // 6. Evaluate auto-reply rules
    const autoReplyRules = await this.prisma.chatbotAutoReplyRule.findMany({
      where: { isEnabled: true },
      orderBy: { priority: 'asc' },
    });

    for (const rule of autoReplyRules) {
      if (this.matchAutoReplyRule(rule, message)) {
        const responseText = rule.responseText || 'Thank you for your message.';
        const rendered = await this.templateRenderer.render(
          responseText,
          userId,
        );

        await this.saveBotMessage(
          conversation.sessionId,
          rendered,
          'text',
        );

        await this.logAnalyticsEvent({
          eventType: 'auto_reply',
          userId,
          channel,
          conversationId: conversation.sessionId,
          data: { ruleId: rule.id },
        });

        return { response: rendered, contentType: 'text' };
      }
    }

    // 7. Match intent
    const intentResult = await this.intentMatcher.matchIntent(message);

    if (intentResult.intentId && intentResult.confidence >= 0.5) {
      // Get response template for the matched intent
      const responseTemplate =
        await this.prisma.chatbotResponseTemplate.findFirst({
          where: { intentId: intentResult.intentId, isEnabled: true },
        });

      if (responseTemplate) {
        // 10. Render template
        const rendered = await this.templateRenderer.render(
          responseTemplate.content,
          userId,
        );

        const contentType = responseTemplate.contentType ?? 'text';
        const richMedia = responseTemplate.richMedia as any;

        // 11. Save bot message
        await this.saveBotMessage(
          conversation.sessionId,
          rendered,
          contentType,
          richMedia,
          intentResult.intentName,
          intentResult.confidence,
          responseTemplate.id,
        );

        // 12. Log analytics
        await this.logAnalyticsEvent({
          eventType: 'intent_matched',
          userId,
          channel,
          conversationId: conversation.sessionId,
          intentId: intentResult.intentId,
          data: {
            confidence: intentResult.confidence,
            intentName: intentResult.intentName,
          },
        });

        // 13. Return response
        return { response: rendered, contentType, richMedia };
      }
    }

    // 9. Below threshold - check escalation rules
    const escalationRules = await this.prisma.chatbotEscalationRule.findMany({
      where: { isEnabled: true },
    });

    for (const rule of escalationRules) {
      if (this.shouldEscalate(rule, intentResult.confidence, message)) {
        await this.botConversationModel.updateOne(
          { _id: conversation._id },
          {
            $set: {
              status: 'escalated',
              escalatedAt: new Date(),
            },
          },
        );

        const escalationMessage =
          'Your conversation has been escalated to a live agent. Please wait for assistance.';

        await this.saveBotMessage(
          conversation.sessionId,
          escalationMessage,
          'system',
        );

        await this.logAnalyticsEvent({
          eventType: 'escalation',
          userId,
          channel,
          conversationId: conversation.sessionId,
          data: {
            ruleId: rule.id,
            confidence: intentResult.confidence,
          },
        });

        return {
          response: escalationMessage,
          contentType: 'system',
          escalated: true,
        };
      }
    }

    // Fallback response
    const fallbackResponse =
      "I'm sorry, I didn't understand that. Could you please rephrase?";
    const rendered = await this.templateRenderer.render(
      fallbackResponse,
      userId,
    );

    await this.saveBotMessage(conversation.sessionId, rendered, 'text');

    await this.logAnalyticsEvent({
      eventType: 'fallback',
      userId,
      channel,
      conversationId: conversation.sessionId,
      data: { confidence: intentResult.confidence },
    });

    return { response: rendered, contentType: 'text' };
  }

  async getGreeting(
    userId: number,
    channel: string,
  ): Promise<{
    response: string;
    contentType: string;
    richMedia?: any;
  }> {
    const greeting = await this.prisma.chatbotGreeting.findFirst({
      where: { channel, isEnabled: true },
      orderBy: { priority: 'asc' },
    });

    if (!greeting) {
      return {
        response: 'Hello! How can I help you today?',
        contentType: 'text',
      };
    }

    const rendered = await this.templateRenderer.render(
      greeting.content,
      userId,
    );

    return {
      response: rendered,
      contentType: 'text',
      richMedia: greeting.richMedia as any,
    };
  }

  async getActiveConversation(userId: number) {
    return this.botConversationModel.findOne({
      userId,
      status: { $in: ['active', 'escalated'] },
    }).sort({ createdAt: -1 });
  }

  async rateConversation(userId: number, satisfaction: number) {
    const conversation = await this.botConversationModel.findOneAndUpdate(
      { userId, status: { $in: ['active', 'escalated', 'resolved'] } },
      { $set: { satisfaction } },
      { sort: { createdAt: -1 }, returnDocument: 'after' },
    );
    return conversation;
  }

  private matchAutoReplyRule(rule: any, message: string): boolean {
    const messageLower = message.toLowerCase();
    const conditionValue = rule.conditionValue as any;

    switch (rule.conditionType) {
      case 'keyword': {
        const keyword = (conditionValue?.keyword ?? '').toLowerCase();
        return messageLower.includes(keyword);
      }
      case 'regex':
        try {
          return new RegExp(conditionValue?.pattern ?? '', 'i').test(message);
        } catch {
          return false;
        }
      case 'intent':
        return false; // handled by intent matcher
      default:
        return false;
    }
  }

  private shouldEscalate(
    rule: any,
    confidence: number,
    message: string,
  ): boolean {
    const config = rule.triggerConfig as any;
    switch (rule.triggerType) {
      case 'low_confidence':
        return confidence < (config?.threshold ?? 0.3);
      case 'keyword':
        return message
          .toLowerCase()
          .includes((config?.keyword ?? '').toLowerCase());
      case 'user_request':
        return message.toLowerCase().includes('agent') || message.toLowerCase().includes('human');
      default:
        return false;
    }
  }

  private async saveBotMessage(
    conversationId: string,
    content: string,
    contentType: string,
    richMedia?: any,
    intentMatched?: string,
    intentConfidence?: number,
    responseTemplateId?: number,
  ): Promise<void> {
    await this.botMessageModel.create({
      conversationId,
      sender: 'bot',
      content,
      contentType,
      richMedia,
      intentMatched,
      intentConfidence,
      responseTemplateId,
    });
  }

  private async logAnalyticsEvent(event: {
    eventType: string;
    userId: number;
    channel: string;
    conversationId: string;
    intentId?: number;
    flowId?: number;
    data?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.botAnalyticsEventModel.create(event);
    } catch (error) {
      this.logger.error('Failed to log analytics event', error);
    }
  }
}
