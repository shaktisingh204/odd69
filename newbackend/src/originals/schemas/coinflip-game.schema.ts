import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CoinflipGameDocument = CoinflipGame & Document;

@Schema({ collection: 'coinflip_games', timestamps: true })
export class CoinflipGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ required: true }) pick: string; // 'heads' | 'tails'
  @Prop({ required: true }) result: string;
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

export const CoinflipGameSchema = SchemaFactory.createForClass(CoinflipGame);
CoinflipGameSchema.index({ userId: 1, createdAt: -1 });
