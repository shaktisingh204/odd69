import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CasinoCategoryDocument = CasinoCategory & Document;

@Schema({ timestamps: true })
export class CasinoCategory {
    @Prop({ required: true, unique: true })
    name: string;

    @Prop({ required: true, unique: true })
    slug: string;

    @Prop({ default: 0 })
    priority: number;

    @Prop({ default: true })
    isActive: boolean;

    @Prop()
    image: string;
}

export const CasinoCategorySchema = SchemaFactory.createForClass(CasinoCategory);
CasinoCategorySchema.index({ priority: -1 });

