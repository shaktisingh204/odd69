import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AviatorBetDocument = AviatorBet & Document;
export type AviatorBetStatus = 'ACTIVE' | 'CASHEDOUT' | 'LOST';

@Schema({ collection: 'aviator_bets', timestamps: true })
export class AviatorBet {
  @Prop({ required: true }) roundId: number;
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ default: false }) usedBonus: boolean;
  @Prop({ default: 0 }) bonusAmount: number;
  @Prop({ default: 'ACTIVE' }) status: AviatorBetStatus;
  @Prop({ default: 0 }) cashedOutMultiplier: number;
  @Prop({ default: 0 }) payout: number;
  @Prop({ default: 0 }) autoCashoutAt: number;  // 0 = manual
  @Prop({ default: 'fiat' }) walletType: string;
  @Prop({ default: 'INR' }) currency: string;
}

export const AviatorBetSchema = SchemaFactory.createForClass(AviatorBet);
AviatorBetSchema.index({ roundId: 1, userId: 1 });
AviatorBetSchema.index({ userId: 1, status: 1 });
