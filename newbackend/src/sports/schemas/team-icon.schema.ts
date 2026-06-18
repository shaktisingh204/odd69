import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'team_icons', timestamps: true })
export class TeamIcon extends Document {
    @Prop({ required: true, unique: true, index: true })
    team_name: string; // normalised lowercase

    @Prop({ required: true })
    display_name: string;

    @Prop({ required: true })
    icon_url: string;

    @Prop({ default: '' })
    sport_id: string;
}

export const TeamIconSchema = SchemaFactory.createForClass(TeamIcon);

export type TeamIconDocument = TeamIcon & Document;
