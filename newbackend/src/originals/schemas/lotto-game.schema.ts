import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LottoGameDocument = LottoGame & Document;

/**
 * Mini-lotto: player picks 6 numbers from 1..49, system draws 6.
 * Payout multipliers (vs stake):
 *   2 hits → 1x   (return stake)
 *   3 hits → 2x
 *   4 hits → 10x
 *   5 hits → 100x
 *   6 hits → 1000x
 */
@Schema({ collection: 'lotto_games', timestamps: true })
export class LottoGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ type: [Number], required: true }) selected: number[]; // 6 nums
  @Prop({ type: [Number], required: true }) drawn: number[]; // 6 nums
  @Prop({ required: true }) hits: number;
  @Prop({ required: true }) multiplier: number;
  @Prop({ default: 0 }) payout: number;
  @Prop({ required: true }) status: string;
  @Prop({ required: true }) serverSeed: string;
  @Prop() clientSeed: string;
  @Prop({ required: true }) serverSeedHash: string;
  @Prop({ default: 'fiat' }) walletType: string;
  @Prop({ default: false }) usedBonus: boolean;
  @Prop({ default: 0 }) bonusAmount: number;
  @Prop({ default: 'INR' }) currency: string;
}

export const LottoGameSchema = SchemaFactory.createForClass(LottoGame);
LottoGameSchema.index({ userId: 1, createdAt: -1 });
