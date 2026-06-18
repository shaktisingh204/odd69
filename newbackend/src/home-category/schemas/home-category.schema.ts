import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HomeCategoryDocument = HomeCategory & Document;

@Schema({ timestamps: true })
export class HomeCategory {
    @Prop({ required: true })
    title: string;

    @Prop()
    subtitle: string; // "Win Big Today", etc.

    @Prop()
    description: string;

    @Prop()
    image: string; // URL to the image

    @Prop({ required: true })
    link: string; // "/casino", "/sports"

    @Prop({ default: false })
    isLarge: boolean; // True for the big cards (Casino/Sports)

    @Prop({ default: 0 })
    order: number; // For sorting

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ type: Object })
    style: any; // Store custom styles like gradients or specific colors if needed
}

export const HomeCategorySchema = SchemaFactory.createForClass(HomeCategory);
