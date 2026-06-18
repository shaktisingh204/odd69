import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FantasyReferralDocument = FantasyReferral & Document;

/**
 * Per-pair fantasy referral ledger. A row is created the first time a referee
 * signs up using a referrer's code. Subsequent referral earnings (per join,
 * per win) are appended into `events` so admin can audit.
 */
@Schema({ timestamps: true, collection: 'fantasy_referrals' })
export class FantasyReferral {
  @Prop({ required: true, index: true })
  referrerId: number;

  @Prop({ required: true, unique: true, index: true })
  refereeId: number;

  @Prop({ default: 'pending', enum: ['pending', 'active', 'rewarded', 'blocked'] })
  status: string;

  @Prop({ default: 0 })
  totalEarned: number;

  @Prop({
    type: [{
      kind: String,     // signup | first_join | win_share | streak_share
      amount: Number,
      matchId: Number,
      contestId: String,
      at: { type: Date, default: Date.now },
    }],
    default: [],
  })
  events: Array<{ kind: string; amount: number; matchId?: number; contestId?: string; at: Date }>;

  @Prop()
  referralCode: string;
}

export const FantasyReferralSchema = SchemaFactory.createForClass(FantasyReferral);
