import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma.service';
import {
  BotAnalyticsEvent,
  BotAnalyticsEventSchema,
} from '../schemas/bot-analytics-event.schema';
import {
  BotConversation,
  BotConversationSchema,
} from '../schemas/bot-conversation.schema';
import {
  BotMessage,
  BotMessageSchema,
} from '../schemas/bot-message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BotAnalyticsEvent.name, schema: BotAnalyticsEventSchema },
      { name: BotConversation.name, schema: BotConversationSchema },
      { name: BotMessage.name, schema: BotMessageSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PrismaService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
