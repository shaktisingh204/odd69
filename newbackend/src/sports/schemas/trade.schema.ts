import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type TradeDocument = Trade & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Trade {
    @Prop({ required: true })
    market_id: string;

    @Prop({ required: true })
    selection_id: string;

    @Prop({ required: true })
    price: number;

    @Prop({ required: true })
    stake: number;

    @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Order' })
    maker_order_id: string;

    @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Order' })
    taker_order_id: string;
}

export const TradeSchema = SchemaFactory.createForClass(Trade);
TradeSchema.index({ market_id: 1, selection_id: 1, createdAt: -1 });
