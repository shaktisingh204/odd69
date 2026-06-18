import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DailyCheckinClaimDocument = DailyCheckinClaim & Document;

@Schema({ timestamps: true, collection: 'daily_checkin_claims' })
export class DailyCheckinClaim {
    @Prop({ required: true, index: true })
    userId: number;

    @Prop({ required: true })
    username: string;

    /** Which day in the cycle this claim was for (1-based) */
    @Prop({ required: true })
    cycleDay: number;

    /** Current streak at the time of claim */
    @Prop({ required: true })
    streak: number;

    /** Base reward amount before multipliers */
    @Prop({ required: true })
    baseReward: number;

    /** VIP multiplier applied */
    @Prop({ default: 1 })
    vipMultiplier: number;

    /** Milestone multiplier applied */
    @Prop({ default: 1 })
    milestoneMultiplier: number;

    /** Referral bonus amount added */
    @Prop({ default: 0 })
    referralBonus: number;

    /** Lucky jackpot amount (0 if not hit) */
    @Prop({ default: 0 })
    jackpotAmount: number;

    /** Final total reward credited */
    @Prop({ required: true })
    totalReward: number;

    /** Which wallet was credited */
    @Prop({ default: 'MAIN', enum: ['MAIN', 'BONUS'] })
    walletTarget: string;

    /** Reward type: 'fixed', 'random', 'spin_wheel' */
    @Prop({ default: 'fixed' })
    rewardType: string;

    /** Spin wheel result (if applicable) */
    @Prop({ default: null })
    spinWheelSlice: string;

    /** Achievements unlocked during this claim */
    @Prop({ type: [String], default: [] })
    achievementsUnlocked: string[];

    /** Weekly mega reward claimed */
    @Prop({ default: false })
    weeklyMegaClaimed: boolean;

    @Prop({ default: 0 })
    weeklyMegaAmount: number;

    /** Monthly grand prize claimed */
    @Prop({ default: false })
    monthlyGrandClaimed: boolean;

    @Prop({ default: 0 })
    monthlyGrandAmount: number;

    @Prop({ default: 'INR' })
    currency: string;

    /** Date string YYYY-MM-DD for fast lookup */
    @Prop({ required: true, index: true })
    claimDate: string;
}

export const DailyCheckinClaimSchema = SchemaFactory.createForClass(DailyCheckinClaim);

// Compound index: one claim per user per day
DailyCheckinClaimSchema.index({ userId: 1, claimDate: 1 }, { unique: true });
// Leaderboard index
DailyCheckinClaimSchema.index({ totalReward: -1 });
