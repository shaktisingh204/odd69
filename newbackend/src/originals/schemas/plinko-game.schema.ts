import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlinkoGameDocument = PlinkoGame & Document;

@Schema({ collection: 'plinko_games', timestamps: true })
export class PlinkoGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ required: true }) rows: number;
  @Prop({ required: true }) risk: string;
  @Prop({ type: [Number], required: true }) path: number[];
  @Prop({ required: true }) slotIndex: number;
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

export const PlinkoGameSchema = SchemaFactory.createForClass(PlinkoGame);

PlinkoGameSchema.index({ userId: 1, createdAt: -1 });
PlinkoGameSchema.index({ createdAt: -1 });
