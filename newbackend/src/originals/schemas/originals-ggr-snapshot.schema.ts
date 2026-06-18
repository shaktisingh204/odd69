import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OriginalsGGRSnapshotDocument = OriginalsGGRSnapshot & Document;

@Schema({ collection: 'originals_ggr_snapshots', timestamps: true })
export class OriginalsGGRSnapshot {
  @Prop({ required: true }) gameKey: string;
  @Prop({ required: true }) windowStart: Date;
  @Prop({ required: true }) windowEnd: Date;
  @Prop({ default: 0 }) totalWagered: number;
  @Prop({ default: 0 }) totalPaidOut: number;
  @Prop({ default: 0 }) totalGames: number;
  @Prop({ default: 0 }) totalWins: number;
  @Prop({ default: 0 }) totalLosses: number;
  @Prop({ default: 0 }) ggrPercent: number;
  @Prop({ default: Date.now }) snapshotAt: Date;
}

export const OriginalsGGRSnapshotSchema = SchemaFactory.createForClass(OriginalsGGRSnapshot);
OriginalsGGRSnapshotSchema.index({ gameKey: 1, snapshotAt: -1 });
