import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyActivityLogDocument = FantasyActivityLog & Document;

/**
 * Audit trail for every admin-triggered fantasy action (settle, refund, edit,
 * override, cancel, manual points, create-promocode, etc.).
 */
@Schema({ timestamps: true, collection: 'fantasy_activity_logs' })
export class FantasyActivityLog {
  @Prop({ required: true, index: true })
  action: string;  // settle | refund | cancel | edit-match | override-credit | manual-points | ...

  @Prop()
  adminUsername: string;

  @Prop()
  actorIp: string;

  /** Primary target id (match, contest, user, etc.) */
  @Prop()
  targetType: string;

  @Prop()
  targetId: string;

  @Prop({ type: Object, default: {} })
  payload: Record<string, any>;

  @Prop({ default: '' })
  note: string;
}

export const FantasyActivityLogSchema = SchemaFactory.createForClass(FantasyActivityLog);
FantasyActivityLogSchema.index({ createdAt: -1 });
