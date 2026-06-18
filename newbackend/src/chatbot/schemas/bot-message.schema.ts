import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class BotMessage {
  @Prop({ required: true })
  conversationId: string;

  @Prop({ required: true, enum: ['bot', 'user', 'admin'] })
  sender: string;

  @Prop({ required: true })
  content: string;

  @Prop({
    default: 'text',
    enum: ['text', 'buttons', 'card', 'carousel', 'quick_reply', 'system'],
  })
  contentType: string;

  @Prop({ type: Object })
  richMedia: Record<string, any>;

  @Prop()
  intentMatched: string;

  @Prop()
  intentConfidence: number;

  @Prop({ type: [Object] })
  entitiesExtracted: Record<string, any>[];

  @Prop()
  responseTemplateId: number;

  @Prop()
  flowNodeId: string;
}

export type BotMessageDocument = BotMessage & Document;
export const BotMessageSchema = SchemaFactory.createForClass(BotMessage);

BotMessageSchema.index({ conversationId: 1 });
BotMessageSchema.index({ createdAt: -1 });
