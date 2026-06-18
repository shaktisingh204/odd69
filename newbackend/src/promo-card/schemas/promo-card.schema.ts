import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PromoCardDocument = PromoCard & Document;

@Schema({ timestamps: true })
export class PromoCard {
    @Prop({ required: true })
    title: string;

    @Prop()
    subtitle: string;

    @Prop()
    description: string;

    @Prop()
    termsAndConditions: string;

    @Prop({ default: 'ALL', enum: ['ALL', 'CASINO', 'SPORTS', 'LIVE', 'VIP'] })
    category: string;

    @Prop({ default: 'CASINO' })
    tag: string;

    @Prop()
    promoCode: string;

    @Prop({ default: 0 })
    minDeposit: number;

    @Prop({ default: 0 })
    bonusPercentage: number;

    @Prop()
    expiryDate: Date;

    @Prop({ default: 'CLAIM NOW' })
    buttonText: string;

    @Prop()
    buttonLink: string;

    @Prop()
    bgImage: string;

    @Prop()
    charImage: string;

    @Prop()
    gradient: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: false })
    isFeatured: boolean;

    @Prop({ default: 0 })
    order: number;
}

export const PromoCardSchema = SchemaFactory.createForClass(PromoCard);
