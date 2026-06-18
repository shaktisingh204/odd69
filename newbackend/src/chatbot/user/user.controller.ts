import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { BotEngineService } from '../engine/bot-engine.service';

@Controller('chatbot/user')
@UseGuards(JwtAuthGuard)
export class ChatbotUserController {
  constructor(private readonly botEngine: BotEngineService) {}

  @Post('message')
  async sendMessage(
    @Req() req,
    @Body() body: { message: string; channel?: string },
  ) {
    const { userId, username } = req.user;
    const channel = body.channel || 'support';
    const result = await this.botEngine.processMessage(
      userId,
      username || `user_${userId}`,
      body.message,
      channel,
    );
    return result;
  }

  @Get('conversation')
  async getConversation(@Req() req) {
    return this.botEngine.getActiveConversation(req.user.userId);
  }

  @Post('conversation/rate')
  async rateConversation(
    @Req() req,
    @Body() body: { satisfaction: number },
  ) {
    return this.botEngine.rateConversation(req.user.userId, body.satisfaction);
  }

  @Get('greeting')
  async getGreeting(@Req() req) {
    const channel = 'support';
    return this.botEngine.getGreeting(req.user.userId, channel);
  }
}
