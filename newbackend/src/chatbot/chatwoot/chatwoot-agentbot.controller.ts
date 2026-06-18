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

@Controller('chatbot/chatwoot')
export class ChatwootAgentBotController {
  private readonly logger = new Logger(ChatwootAgentBotController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botEngine: BotEngineService,
  ) {}

  @Public()
  @Post('agent-bot')
  @HttpCode(200)
  async handleAgentBot(
    @Body() payload: any,
    @Headers('authorization') authorization: string,
  ) {
    // Validate agent bot token
    const config = await this.prisma.chatwootConfig.findFirst({
      where: { isEnabled: true },
    });

    if (!config) {
      return { error: 'Chatwoot not configured' };
    }

    if (config.agentBotToken) {
      const token = (authorization || '').replace('Bearer ', '');
      if (token !== config.agentBotToken) {
        throw new UnauthorizedException('Invalid agent bot token');
      }
    }

    const event = payload.event;
    this.logger.log(`Agent bot event: ${event}`);

    switch (event) {
      case 'message_created':
        return this.handleMessage(payload);
      case 'conversation_created':
        return this.handleConversationCreated(payload);
      case 'conversation_status_changed':
        return this.handleStatusChanged(payload);
      default:
        return { status: 'ignored' };
    }
  }

  private async handleMessage(payload: any) {
    const content = payload.content;
    const conversation = payload.conversation;
    const sender = payload.sender;

    // Only process incoming messages from contacts
    if (payload.message_type !== 'incoming') {
      return { status: 'ignored' };
    }

    if (!content || !conversation) {
      return { status: 'no_content' };
    }

    const userId = sender?.id || 0;
    const username =
      sender?.name || sender?.email || sender?.phone_number || `contact_${userId}`;
    const channel = conversation.inbox_id
      ? `inbox_${conversation.inbox_id}`
      : 'default';

    const result = await this.botEngine.processMessage(
      userId,
      username,
      content,
      channel,
    );

    if (!result) {
      return { status: 'no_response' };
    }

    // Return response in Chatwoot agent bot format
    // Chatwoot expects an array of messages or a single message
    const response: any[] = [
      {
        content: result.response,
        content_type: result.contentType === 'text' ? undefined : result.contentType,
      },
    ];

    // If escalated, add a handoff message
    if (result.escalated) {
      response.push({
        content: '',
        content_type: 'input_select',
        content_attributes: {
          items: [
            { title: 'Talk to agent', value: 'handoff' },
          ],
        },
      });
    }

    return response;
  }

  private async handleConversationCreated(payload: any) {
    const conversation = payload.conversation || payload;
    const sender = conversation?.meta?.sender || payload.sender;
    const channel = conversation?.inbox_id
      ? `inbox_${conversation.inbox_id}`
      : 'default';

    const userId = sender?.id || 0;
    const greeting = await this.botEngine.getGreeting(userId, channel);

    if (greeting) {
      return [{ content: greeting.response }];
    }

    return { status: 'no_greeting' };
  }

  private async handleStatusChanged(payload: any) {
    this.logger.debug(
      `Agent bot: conversation ${payload.conversation?.id} status -> ${payload.status}`,
    );
    return { status: 'ok' };
  }
}
