import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AviatorRoundDocument = AviatorRound & Document;
export type AviatorRoundStatus = 'BETTING' | 'FLYING' | 'CRASHED';

@Schema({ collection: 'aviator_rounds', timestamps: true })
export class AviatorRound {
  @Prop({ required: true, unique: true }) roundId: number;
  @Prop({ required: true }) serverSeed: string;
  @Prop({ required: true }) serverSeedHash: string;
  @Prop({ required: true }) crashPoint: number;   // e.g. 2.47 — hidden until crash
  @Prop({ default: 'BETTING' }) status: AviatorRoundStatus;
  @Prop() startedAt: Date;       // when flying began
  @Prop() crashedAt: Date;       // when it crashed
  @Prop({ default: 1.0 }) currentMultiplier: number;
  @Prop({ default: 0 }) totalWagered: number;
  @Prop({ default: 0 }) totalPaidOut: number;
}

export const AviatorRoundSchema = SchemaFactory.createForClass(AviatorRound);
AviatorRoundSchema.index({ roundId: -1 });
AviatorRoundSchema.index({ status: 1 });
