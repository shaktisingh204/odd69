import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserTrafficEventDocument = HydratedDocument<UserTrafficEvent>;

@Schema({ timestamps: true, collection: 'user_traffic_events' })
export class UserTrafficEvent {
    @Prop({ type: Number, required: true, index: true })
    userId: number;

    @Prop({ type: String, default: null })
    utm_source: string | null;

    @Prop({ type: String, default: null })
    utm_medium: string | null;

    @Prop({ type: String, default: null })
    utm_campaign: string | null;

    @Prop({ type: String, default: null })
    utm_content: string | null;

    @Prop({ type: String, default: null })
    utm_term: string | null;

    @Prop({ type: String, default: null })
    referrerUrl: string | null;

    @Prop({ type: String, default: null })
    landingPage: string | null;

    @Prop({ type: String, default: null, index: true })
    ip: string | null;

    @Prop({ type: String, default: null })
    userAgent: string | null;
}

export const UserTrafficEventSchema = SchemaFactory.createForClass(UserTrafficEvent);
