import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DailyCheckinConfigDocument = DailyCheckinConfig & Document;

@Schema({ timestamps: true, collection: 'daily_checkin_configs' })
export class DailyCheckinConfig {
    @Prop({ required: true, unique: true, default: 'default' })
    configKey: string;

    /** Master on/off switch */
    @Prop({ default: true })
    enabled: boolean;

    @Prop({ default: 'daily', enum: ['daily', 'weekly', 'monthly', 'custom'] })
    scheduleType: string;

    @Prop({ default: 1 })
    customIntervalDays: number;

    @Prop({ default: 'fixed', enum: ['fixed', 'random'] })
    rewardMode: string;

    @Prop({ type: [Number], default: [10, 20, 30, 50, 75, 100, 200] })
    fixedRewards: number[];

    @Prop({ type: [Number], default: [5, 10, 15, 25, 35, 50, 100] })
    randomMin: number[];

    @Prop({ type: [Number], default: [20, 40, 60, 100, 150, 200, 500] })
    randomMax: number[];

    @Prop({ default: 'INR', enum: ['INR', 'USD'] })
    currency: string;

    @Prop({ default: 'MAIN', enum: ['MAIN', 'BONUS'] })
    walletTarget: string;

    @Prop({ default: true })
    requiresDeposit: boolean;

    @Prop({ default: 0 })
    minDepositAmount: number;

    @Prop({ default: false })
    streakResetOnMiss: boolean;

    @Prop({ default: 7 })
    cycleDays: number;

    @Prop({ type: Object, default: { '7': 2, '30': 5 } })
    milestoneMultipliers: Record<string, number>;

    @Prop({ default: 1 })
    maxDailyClaimsPerUser: number;

    @Prop({ default: 0 })
    maxTotalRewardPerUser: number;

    @Prop({ default: null })
    activeFrom: Date;

    @Prop({ default: null })
    activeTo: Date;

    @Prop({ default: 'admin' })
    updatedBy: string;

    @Prop({ default: '' })
    note: string;

    // ─── NEW: Spin Wheel Config ──────────────────────────────────────────
    @Prop({ default: true })
    spinWheelEnabled: boolean;

    @Prop({ type: [Object], default: [
        { label: '₹5', value: 5, color: '#FF6B6B', probability: 25 },
        { label: '₹10', value: 10, color: '#4ECDC4', probability: 20 },
        { label: '₹25', value: 25, color: '#45B7D1', probability: 15 },
        { label: '₹50', value: 50, color: '#96CEB4', probability: 12 },
        { label: '₹100', value: 100, color: '#FFEAA7', probability: 10 },
        { label: '₹200', value: 200, color: '#DDA0DD', probability: 8 },
        { label: '₹500', value: 500, color: '#FF9FF3', probability: 5 },
        { label: 'JACKPOT', value: 2000, color: '#FFD700', probability: 2 },
        { label: '₹15', value: 15, color: '#A8E6CF', probability: 3 },
    ] })
    spinWheelSlices: { label: string; value: number; color: string; probability: number }[];

    // ─── NEW: VIP Tier Multipliers ───────────────────────────────────────
    @Prop({ default: true })
    vipMultiplierEnabled: boolean;

    @Prop({ type: Object, default: {
        'BRONZE': 1,
        'SILVER': 1.5,
        'GOLD': 2,
        'PLATINUM': 3,
        'DIAMOND': 5,
    } })
    vipTierMultipliers: Record<string, number>;

    // ─── NEW: Lucky Jackpot ──────────────────────────────────────────────
    @Prop({ default: true })
    luckyJackpotEnabled: boolean;

    @Prop({ default: 2 })
    luckyJackpotChancePercent: number;

    @Prop({ default: 5000 })
    luckyJackpotAmount: number;

    // ─── NEW: Weekly Mega Reward ─────────────────────────────────────────
    @Prop({ default: true })
    weeklyMegaRewardEnabled: boolean;

