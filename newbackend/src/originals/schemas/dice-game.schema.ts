import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DiceGameDocument = DiceGame & Document;

@Schema({ collection: 'dice_games', timestamps: true })
export class DiceGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ required: true }) target: number;       // 1–98
  @Prop({ required: true }) direction: string;     // "over" | "under"
  @Prop({ required: true }) roll: number;          // 0.00–99.99
  @Prop({ required: true }) multiplier: number;
  @Prop({ default: 0 })     payout: number;
  @Prop({ required: true }) status: string;        // "WON" | "LOST"
  @Prop({ required: true }) winChance: number;     // percentage
  @Prop({ required: true }) serverSeed: string;
  @Prop()                   clientSeed: string;
  @Prop({ required: true }) serverSeedHash: string;
  @Prop({ default: 'fiat' }) walletType: string;
  @Prop({ default: false }) usedBonus: boolean;
  @Prop({ default: 0 })     bonusAmount: number;
  @Prop({ default: 'INR' }) currency: string;
}

export const DiceGameSchema = SchemaFactory.createForClass(DiceGame);

DiceGameSchema.index({ userId: 1, createdAt: -1 });
DiceGameSchema.index({ createdAt: -1 });
