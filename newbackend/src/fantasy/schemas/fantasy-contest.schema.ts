import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyContestDocument = FantasyContest & Document;

@Schema({ timestamps: true, collection: 'fantasy_contests' })
export class FantasyContest {
  @Prop({ required: true, index: true })
  matchId: number; // externalMatchId

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  type: string; // mega, head2head, winner_takes_all, practice

  /**
   * Which phase of the match this contest scores on.
   * - full: entire match (default; existing behaviour)
   * - innings1: only 1st-innings scoring counts
   * - innings2: only 2nd-innings scoring counts
   * - powerplay: only powerplay-overs scoring counts
   *
   * Settlement must filter points accordingly when phase !== 'full'.
   */
  @Prop({ default: 'full', index: true })
  phase: 'full' | 'innings1' | 'innings2' | 'powerplay';

  @Prop({ required: true })
  entryFee: number; // 0 for free/practice

  @Prop({ required: true })
  totalPrize: number;

  @Prop({ required: true })
  maxSpots: number;

  @Prop({ default: 0 })
  filledSpots: number;

  /** Prize distribution: rank ranges -> amount */
  @Prop({ type: Array, default: [] })
  prizeBreakdown: Array<{
    rankFrom: number;
    rankTo: number;
    prize: number;
    percentOfPool?: number;
  }>;

  @Prop({ default: true })
  isActive: boolean;

  /** Auto-created by system or admin */
  @Prop({ default: false })
  isAutoCreated: boolean;

  @Prop()
  icon: string;

  @Prop()
  accent: string;

  // --- Privacy / invites ---
  @Prop({ default: false, index: true })
  isPrivate: boolean;

  /** Upper-case invite code; unique when not null */
  @Prop({ uppercase: true, trim: true, index: true, sparse: true })
  inviteCode: string;

  @Prop()
  creatorUserId: number;

  // --- Entry controls ---
  @Prop({ default: 1 })
  multiEntry: number;  // max teams one user can submit

  @Prop({ default: false })
  isGuaranteed: boolean;

  // --- State ---
  @Prop({ default: false, index: true })
  isCancelled: boolean;

  @Prop()
  cancelReason: string;

  @Prop({ default: false, index: true })
  isSettled: boolean;

  @Prop({ type: Date })
  settledAt: Date;

  @Prop()
  templateId: string;
}

export const FantasyContestSchema = SchemaFactory.createForClass(FantasyContest);
FantasyContestSchema.index({ matchId: 1, isActive: 1 });