    @Prop({ default: 1000 })
    weeklyMegaRewardAmount: number;

    @Prop({ default: 7 })
    weeklyMegaStreakRequired: number;

    // ─── NEW: Monthly Grand Prize ────────────────────────────────────────
    @Prop({ default: true })
    monthlyGrandPrizeEnabled: boolean;

    @Prop({ default: 10000 })
    monthlyGrandPrizeAmount: number;

    @Prop({ default: 30 })
    monthlyGrandPrizeStreakRequired: number;

    // ─── NEW: Achievement Badges ─────────────────────────────────────────
    @Prop({ default: true })
    achievementsEnabled: boolean;

    @Prop({ type: [Object], default: [
        { id: 'first_claim', name: 'First Steps', description: 'Claim your first daily reward', icon: '🎯', streakRequired: 1, reward: 50 },
        { id: 'streak_3', name: 'Getting Warmed Up', description: 'Maintain a 3-day streak', icon: '🔥', streakRequired: 3, reward: 100 },
        { id: 'streak_7', name: 'Week Warrior', description: 'Complete a full 7-day streak', icon: '⚔️', streakRequired: 7, reward: 500 },
        { id: 'streak_14', name: 'Fortnight Fighter', description: '14-day streak achieved', icon: '🛡️', streakRequired: 14, reward: 1000 },
        { id: 'streak_30', name: 'Monthly Master', description: '30-day streak legend', icon: '👑', streakRequired: 30, reward: 5000 },
        { id: 'streak_60', name: 'Diamond Hands', description: '60-day streak champion', icon: '💎', streakRequired: 60, reward: 10000 },
        { id: 'streak_100', name: 'Century Club', description: '100-day streak immortal', icon: '🏆', streakRequired: 100, reward: 25000 },
        { id: 'total_10k', name: 'Big Earner', description: 'Earn ₹10,000 total from daily rewards', icon: '💰', totalEarnedRequired: 10000, reward: 2000 },
    ] })
    achievements: {
        id: string;
        name: string;
        description: string;
        icon: string;
        streakRequired?: number;
        totalEarnedRequired?: number;
        reward: number;
    }[];

    // ─── NEW: Referral Daily Bonus ───────────────────────────────────────
    @Prop({ default: true })
    referralBonusEnabled: boolean;

    @Prop({ default: 20 })
    referralBonusPercent: number;

    @Prop({ default: 500 })
    referralBonusMaxPerDay: number;

    // ─── NEW: Leaderboard ────────────────────────────────────────────────
    @Prop({ default: true })
    leaderboardEnabled: boolean;

    @Prop({ default: 10 })
    leaderboardTopN: number;

    // ─── NEW: FAQs ───────────────────────────────────────────────────────
    @Prop({ type: [Object], default: [
        { q: 'What happens if I miss a day?', a: 'Depending on the settings, your streak may reset to 0 or continue from where you left off. If "Reset on Miss" is enabled, consistency is key!' },
        { q: 'How does the spin wheel work?', a: 'Instead of claiming a fixed reward, you can spin the wheel for a random prize. Each slice has a different value and probability. The jackpot slice offers the biggest reward but has the lowest chance.' },
        { q: 'What are VIP multipliers?', a: 'If you have an approved VIP status, your daily rewards are automatically multiplied. Bronze gets 1x, Silver 1.5x, Gold 2x, Platinum 3x, and Diamond 5x!' },
        { q: 'How do milestone rewards work?', a: 'When you hit specific streak milestones (like 7 days or 30 days), your reward is multiplied by a special milestone bonus. Plus, weekly and monthly mega rewards give you additional prizes on top.' },
        { q: 'Do I need to deposit to claim rewards?', a: 'Yes, you must have made at least one deposit to be eligible for daily rewards. This ensures fair play and prevents abuse of the system.' },
    ] })
    faqs: { q: string; a: string }[];
}

export const DailyCheckinConfigSchema = SchemaFactory.createForClass(DailyCheckinConfig);
