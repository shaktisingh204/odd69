import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class BotConversation {
  @Prop({ required: true, unique: true })
  sessionId: string;

  @Prop({ required: true })
  userId: number;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  channel: string;

  @Prop()
  botId: number;

  @Prop({
    default: 'active',
    enum: ['active', 'escalated', 'resolved', 'closed'],
  })
  status: string;

  @Prop()
  escalatedTo: number;

  @Prop()
  escalatedAt: Date;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  satisfaction: number;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop()
  currentFlowId: number;

  @Prop()
  currentNodeId: string;

  @Prop({ type: Object })
  flowVariables: Record<string, any>;
}

export type BotConversationDocument = BotConversation & Document;
export const BotConversationSchema =
  SchemaFactory.createForClass(BotConversation);

BotConversationSchema.index({ userId: 1 });
BotConversationSchema.index({ status: 1 });
BotConversationSchema.index({ createdAt: -1 });
