import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LimboBetDocument = LimboBet & Document;
export type LimboBetStatus = 'ACTIVE' | 'CASHEDOUT' | 'LOST';

@Schema({ collection: 'limbo_bets', timestamps: true })
export class LimboBet {
  @Prop({ required: true }) roundId: number;
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ default: false }) usedBonus: boolean;
  @Prop({ default: 0 }) bonusAmount: number;
  @Prop({ default: 'ACTIVE' }) status: LimboBetStatus;
  @Prop({ default: 0 }) cashedOutMultiplier: number;
  @Prop({ default: 0 }) payout: number;
  @Prop({ default: 0 }) autoCashoutAt: number;  // 0 = manual
  @Prop({ default: 'fiat' }) walletType: string;
  @Prop({ default: 'INR' }) currency: string;
}

export const LimboBetSchema = SchemaFactory.createForClass(LimboBet);
LimboBetSchema.index({ roundId: 1, userId: 1 });
LimboBetSchema.index({ userId: 1, status: 1 });
