import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RouletteGameDocument = RouletteGame & Document;

/**
 * European single-zero wheel. Each `bets[]` entry is one chip.
 *   kind: 'number' | 'red' | 'black' | 'odd' | 'even' | 'high' | 'low'
 *       | 'dozen1' | 'dozen2' | 'dozen3' | 'col1' | 'col2' | 'col3'
 *   value: only used when kind === 'number' (0..36)
 */
@Schema({ collection: 'roulette_games', timestamps: true })
export class RouletteGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({
    type: [
      {
        kind: String,
        value: Number,
        amount: Number,
      },
    ],
    default: [],
  })
  bets: { kind: string; value?: number; amount: number }[];
  @Prop({ required: true }) result: number; // 0..36
  @Prop({ default: 0 }) payout: number;
  @Prop({ required: true }) status: string; // 'WON' | 'LOST'
  @Prop({ required: true }) serverSeed: string;
  @Prop() clientSeed: string;
  @Prop({ required: true }) serverSeedHash: string;
  @Prop({ default: 'fiat' }) walletType: string;
  @Prop({ default: false }) usedBonus: boolean;
  @Prop({ default: 0 }) bonusAmount: number;
  @Prop({ default: 'INR' }) currency: string;
}

export const RouletteGameSchema = SchemaFactory.createForClass(RouletteGame);
RouletteGameSchema.index({ userId: 1, createdAt: -1 });
