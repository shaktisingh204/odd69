import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrismaModule } from '../prisma.module';

// Mongoose schemas
import { BotConversation, BotConversationSchema } from './schemas/bot-conversation.schema';
import { BotMessage, BotMessageSchema } from './schemas/bot-message.schema';
import { BotAnalyticsEvent, BotAnalyticsEventSchema } from './schemas/bot-analytics-event.schema';
import { WorkflowExecutionLog, WorkflowExecutionLogSchema } from './schemas/workflow-execution-log.schema';

// Engine services
import { BotEngineService } from './engine/bot-engine.service';
import { IntentMatcherService } from './engine/intent-matcher.service';
import { FlowExecutorService } from './engine/flow-executor.service';
import { TemplateRendererService } from './engine/template-renderer.service';

// Gateway
import { ChatbotGateway } from './chatbot.gateway';

// Sub-module controllers
import { ProfilesController } from './profiles/profiles.controller';
import { ChannelsController } from './channels/channels.controller';
import { KnowledgeBaseController } from './knowledge-base/knowledge-base.controller';
import { IntentsController } from './intents/intents.controller';
import { EntitiesController } from './entities/entities.controller';
import { ResponsesController } from './responses/responses.controller';
import { AutoReplyController } from './auto-reply/auto-reply.controller';
import { QuickRepliesController } from './quick-replies/quick-replies.controller';
import { FlowsController } from './flows/flows.controller';
import { SegmentsController } from './segments/segments.controller';
import { ConversationsController } from './conversations/conversations.controller';
import { EscalationController } from './escalation/escalation.controller';
import { GreetingsController } from './greetings/greetings.controller';
import { WorkflowsController } from './workflows/workflows.controller';
import { AnalyticsController } from './analytics/analytics.controller';
import { TestingController } from './testing/testing.controller';
import { AbTestsController } from './ab-tests/ab-tests.controller';
import { ChatbotUserController } from './user/user.controller';

// Sub-module services
import { ProfilesService } from './profiles/profiles.service';
import { ChannelsService } from './channels/channels.service';
import { KnowledgeBaseService } from './knowledge-base/knowledge-base.service';
import { IntentsService } from './intents/intents.service';
import { EntitiesService } from './entities/entities.service';
import { ResponsesService } from './responses/responses.service';
import { AutoReplyService } from './auto-reply/auto-reply.service';
import { QuickRepliesService } from './quick-replies/quick-replies.service';
import { FlowsService } from './flows/flows.service';
import { SegmentsService } from './segments/segments.service';
import { ConversationsService } from './conversations/conversations.service';
import { EscalationService } from './escalation/escalation.service';
import { GreetingsService } from './greetings/greetings.service';
import { WorkflowsService } from './workflows/workflows.service';
import { AnalyticsService } from './analytics/analytics.service';
import { TestingService } from './testing/testing.service';
import { AbTestsService } from './ab-tests/ab-tests.service';

// Chatwoot integration
import { ChatwootService } from './chatwoot/chatwoot.service';
import { ChatwootWebhookController } from './chatwoot/chatwoot-webhook.controller';
import { ChatwootAgentBotController } from './chatwoot/chatwoot-agentbot.controller';
import { ChatwootConfigController } from './chatwoot/chatwoot-config.controller';
import { ChatwootSyncService } from './chatwoot/chatwoot-sync.service';

@Module({
  imports: [
    PrismaModule,
    MongooseModule.forFeature([
      { name: BotConversation.name, schema: BotConversationSchema },
      { name: BotMessage.name, schema: BotMessageSchema },
      { name: BotAnalyticsEvent.name, schema: BotAnalyticsEventSchema },
      { name: WorkflowExecutionLog.name, schema: WorkflowExecutionLogSchema },
    ]),
  ],
  controllers: [
    ProfilesController,
    ChannelsController,
    KnowledgeBaseController,
    IntentsController,
    EntitiesController,
    ResponsesController,
    AutoReplyController,
    QuickRepliesController,
    FlowsController,
    SegmentsController,
    ConversationsController,
    EscalationController,
    GreetingsController,
    WorkflowsController,
    AnalyticsController,
    TestingController,
    AbTestsController,
    ChatbotUserController,
    // Chatwoot
    ChatwootWebhookController,
    ChatwootAgentBotController,
    ChatwootConfigController,
  ],
  providers: [
    // Engine
    BotEngineService,
    IntentMatcherService,
    FlowExecutorService,
    TemplateRendererService,
    // Gateway
    ChatbotGateway,
    // Sub-module services
    ProfilesService,
    ChannelsService,
    KnowledgeBaseService,
    IntentsService,
    EntitiesService,
    ResponsesService,
    AutoReplyService,
    QuickRepliesService,
    FlowsService,
    SegmentsService,
    ConversationsService,
    EscalationService,
    GreetingsService,
    WorkflowsService,
    AnalyticsService,
    TestingService,
    AbTestsService,
    // Chatwoot
    ChatwootService,
    ChatwootSyncService,
  ],
  exports: [BotEngineService, ChatbotGateway, ChatwootService, ChatwootSyncService],
})
export class ChatbotModule {}
