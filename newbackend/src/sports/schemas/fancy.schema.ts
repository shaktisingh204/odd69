import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FancyDocument = Fancy & Document;

@Schema({ timestamps: true })
export class Fancy {
    @Prop({ required: true })
    event_id: string;

    @Prop()
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
    srno: number;
}

export const FancySchema = SchemaFactory.createForClass(Fancy);
FancySchema.index({ event_id: 1, runner_name: 1 }, { unique: true });
