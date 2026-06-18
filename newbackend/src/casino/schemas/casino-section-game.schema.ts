import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CasinoSectionGameDocument = CasinoSectionGame & Document;

export type SectionKey = 'popular' | 'new' | 'slots' | 'live' | 'table' | 'crash' | 'home' | 'top' | 'exclusive' | 'trending';

@Schema({ timestamps: true, collection: 'casinosectiongames' })
export class CasinoSectionGame {
    @Prop({ required: true, type: String })
    section: SectionKey;

    @Prop({ required: true })
    gameCode: string;

    @Prop()
    name: string;

    @Prop()
    provider: string;

    @Prop()
    image: string;

    @Prop({ default: 0 })
    order: number;
}

export const CasinoSectionGameSchema = SchemaFactory.createForClass(CasinoSectionGame);
CasinoSectionGameSchema.index({ section: 1, gameCode: 1 }, { unique: true });
CasinoSectionGameSchema.index({ section: 1, order: 1 });
