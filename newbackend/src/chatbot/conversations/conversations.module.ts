import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
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
      { name: BotConversation.name, schema: BotConversationSchema },
      { name: BotMessage.name, schema: BotMessageSchema },
    ]),
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
