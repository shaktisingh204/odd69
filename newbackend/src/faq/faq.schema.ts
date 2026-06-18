import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FaqDocument = Faq & Document;

@Schema({ _id: false })
export class FaqMedia {
    @Prop({ required: true, enum: ['image', 'video', 'youtube', 'link'] })
    type: string;

    @Prop({ required: true })
    url: string;

    @Prop()
    caption?: string;
}

export const FaqMediaSchema = SchemaFactory.createForClass(FaqMedia);

@Schema({ timestamps: true })
export class Faq {
    @Prop({ required: true })
    question: string;

    @Prop({ required: true })
    answer: string;

    @Prop({ required: true, index: true })
    category: string;

    @Prop({ type: [FaqMediaSchema], default: [] })
    media: FaqMedia[];

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: 0 })
    order: number;
}

export const FaqSchema = SchemaFactory.createForClass(Faq);

FaqSchema.index({ isActive: 1, order: 1 });
