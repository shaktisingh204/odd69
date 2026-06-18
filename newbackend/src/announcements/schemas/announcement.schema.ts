import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AnnouncementDocument = Announcement & Document;

@Schema({ timestamps: true })
export class Announcement {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    message: string;

    @Prop({ default: 'INFO', enum: ['INFO', 'WARNING', 'SUCCESS', 'PROMO'] })
    type: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: false })
    isPinned: boolean;

    @Prop()
    startAt: Date;

    @Prop()
    endAt: Date;

    @Prop({ default: 0 })
    order: number;
}

export const AnnouncementSchema = SchemaFactory.createForClass(Announcement);
AnnouncementSchema.index({ isActive: 1, isPinned: -1, order: 1 });
