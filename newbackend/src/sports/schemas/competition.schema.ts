import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompetitionDocument = Competition & Document;

@Schema({ timestamps: true })
export class Competition {
    @Prop({ required: true, unique: true })
    competition_id: string;

    @Prop({ required: true })
    competition_name: string;

    @Prop({ required: true })
    sport_id: string; // Foreign key to Sport.sport_id

    @Prop()
    country_code: string;

    @Prop({ default: 0 })
    market_count: number;

    @Prop({ default: true })
    isVisible: boolean;
}

export const CompetitionSchema = SchemaFactory.createForClass(Competition);
// Index for faster queries usually
CompetitionSchema.index({ country_code: 1 });
CompetitionSchema.index({ sport_id: 1 });
