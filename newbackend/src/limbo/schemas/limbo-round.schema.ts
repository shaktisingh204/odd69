import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LimboRoundDocument = LimboRound & Document;
export type LimboRoundStatus = 'BETTING' | 'FLYING' | 'CRASHED';

@Schema({ collection: 'limbo_rounds', timestamps: true })
export class LimboRound {
  @Prop({ required: true, unique: true }) roundId: number;
  @Prop({ required: true }) serverSeed: string;
  @Prop({ required: true }) serverSeedHash: string;
  @Prop({ required: true }) crashPoint: number;
  @Prop({ default: 'BETTING' }) status: LimboRoundStatus;
  @Prop() startedAt: Date;
  @Prop() crashedAt: Date;
  @Prop({ default: 1.0 }) currentMultiplier: number;
  @Prop({ default: 0 }) totalWagered: number;
  @Prop({ default: 0 }) totalPaidOut: number;
}

export const LimboRoundSchema = SchemaFactory.createForClass(LimboRound);
LimboRoundSchema.index({ roundId: -1 });
LimboRoundSchema.index({ status: 1 });
