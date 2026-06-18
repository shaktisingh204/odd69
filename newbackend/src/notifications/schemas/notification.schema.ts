import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = AppNotification & Document;

@Schema({ timestamps: true, collection: 'notifications' })
export class AppNotification {
    @Prop({ required: true, index: true })
    userId: number;

    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    body: string;

    @Prop()
    deepLink: string;

    @Prop({ default: false })
    isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(AppNotification);
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });
