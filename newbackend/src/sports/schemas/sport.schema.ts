import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SportDocument = Sport & Document;

@Schema({ timestamps: true })
export class Sport {
    @Prop({ required: true, unique: true })
    sport_id: string;

    @Prop({ required: true })
    sport_name: string;

    @Prop({ default: 0 })
    market_count: number;

    @Prop({ default: true })
    isVisible: boolean;

    @Prop({ default: 100 })
    minBet: number;

    @Prop({ default: 100000 })
    maxBet: number;
}

export const SportSchema = SchemaFactory.createForClass(Sport);
