import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { PrismaService } from '../../prisma.service';
import { BotEngineService } from '../engine/bot-engine.service';
import { ChatwootService } from './chatwoot.service';
import { ChatwootSyncService } from './chatwoot-sync.service';
import * as crypto from 'crypto';

@Controller('chatbot/chatwoot')
export class ChatwootWebhookController {
  private readonly logger = new Logger(ChatwootWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botEngine: BotEngineService,
    private readonly chatwootService: ChatwootService,
    private readonly syncService: ChatwootSyncService,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-chatwoot-signature') signature: string,
  ) {
    // Validate webhook signature
    const config = await this.prisma.chatwootConfig.findFirst({
      where: { isEnabled: true },
    });

    if (!config) {
      this.logger.warn('Webhook received but Chatwoot not configured');
      return { status: 'ignored' };
    }

    if (config.webhookSecret && signature) {
      const expected = crypto
        .createHmac('sha256', config.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');
      if (signature !== expected) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const event = payload.event;
    this.logger.log(`Chatwoot webhook: ${event}`);

    try {
      switch (event) {
        case 'message_created':
          await this.handleMessageCreated(payload);
          break;
        case 'conversation_created':
          await this.handleConversationCreated(payload);
          break;
        case 'conversation_status_changed':
          await this.handleConversationStatusChanged(payload);
          break;
        case 'conversation_updated':
          await this.handleConversationUpdated(payload);
          break;
        case 'contact_created':
          await this.handleContactCreated(payload);
          break;
        case 'contact_updated':
          await this.handleContactUpdated(payload);
          break;
        case 'webwidget_triggered':
          await this.handleWebwidgetTriggered(payload);
          break;
        default:
          this.logger.debug(`Unhandled event: ${event}`);
      }
    } catch (error: any) {
      this.logger.error(`Error handling ${event}: ${error.message}`, error.stack);
    }

    return { status: 'ok' };
  }

  private async handleMessageCreated(payload: any) {
    const message = payload.content;
    const conversation = payload.conversation;
    const sender = payload.sender;

    // Only process incoming messages from contacts (not agent/bot messages)
    if (payload.message_type !== 'incoming') return;
    if (!message || !conversation) return;

    const conversationId = conversation.id;
    const userId = sender?.id || 0;
    const username =
      sender?.name || sender?.email || sender?.phone_number || `contact_${userId}`;
    const channel = conversation.inbox_id
      ? `inbox_${conversation.inbox_id}`
      : 'default';

    // Process through bot engine
    const result = await this.botEngine.processMessage(
      userId,
      username,
      message,
      channel,
    );

    if (!result) return;

    // Send bot response back to Chatwoot
    const contentAttributes = result.richMedia
      ? this.formatChatwootContentAttributes(result.richMedia)
      : undefined;

    await this.chatwootService.sendMessage(
      conversationId,
      result.response,
      result.contentType === 'text' ? undefined : result.contentType,
      contentAttributes,
    );

    // If escalated, add a private note and toggle to open
    if (result.escalated) {
      await this.chatwootService.sendPrivateNote(
        conversationId,
        '🤖 Bot escalated this conversation — customer needs human assistance.',
      );
      await this.chatwootService.toggleStatus(conversationId, 'open');
    }
  }

  private async handleConversationCreated(payload: any) {
    const conversation = payload;
    const sender = conversation?.meta?.sender;
    const channel = conversation?.inbox_id
      ? `inbox_${conversation.inbox_id}`
      : 'default';

    // Send greeting
    const userId = sender?.id || 0;
    const greeting = await this.botEngine.getGreeting(userId, channel);

    if (greeting && conversation?.id) {
      await this.chatwootService.sendMessage(
        conversation.id,
        greeting.response,
      );
    }
  }

  private async handleConversationStatusChanged(payload: any) {
    this.logger.debug(
      `Conversation ${payload.id} status -> ${payload.status}`,
    );
  }

  private async handleConversationUpdated(payload: any) {
    this.logger.debug(`Conversation ${payload.id} updated`);
  }

  private async handleContactCreated(payload: any) {
    if (!payload.email && !payload.phone_number) return;
    await this.syncService.syncChatwootContactToUser(payload);
  }

  private async handleContactUpdated(payload: any) {
    if (!payload.email && !payload.phone_number) return;
    await this.syncService.syncChatwootContactToUser(payload);
  }

  private async handleWebwidgetTriggered(payload: any) {
    const conversation = payload.conversation;
    if (!conversation?.id) return;

    const greeting = await this.botEngine.getGreeting(0, 'webwidget');
    if (greeting) {
      await this.chatwootService.sendMessage(
        conversation.id,
        greeting.response,
      );
    }
  }

  private formatChatwootContentAttributes(richMedia: any): any {
    // Convert our rich media format to Chatwoot's content_attributes
    if (richMedia?.buttons) {
      return {
        items: richMedia.buttons.map((btn: any) => ({
          title: btn.label || btn.title,
          type: btn.type || 'postback',
          value: btn.value || btn.url || btn.label,
        })),
      };
    }
    return richMedia;
  }
}
