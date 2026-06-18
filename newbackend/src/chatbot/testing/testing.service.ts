import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma.service';
import { BotEngineService } from '../engine/bot-engine.service';
import { IntentMatcherService } from '../engine/intent-matcher.service';
import { TemplateRendererService } from '../engine/template-renderer.service';
import {
  BotConversation,
  BotConversationDocument,
} from '../schemas/bot-conversation.schema';
import {
  BotMessage,
  BotMessageDocument,
} from '../schemas/bot-message.schema';

@Injectable()
export class TestingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly botEngine: BotEngineService,
    private readonly intentMatcher: IntentMatcherService,
    private readonly templateRenderer: TemplateRendererService,
    @InjectModel(BotConversation.name)
    private readonly botConversationModel: Model<BotConversationDocument>,
    @InjectModel(BotMessage.name)
    private readonly botMessageModel: Model<BotMessageDocument>,
  ) {}

  async simulate(message: string, sessionId?: string, userId?: number) {
    const testUserId = userId ?? 0;
    const testUsername = `test_user_${testUserId}`;
    const channel = 'test';

    // If sessionId provided, use it to maintain conversation context
    if (sessionId) {
      // Ensure a test conversation exists for this session
      const existing = await this.botConversationModel.findOne({
        sessionId,
      });

      if (!existing) {
        await this.botConversationModel.create({
          sessionId,
          userId: testUserId,
          username: testUsername,
          channel,
          status: 'active',
          metadata: { isTest: true },
        });
      }
    }

    const result = await this.botEngine.processMessage(
      testUserId,
      testUsername,
      message,
      channel,
    );

    return {
      ...result,
      sessionId: sessionId ?? `${testUserId}_${channel}`,
    };
  }

  async resetSimulation(sessionId: string) {
    // Delete conversation and all associated messages
    await Promise.all([
      this.botConversationModel.deleteMany({ sessionId }),
      this.botMessageModel.deleteMany({ conversationId: sessionId }),
    ]);

    return { success: true, sessionId };
  }

  async matchIntent(input: string) {
    const results = await this.intentMatcher.testMatch(input);
    return { input, matches: results };
  }

  async extractEntities(input: string) {
    const entities = await this.prisma.chatbotEntity.findMany();

    const results: Array<{
      entityId: number;
      entityName: string;
      matched: boolean;
      matchedValues: string[];
    }> = [];

    const inputLower = input.toLowerCase();

    for (const entity of entities) {
      const matchedValues: string[] = [];

      for (const value of (entity.values as any[]) || []) {
        const valueLower = String(value.value ?? value).toLowerCase();
        if (inputLower.includes(valueLower)) {
          matchedValues.push(String(value.value ?? value));
          continue;
        }

        // Check synonyms
        const synonyms = (value.synonyms as string[]) ?? [];
        for (const synonym of synonyms) {
          if (inputLower.includes(synonym.toLowerCase())) {
            matchedValues.push(String(value.value ?? value));
            break;
          }
        }
      }

      results.push({
        entityId: entity.id,
        entityName: entity.name,
        matched: matchedValues.length > 0,
        matchedValues,
      });
    }

    return { input, entities: results };
  }

  async evaluateRules(input: string) {
    const rules = await this.prisma.chatbotAutoReplyRule.findMany({
      where: { isEnabled: true },
      orderBy: { priority: 'asc' },
    });

    const results = rules.map((rule) => {
      const inputLower = input.toLowerCase();
      const conditionValue = rule.conditionValue;
      let matched = false;

      switch (rule.conditionType) {
        case 'keyword': {
          const keywords = Array.isArray(conditionValue)
            ? (conditionValue as string[])
            : [String(conditionValue ?? '')];
          matched = keywords.some((kw) =>
            inputLower.includes(String(kw).toLowerCase()),
          );
          break;
        }
        case 'regex':
          try {
            matched = new RegExp(String(conditionValue ?? ''), 'i').test(input);
          } catch {
            matched = false;
          }
          break;
        default:
          matched = false;
      }

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        conditionType: rule.conditionType,
        conditionValue: rule.conditionValue,
        matched,
        responseText: matched ? rule.responseText : null,
      };
    });

    return { input, rules: results };
  }

  async renderTemplate(templateId: number, data?: Record<string, any>) {
    const template = await this.prisma.chatbotResponseTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return { error: `Template #${templateId} not found` };
    }

    let rendered: string;
    if (data) {
      rendered = this.templateRenderer.renderWithData(template.content, data);
    } else {
      // Render with a dummy user ID 0 to resolve user placeholders
      rendered = await this.templateRenderer.render(template.content, 0);
    }

    return {
      templateId,
      templateName: template.name,
      original: template.content,
      rendered,
      contentType: template.contentType,
    };
  }
}
