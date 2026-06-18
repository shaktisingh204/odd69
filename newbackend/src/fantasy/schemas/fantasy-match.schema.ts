import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyMatchDocument = FantasyMatch & Document;

@Schema({ timestamps: true, collection: 'fantasy_matches' })
export class FantasyMatch {
  /** External API match ID */
  @Prop({ required: true, unique: true, index: true })
  externalMatchId: number;

  @Prop({ required: true })
  title: string;

  @Prop()
  subtitle: string;

  /** External competition ID */
  @Prop({ index: true })
  competitionId: number;

  @Prop()
  competitionTitle: string;

  @Prop()
  format: string; // T20, ODI, Test, etc.

  @Prop({ type: Object })
  teamA: {
    id: number;
    name: string;
    short: string;
    logo: string;      // logo_url from API
    thumb: string;      // thumb_url from API (same or smaller)
    color: string;
  };

  @Prop({ type: Object })
  teamB: {
    id: number;
    name: string;
    short: string;
    logo: string;
    thumb: string;
    color: string;
  };

  @Prop()
  venue: string;

  @Prop({ type: Date, index: true })
  startDate: Date;

  /**
   * EntitySport status codes:
   *   1 = Upcoming
   *   2 = Result (completed)
   *   3 = Live
   *   4 = Cancelled
   */
  @Prop({ default: 1, index: true })
  status: number;

  /**
   * True when fetched with pre_squad=true from EntitySport.
   * Means player credits & roles are locked and will NOT change — safe to show
   * in the "Managed" tab where users can confidently build their teams.
   */
  @Prop({ default: false, index: true })
  isManaged: boolean;

  @Prop()
  statusNote: string;

  @Prop({ type: Object, default: {} })
  scoreA: Record<string, any>;

  @Prop({ type: Object, default: {} })
  scoreB: Record<string, any>;

  @Prop()
  result: string;

  @Prop()
  shortTitle: string; // e.g. "LSG vs GT"

  @Prop()
  matchNumber: string;

  @Prop()
  statusStr: string; // "Scheduled", "Completed", "Live"

  @Prop({ type: Object, default: {} })
  toss: { text: string; winner: number; decision: number };

  @Prop({ type: Object, default: {} })
  competition: {
    cid: number;
    title: string;
    abbr: string;
    type: string;
    category: string;
    matchFormat: string;
    season: string;
    status: string;
    country: string;
    totalMatches: string;
    totalTeams: string;
    /** Cloudflare-hosted logo (falls back to original EntitySport URL) */
    logoUrl: string;
  };

  /** Playing 11 announced? */
  @Prop({ default: false })
  playing11Announced: boolean;

  /** Squads from external API */
  @Prop({ type: Array, default: [] })
  squads: Array<{
    playerId: number;
    name: string;             // title from API
    shortName: string;        // short_name from API (e.g. "V Kohli")
    role: string;             // normalized: keeper, batsman, allrounder, bowler
    roleStr: string;          // raw role_str from API (e.g. "(WK/C)")
    teamId: number;
    teamName: string;
    credit: number;           // fantasy_player_rating from API (8.0, 9.5 etc)
    isPlaying11: boolean;
    isCaptain: boolean;
    image: string;            // thumb_url (usually empty from this API)
    nationality: string;
    battingStyle: string;     // "Right Hand Bat" etc
    bowlingStyle: string;     // "Right Arm Medium" etc
    bowlingType: string;      // "Pace" / "Spin"
  }>;

  /** Fantasy points per player (populated after match) */
  @Prop({ type: Object, default: {} })
  fantasyPoints: Record<string, number>; // playerId -> points

  /** Detailed breakdown of points */
  @Prop({ type: Object, default: {} })
  fantasyPointsBreakdown: Record<string, Record<string, number>>; // playerId -> { runs: 10, wickets: 25, ... }

  /** Last synced from external API */
  @Prop({ type: Date })
  lastSyncedAt: Date;

  @Prop({ type: Date })
  pointsLastSyncedAt: Date;

  /** Admin can hide a match from the player frontend without deleting it */
  @Prop({ default: false, index: true })
  isDisabled: boolean;

  @Prop()
  disableReason: string;

  /** Contests for this match become uneditable after lockAt */
  @Prop({ type: Date })
  lockAt: Date;

  /**
   * Umpires and match officials from Match Info API.
   * e.g. [{ name: 'Joel Wilson', role: 'first_umpire' }, ...]
   */
  @Prop({ type: Array, default: [] })
  umpires: Array<{ name: string; role: string }>;

  /**
   * Extra metadata from Match Info API (pitch, weather, venue capacity, etc.)
   * Stored as-is from the API response for forward-compatibility.
   */
  @Prop({ type: Object, default: {} })
  matchMeta: Record<string, any>;

  /**
   * Confirmed Playing 11 player IDs from Match Playing11 API.
   * This is more reliable than the squads playing11 flag for late lineup changes.
   */
  @Prop({ type: [Number], default: [] })
  playing11Ids: number[];
}

export const FantasyMatchSchema = SchemaFactory.createForClass(FantasyMatch);
FantasyMatchSchema.index({ status: 1, startDate: -1 });
