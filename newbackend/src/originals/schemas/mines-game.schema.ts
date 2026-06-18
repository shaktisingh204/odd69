import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MinesGameDocument = MinesGame & Document;

export type MinesGameStatus = 'ACTIVE' | 'CASHEDOUT' | 'LOST';

@Schema({ collection: 'mines_games', timestamps: true })
export class MinesGame {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) betAmount: number;
  @Prop({ required: true }) mineCount: number;
  @Prop({ type: [Number], required: true }) minePositions: number[];
  @Prop({ type: [Number], default: [] }) revealedTiles: number[];
  @Prop({ default: 'ACTIVE' }) status: MinesGameStatus;
  @Prop({ default: 0 }) payout: number;
  @Prop({ default: 1 }) multiplier: number;
  @Prop({ required: true }) serverSeed: string;
  @Prop() clientSeed: string;
  @Prop({ required: true }) serverSeedHash: string;
  @Prop({ default: 'fiat' }) walletType: string;
  @Prop({ default: false }) usedBonus: boolean;
  @Prop({ default: 0 }) bonusAmount: number;
  @Prop({ default: 'INR' }) currency: string;
  @Prop({ default: 0 }) biasWeight: number;
  @Prop({ type: Object }) engagementFlags: Record<string, any>;
}

export const MinesGameSchema = SchemaFactory.createForClass(MinesGame);

// Indexes for common queries
MinesGameSchema.index({ userId: 1, status: 1 });
MinesGameSchema.index({ createdAt: -1 });
