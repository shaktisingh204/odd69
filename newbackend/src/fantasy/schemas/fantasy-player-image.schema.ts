import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyPlayerImageDocument = FantasyPlayerImage & Document;

/**
 * IPL player headshots scraped from iplt20.com and uploaded to Cloudflare
 * Images. Populated by the admin action `scrapeAllIPLAssets()`. Looked up by
 * normalized player name (see fantasy.service enrichSquadImages) so that the
 * EntitySport squad — which never returns player images — can be rendered
 * with official photos.
 */
@Schema({ timestamps: true, collection: 'fantasy_player_images' })
export class FantasyPlayerImage {
  @Prop({ required: true, unique: true, index: true })
  normalizedName: string;

  @Prop({ type: [String], default: [], index: true })
  aliases: string[];

  @Prop({ required: true })
  displayName: string;

  @Prop({ required: true, index: true })
  teamCode: string;

  @Prop({ required: true })
  teamName: string;

  @Prop({ required: true })
  iplImageId: string;

  @Prop({ required: true })
  sourceUrl: string;

  @Prop({ required: true })
  cfImageId: string;

  @Prop({ required: true })
  cfUrl: string;
}

export const FantasyPlayerImageSchema = SchemaFactory.createForClass(FantasyPlayerImage);
