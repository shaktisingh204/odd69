import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyPowerupDocument = FantasyPowerup & Document;

/**
 * Per-user inventory of consumable boost items.
 * type examples:
 *  - triple_captain (C becomes 3x for a match)
 *  - super_vc (VC becomes 2x)
 *  - double_points_1p (double points for one picked player)
 *  - free_entry (waives one entry fee)
 *  - rollback (undo a single team edit after lock)
 */
@Schema({ timestamps: true, collection: 'fantasy_powerups' })
export class FantasyPowerup {
  @Prop({ required: true, index: true })
  userId: number;

  @Prop({ required: true })
  type: string;

  @Prop({ default: 1 })
  count: number;

  @Prop({ default: '' })
  source: string;  // streak | promo | admin | purchase | signup

  @Prop({ type: Date })
  expiresAt: Date;
}

export const FantasyPowerupSchema = SchemaFactory.createForClass(FantasyPowerup);
FantasyPowerupSchema.index({ userId: 1, type: 1 });
