import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true })
export class Session {
    @Prop({ required: true })
    event_id: string;

    @Prop({ required: true })
    market_id: string;

    @Prop()
    event_name: string;

    @Prop({ required: true })
    runner_name: string;

    @Prop()
    lay_price: number;

    @Prop()
    lay_size: number;

    @Prop()
    back_price: number;

    @Prop()
    back_size: number;

    @Prop()
    game_status: string;

    @Prop()
    game_type: string;

    @Prop()
    min: number;

    @Prop()
    max: number;

    @Prop()
    sr_no: number;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
// Composite unique index
SessionSchema.index({ event_id: 1, runner_name: 1 }, { unique: true });
