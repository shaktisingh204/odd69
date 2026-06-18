import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CasinoGameDocument = CasinoGame & Document;

@Schema({ timestamps: true })
export class CasinoGame {
    @Prop({ required: true })
    provider: string;

    @Prop()
    domain: string;

    @Prop({ required: true })
    name: string;

    @Prop()
    type: string;

    @Prop()
    subType: string;

    @Prop()
    category: string;

    @Prop()
    rtp: string;

    @Prop({ required: true, unique: true })
    gameCode: string;

    @Prop()
    gameId: string;

    @Prop()
    remarks: string;

    @Prop()
    image: string;

    @Prop()
    icon: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: 0 })
    playCount: number;

    @Prop({ default: 0 })
    priority: number;

    @Prop({ default: false })
    isPopular: boolean;

    @Prop({ default: false })
    isNewGame: boolean;
}

export const CasinoGameSchema = SchemaFactory.createForClass(CasinoGame);
CasinoGameSchema.index({ provider: 1 });

