import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OriginalsEngagementEventDocument = OriginalsEngagementEvent & Document;

export type EngagementEventType = 'NEAR_MISS' | 'WIN_STREAK' | 'LOSS_STREAK' | 'BIG_WIN' | 'COMEBACK';

@Schema({ collection: 'originals_engagement_events', timestamps: true })
export class OriginalsEngagementEvent {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) gameKey: string;
  @Prop() gameId: string;  // MongoDB ObjectId as string
  @Prop({ required: true }) eventType: EngagementEventType;
  @Prop({ type: Object }) metadata: Record<string, any>;
  @Prop({ default: Date.now }) createdAt: Date;
}

export const OriginalsEngagementEventSchema = SchemaFactory.createForClass(OriginalsEngagementEvent);
OriginalsEngagementEventSchema.index({ userId: 1, gameKey: 1, createdAt: -1 });
OriginalsEngagementEventSchema.index({ gameKey: 1, eventType: 1 });
