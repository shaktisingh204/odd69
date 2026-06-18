import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MarketOddDocument = MarketOdd & Document;

@Schema({ timestamps: true })
export class MarketOdd {
    @Prop({ required: true, unique: true })
    market_id: string;

    @Prop({ required: true, index: true })
    event_id: string;

    @Prop()
    runner1: string;

    @Prop()
    runner2: string;

    @Prop()
    status: string; // "OPEN", "SUSPENDED", etc.

    @Prop()
    inplay: boolean;

    @Prop()
    back0_price: number;
    @Prop()
    back0_size: number;
    @Prop()
    lay0_price: number;
    @Prop()
    lay0_size: number;

    @Prop()
    back1_price: number;
    @Prop()
    back1_size: number;
    @Prop()
    lay1_price: number;
    @Prop()
    lay1_size: number;

    @Prop()
    back2_price: number;
    @Prop()
    back2_size: number;
    @Prop()
    lay2_price: number;
    @Prop()
    lay2_size: number;
}

export const MarketOddSchema = SchemaFactory.createForClass(MarketOdd);

