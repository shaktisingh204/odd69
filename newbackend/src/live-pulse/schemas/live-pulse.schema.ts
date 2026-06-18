import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LivePulseDocument = LivePulse & Document;

@Schema({ timestamps: true })
export class LivePulse {
  @Prop({ required: true, unique: true, default: 'global' })
  key: string;

  @Prop({ default: 2847593 })
  jackpotAmount: number;

  @Prop({ type: [Object], default: [] })
  activities: {
    type: string;   // 'win' | 'bigwin' | 'bet' | 'cashout'
    user: string;
    amount: string;
    game: string;
    emoji: string;
    createdAt: Date;
  }[];

  @Prop({ default: 0 })
  onlineCount: number;
}

export const LivePulseSchema = SchemaFactory.createForClass(LivePulse);
