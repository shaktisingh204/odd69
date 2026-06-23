import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LimboGameDocument = LimboGame & Document;

/**
 * Instant single-shot Limbo bet.
 *
 * Uses the dedicated collection `limbo_games_instant` so it never clashes with
 * the legacy realtime crash-round model (`limbo_rounds` / `limbo_bets`), which
 * the integration step removes alongside the old LimboModule.
 */
@Schema({ collection: 'limbo_games_instant', timestamps: true })
export class LimboGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  /** Player-chosen target multiplier (1.01 .. 1,000,000). Payout multiplier on a win. */
  @Prop({ required: true }) target: number;
  /** Server-generated result/crash multiplier for this roll. */
  @Prop({ required: true }) result: number;
  /** Multiplier the player is paid on a win == target (mirrors other originals' `multiplier`). */
  @Prop({ required: true }) multiplier: number;
  @Prop({ default: 0 }) payout: number;
  @Prop({ required: true }) status: string; // 'WON' | 'LOST'
  @Prop({ required: true }) serverSeed: string;
  @Prop({ required: true }) serverSeedHash: string;
  @Prop() clientSeed: string;
  @Prop({ default: 0 }) nonce: number;
  @Prop({ default: 'fiat' }) walletType: string;
  @Prop({ default: false }) usedBonus: boolean;
  @Prop({ default: 0 }) bonusAmount: number;
  @Prop({ default: 'INR' }) currency: string;
}

export const LimboGameSchema = SchemaFactory.createForClass(LimboGame);
LimboGameSchema.index({ userId: 1, createdAt: -1 });
