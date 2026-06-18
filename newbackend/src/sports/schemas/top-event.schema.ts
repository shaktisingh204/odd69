import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TopEventDocument = TopEvent & Document;

@Schema({ timestamps: true })
export class TopEvent {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    sportId: number;

    @Prop({ required: true, unique: true })
    event_id: string;

    @Prop({ required: true })
    lid: string;
}

export const TopEventSchema = SchemaFactory.createForClass(TopEvent);
