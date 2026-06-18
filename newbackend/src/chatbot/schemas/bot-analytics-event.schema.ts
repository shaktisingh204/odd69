import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class BotAnalyticsEvent {
  @Prop({ required: true })
  eventType: string;

  @Prop()
  botId: number;

  @Prop()
  channel: string;

  @Prop()
  userId: number;

  @Prop()
  conversationId: string;

  @Prop()
  intentId: number;

  @Prop()
  flowId: number;

  @Prop({ type: Object })
  data: Record<string, any>;
}

export type BotAnalyticsEventDocument = BotAnalyticsEvent & Document;
export const BotAnalyticsEventSchema =
  SchemaFactory.createForClass(BotAnalyticsEvent);

BotAnalyticsEventSchema.index({ eventType: 1 });
BotAnalyticsEventSchema.index({ createdAt: -1 });
BotAnalyticsEventSchema.index({ botId: 1 });
BotAnalyticsEventSchema.index({ eventType: 1, createdAt: -1 });
