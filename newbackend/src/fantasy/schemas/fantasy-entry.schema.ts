import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FantasyEntryDocument = FantasyEntry & Document;

@Schema({ timestamps: true, collection: 'fantasy_entries' })
export class FantasyEntry {
  @Prop({ required: true, index: true })
  userId: number;

  @Prop({ required: true, index: true })
  contestId: string; // ObjectId of FantasyContest

  @Prop({ required: true, index: true })
  teamId: string; // ObjectId of FantasyTeam

  @Prop({ required: true, index: true })
  matchId: number; // externalMatchId

  @Prop({ required: true })
  entryFee: number;

  /** settled, pending, refunded */
  @Prop({ default: 'pending' })
  status: string;

  @Prop({ default: 0 })
  rank: number;

  @Prop({ default: 0 })
  totalPoints: number;

  @Prop({ default: 0 })
  winnings: number;

  // --- Wallet split at time of join ---
  @Prop({ default: 0 })
  walletAmountUsed: number;

  @Prop({ default: 0 })
  bonusAmountUsed: number;

  // --- Promo / powerups ---
  @Prop()
  promocode: string;

  @Prop({ default: 0 })
  discountApplied: number;

  @Prop({ type: [String], default: [] })
  powerupsUsed: string[];

  // --- Admin actions ---
  @Prop({ default: false })
  isRefunded: boolean;

  @Prop({ type: Date })
  refundedAt: Date;

  @Prop()
  refundReason: string;
}

export const FantasyEntrySchema = SchemaFactory.createForClass(FantasyEntry);
FantasyEntrySchema.index({ userId: 1, matchId: 1 });
FantasyEntrySchema.index({ contestId: 1, totalPoints: -1 }); // for leaderboard
