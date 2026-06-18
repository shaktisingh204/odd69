import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyCompetitionDocument = FantasyCompetition & Document;

@Schema({ timestamps: true, collection: 'fantasy_competitions' })
export class FantasyCompetition {
  /** EntitySport competition ID */
  @Prop({ required: true, unique: true, index: true })
  cid: number;

  @Prop()
  title: string;

  @Prop()
  abbr: string;

  @Prop()
  type: string;

  @Prop()
  category: string;

  @Prop()
  matchFormat: string;

  @Prop()
  season: string;

  @Prop()
  status: string;

  @Prop()
  country: string;

  /** Original logo URL from EntitySport API */
  @Prop()
  logoUrl: string;

  /** Cloudflare Images delivery URL (null until uploaded) */
  @Prop({ default: null })
  cfLogoUrl: string;

  /** Cloudflare Images image ID (used for deletion/updates) */
  @Prop({ default: null })
  cfImageId: string;

  /** When the logo was last uploaded to Cloudflare */
  @Prop({ type: Date, default: null })
  cfUploadedAt: Date;
}

export const FantasyCompetitionSchema = SchemaFactory.createForClass(FantasyCompetition);
