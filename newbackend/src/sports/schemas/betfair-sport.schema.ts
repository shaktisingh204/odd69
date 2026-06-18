import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BetfairSportDocument = BetfairSport & Document;

@Schema({ collection: 'betfair_sports', timestamps: true })
export class BetfairSport {
    @Prop({ required: true, unique: true, index: true })
    sportId: string; // Betfair sport ID e.g. "4"

    @Prop({ required: true })
    name: string; // "Cricket"

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: true })
    isTab: boolean;

    @Prop({ default: false })
    isDefault: boolean;

    @Prop({ default: 0 })
    sortOrder: number;
}

export const BetfairSportSchema = SchemaFactory.createForClass(BetfairSport);
BetfairSportSchema.index({ sportId: 1 }, { unique: true });
