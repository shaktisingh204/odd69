import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MATCH_STATUSES } from '../match-cashback.constants';

export type MatchDocument = Match & Document;

@Schema({ timestamps: true, collection: 'matches' })
export class Match {
    @Prop({ required: true, unique: true, index: true })
    matchId: string;

    @Prop({ required: true })
    teamA: string;

    @Prop({ required: true })
    teamB: string;

    @Prop({ required: true })
    matchDate: Date;

    @Prop({ required: true, enum: MATCH_STATUSES, default: 'upcoming' })
    status: string;

    @Prop()
    winningTeam?: string;

    @Prop()
    settledAt?: Date;
}

export const MatchSchema = SchemaFactory.createForClass(Match);
MatchSchema.index({ status: 1, matchDate: 1 });
