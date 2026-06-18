import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyNotificationDocument = FantasyNotification & Document;

/**
 * In-app fantasy notifications (bell drawer).
 * Mirrored to push/email by a separate worker when the user opts in.
 */
@Schema({ timestamps: true, collection: 'fantasy_notifications' })
export class FantasyNotification {
  /** null => broadcast to all users */
  @Prop({ index: true })
  userId: number;

  @Prop({ required: true })
  type: string;  // playing11 | deadline | winnings | streak | promo | private_invite | system

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop()
  matchId: number;

  @Prop()
  contestId: string;

  @Prop()
  link: string;

  @Prop({ default: false, index: true })
  isRead: boolean;

  @Prop({ type: Date })
  readAt: Date;
}

export const FantasyNotificationSchema = SchemaFactory.createForClass(FantasyNotification);
FantasyNotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
