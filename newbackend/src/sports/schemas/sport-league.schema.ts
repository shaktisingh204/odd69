import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SportLeagueDocument = SportLeague & Document;

@Schema({ timestamps: true, collection: 'sport_leagues' })
export class SportLeague {
  /** Sportradar competition ID, e.g. "sr:competition:1234" */
  @Prop({ required: true, unique: true, index: true })
  competitionId: string;

  /** Human-readable name, e.g. "Premier League" */
  @Prop({ required: true })
  competitionName: string;

  /** Parent sport ID, e.g. "sr:sport:1" */
  @Prop({ required: true, index: true })
  sportId: string;

  /** Sport display name, e.g. "Soccer" */
  @Prop({ default: '' })
  sportName: string;

  /** Admin-uploaded / URL-pasted image. Empty = emoji fallback. */
  @Prop({ default: '' })
  imageUrl: string;

  /** Whether to show in the leagues slider (admin toggle) */
  @Prop({ default: true })
  isVisible: boolean;

  /** Manual sort order override (0 = first) */
  @Prop({ default: 0 })
  order: number;

  /** Total event count cached here to avoid re-aggregation */
  @Prop({ default: 0 })
  eventCount: number;

  /** Live event count */
  @Prop({ default: 0 })
  liveCount: number;
}

export const SportLeagueSchema = SchemaFactory.createForClass(SportLeague);
