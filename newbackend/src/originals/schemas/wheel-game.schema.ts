import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WheelGameDocument = WheelGame & Document;

@Schema({ collection: 'wheel_games', timestamps: true })
export class WheelGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ required: true }) risk: string; // 'low' | 'medium' | 'high'
  @Prop({ required: true }) segments: number; // 10 | 20 | 30 | 40 | 50
  @Prop({ required: true }) slot: number; // landed slot index
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

export const WheelGameSchema = SchemaFactory.createForClass(WheelGame);
WheelGameSchema.index({ userId: 1, createdAt: -1 });
