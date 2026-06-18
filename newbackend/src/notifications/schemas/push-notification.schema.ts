import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PushNotificationDocument = PushNotificationLog & Document;

@Schema({ timestamps: true, collection: 'push_notifications' })
export class PushNotificationLog {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    body: string;

    @Prop()
    imageUrl: string;

    @Prop()
    deepLink: string;

    @Prop()
    segment: string;

    @Prop({ type: [Number], default: [] })
    targetUserIds: number[];

    @Prop({ default: 0 })
    sentBy: number;

    @Prop({ default: 0 })
    sentCount: number;

    @Prop()
    onesignalId: string;
}

export const PushNotificationLogSchema = SchemaFactory.createForClass(PushNotificationLog);
PushNotificationLogSchema.index({ createdAt: -1 });
