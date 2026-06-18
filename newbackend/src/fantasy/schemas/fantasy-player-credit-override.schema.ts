import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyPlayerCreditOverrideDocument = FantasyPlayerCreditOverride & Document;

/**
 * Admin-specified override for a player's fantasy credit on a specific match.
 * Consulted at team-validation time; falls back to the credit baked into
 * match.squads[i].credit when no override exists.
 */
@Schema({ timestamps: true, collection: 'fantasy_player_credit_overrides' })
export class FantasyPlayerCreditOverride {
  @Prop({ required: true, index: true })
  matchId: number;

  @Prop({ required: true, index: true })
  playerId: number;

  @Prop({ required: true })
  newCredit: number;

  @Prop({ default: '' })
  reason: string;

  @Prop()
  adminUsername: string;
}

export const FantasyPlayerCreditOverrideSchema = SchemaFactory.createForClass(FantasyPlayerCreditOverride);
FantasyPlayerCreditOverrideSchema.index({ matchId: 1, playerId: 1 }, { unique: true });
