import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestingController } from './testing.controller';
import { TestingService } from './testing.service';
import { PrismaService } from '../../prisma.service';
import { BotEngineService } from '../engine/bot-engine.service';
import { IntentMatcherService } from '../engine/intent-matcher.service';
import { FlowExecutorService } from '../engine/flow-executor.service';
import { TemplateRendererService } from '../engine/template-renderer.service';
import {
  BotConversation,
  BotConversationSchema,
} from '../schemas/bot-conversation.schema';
import {
  BotMessage,
  BotMessageSchema,
} from '../schemas/bot-message.schema';
import {
  BotAnalyticsEvent,
  BotAnalyticsEventSchema,
} from '../schemas/bot-analytics-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BotConversation.name, schema: BotConversationSchema },
      { name: BotMessage.name, schema: BotMessageSchema },
      { name: BotAnalyticsEvent.name, schema: BotAnalyticsEventSchema },
    ]),
  ],
  controllers: [TestingController],
  providers: [
    TestingService,
    PrismaService,
    BotEngineService,
    IntentMatcherService,
    FlowExecutorService,
    TemplateRendererService,
  ],
  exports: [TestingService],
})
export class TestingModule {}
