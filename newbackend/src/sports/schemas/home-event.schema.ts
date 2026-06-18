import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HomeEventDocument = HomeEvent & Document;

@Schema({ timestamps: true })
export class HomeEvent {
    @Prop({ required: true, unique: true })
    event_id: string;

    @Prop()
    event_name: string;
}

export const HomeEventSchema = SchemaFactory.createForClass(HomeEvent);
