import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OriginalsSessionDocument = OriginalsSession & Document;

@Schema({ collection: 'originals_sessions', timestamps: true })
export class OriginalsSession {
  @Prop({ required: true }) userId: number;
  @Prop({ required: true }) gameKey: string;
  @Prop() socketId: string;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ default: Date.now }) connectedAt: Date;
  @Prop() disconnectedAt: Date;
}

export const OriginalsSessionSchema = SchemaFactory.createForClass(OriginalsSession);
OriginalsSessionSchema.index({ socketId: 1 });
OriginalsSessionSchema.index({ userId: 1, gameKey: 1, isActive: 1 });
