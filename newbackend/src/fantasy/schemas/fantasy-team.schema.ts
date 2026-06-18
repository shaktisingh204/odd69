import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyTeamDocument = FantasyTeam & Document;

@Schema({ timestamps: true, collection: 'fantasy_teams' })
export class FantasyTeam {
  @Prop({ required: true, index: true })
  userId: number;

  @Prop({ required: true, index: true })
  matchId: number; // externalMatchId

  @Prop({ required: true })
  teamName: string; // e.g. "Team 1", "Team 2"

  @Prop({ type: Array, required: true })
  players: Array<{
    playerId: number;
    name: string;
    role: string;
    teamId: number;
    credit: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
  }>;

  @Prop({ required: true })
  captainId: number;

  @Prop({ required: true })
  viceCaptainId: number;

  @Prop({ default: 0 })
  totalCredits: number;

  /** Calculated after match */
  @Prop({ default: 0 })
  totalPoints: number;

  /** Points breakdown per player in this team */
  @Prop({ type: Object, default: {} })
  playerPoints: Record<string, number>;
}

export const FantasyTeamSchema = SchemaFactory.createForClass(FantasyTeam);
FantasyTeamSchema.index({ userId: 1, matchId: 1 });
