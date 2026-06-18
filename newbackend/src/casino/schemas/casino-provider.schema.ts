import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CasinoProviderDocument = CasinoProvider & Document;

@Schema({ timestamps: true })
export class CasinoProvider {
    @Prop({ required: true, unique: true })
    name: string;

    @Prop({ required: true, unique: true })
    code: string;

    @Prop({ default: 0 })
    priority: number;

    @Prop({ default: true })
    isActive: boolean;

    @Prop()
    image: string;
}

export const CasinoProviderSchema = SchemaFactory.createForClass(CasinoProvider);
CasinoProviderSchema.index({ priority: -1 });
CasinoProviderSchema.index({ isActive: 1 });
