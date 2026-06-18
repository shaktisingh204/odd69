import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrderDocument = Order & Document;

export enum OrderType {
    BACK = 'BACK',
    LAY = 'LAY',
}

export enum OrderStatus {
    OPEN = 'OPEN',
    PARTIAL = 'PARTIAL',
    MATCHED = 'MATCHED',
    CANCELLED = 'CANCELLED',
}

@Schema({ timestamps: true })
export class Order {
    @Prop({ required: true, index: true })
    market_id: string;

    @Prop({ required: true, index: true })
    selection_id: string;

    @Prop({ required: true })
    user_id: number;

    @Prop({ required: true, enum: OrderType })
    type: OrderType;

    @Prop({ required: true })
    price: number;

    @Prop({ required: true })
    stake: number;

    @Prop({ required: true })
    remaining_stake: number;

    @Prop({ required: true, enum: OrderStatus, default: OrderStatus.OPEN })
    status: OrderStatus;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ market_id: 1, selection_id: 1, type: 1, price: 1, createdAt: 1 });
