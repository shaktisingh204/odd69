import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventDocument = Event & Document;

@Schema({ timestamps: true })
export class Event {
    @Prop({ required: true, unique: true })
    event_id: string;

    @Prop({ required: true })
    event_name: string;

    @Prop({ required: true, index: true })
    competition_id: string;

    @Prop({ required: true })
    open_date: string;

    @Prop()
    timezone: string;

    @Prop()
    match_status: string; // "In Play", "Coming Soon", etc.

    @Prop()
    home_team: string;

    @Prop()
    away_team: string;

    @Prop()
    score1: string;

    @Prop()
    score2: string;

    @Prop()
    match_info: string;

    @Prop({ default: true })
    isVisible: boolean;

    @Prop({ default: false })
    tv: boolean;

    @Prop({ default: false })
    bm: boolean;

    @Prop({ default: false })
    f: boolean;

    @Prop({ default: false })
    f1: boolean;

    @Prop({ default: 0 })
    iscc: number;

    @Prop({ type: Object })
    sr_markets?: any;
}

export const EventSchema = SchemaFactory.createForClass(Event);

EventSchema.index({ open_date: 1 });
EventSchema.index({ match_status: 1, competition_id: 1 });
EventSchema.index({ event_id: 1 });
