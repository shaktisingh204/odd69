import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EscalationController } from './escalation.controller';
import { EscalationService } from './escalation.service';
import { PrismaService } from '../../prisma.service';
import {
  BotConversation,
  BotConversationSchema,
} from '../schemas/bot-conversation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BotConversation.name, schema: BotConversationSchema },
    ]),
  ],
  controllers: [EscalationController],
  providers: [EscalationService, PrismaService],
  exports: [EscalationService],
})
export class EscalationModule {}
