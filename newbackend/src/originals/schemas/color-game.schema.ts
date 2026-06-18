import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ColorGameDocument = ColorGame & Document;

/**
 * Wingo-style color game. Result number 0..9 maps to colors:
 *   0       → red + violet  (rare)
 *   1,3,7,9 → green
 *   5       → green + violet (rare)
 *   2,4,6,8 → red
 *
 * Bets:
 *   green  → 2x
 *   red    → 2x
 *   violet → 4.5x
 *   number 0..9 → 9x
 */
@Schema({ collection: 'color_games', timestamps: true })
export class ColorGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ required: true }) pick: string; // 'red' | 'green' | 'violet' | 'number'
  @Prop() pickNumber: number; // when pick === 'number'
  @Prop({ required: true }) result: number; // 0..9
  @Prop({ type: [String], required: true }) resultColors: string[];
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

export const ColorGameSchema = SchemaFactory.createForClass(ColorGame);
ColorGameSchema.index({ userId: 1, createdAt: -1 });
