import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type JackpotGameDocument = JackpotGame & Document;

@Schema({ collection: 'jackpot_games', timestamps: true })
export class JackpotGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ required: true }) tier: string; // 'BUST' | 'MINI' | 'SMALL' | 'BIG' | 'MEGA' | 'GRAND'
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

export const JackpotGameSchema = SchemaFactory.createForClass(JackpotGame);
JackpotGameSchema.index({ userId: 1, createdAt: -1 });
