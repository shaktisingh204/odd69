import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type KenoGameDocument = KenoGame & Document;

@Schema({ collection: 'keno_games', timestamps: true })
export class KenoGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ required: true }) risk: string; // low | classic | medium | high
  @Prop({ type: [Number], required: true }) selected: number[]; // 1..40
  @Prop({ type: [Number], required: true }) drawn: number[]; // 10 nums
  @Prop({ required: true }) hits: number;
  @Prop({ required: true }) multiplier: number;
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

export const KenoGameSchema = SchemaFactory.createForClass(KenoGame);
KenoGameSchema.index({ userId: 1, createdAt: -1 });
KenoGameSchema.index({ createdAt: -1 });
