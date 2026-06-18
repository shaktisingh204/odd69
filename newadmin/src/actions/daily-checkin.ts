'use server'

import connectMongo from '@/lib/mongo';
import { DailyCheckinConfig, DailyCheckinClaim } from '@/models/MongoModels';
import { revalidatePath } from 'next/cache';

const CONFIG_KEY = 'default';
const REVALIDATE_PATH = '/dashboard/marketing/daily-rewards';

// ─── Default config shape ─────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
    configKey: CONFIG_KEY,
    enabled: true,
    hidden: false,
    scheduleType: 'daily' as const,
    customIntervalDays: 1,
    rewardMode: 'fixed' as const,
    fixedRewards: [10, 20, 30, 50, 75, 100, 200],
    randomMin: [5, 10, 15, 25, 35, 50, 100],
    randomMax: [20, 40, 60, 100, 150, 200, 500],
    currency: 'INR' as const,
    walletTarget: 'MAIN' as const,
    requiresDeposit: true,
    minDepositAmount: 0,
    streakResetOnMiss: false,
    cycleDays: 7,
    milestoneMultipliers: { '7': 2, '30': 5 },
    maxDailyClaimsPerUser: 1,
    maxTotalRewardPerUser: 0,
    activeFrom: null,
    activeTo: null,
    updatedBy: 'admin',
    note: '',
    // New features
    spinWheelEnabled: true,
    spinWheelSlices: [
        { label: '₹5', value: 5, color: '#FF6B6B', probability: 25 },
        { label: '₹10', value: 10, color: '#4ECDC4', probability: 20 },
        { label: '₹25', value: 25, color: '#45B7D1', probability: 15 },
        { label: '₹50', value: 50, color: '#96CEB4', probability: 12 },
        { label: '₹100', value: 100, color: '#FFEAA7', probability: 10 },
        { label: '₹200', value: 200, color: '#DDA0DD', probability: 8 },
        { label: '₹500', value: 500, color: '#FF9FF3', probability: 5 },
        { label: 'JACKPOT', value: 2000, color: '#FFD700', probability: 2 },
        { label: '₹15', value: 15, color: '#A8E6CF', probability: 3 },
    ],
    vipMultiplierEnabled: true,
    vipTierMultipliers: { BRONZE: 1, SILVER: 1.5, GOLD: 2, PLATINUM: 3, DIAMOND: 5 },
    luckyJackpotEnabled: true,
    luckyJackpotChancePercent: 2,
    luckyJackpotAmount: 5000,
    weeklyMegaRewardEnabled: true,
    weeklyMegaRewardAmount: 1000,
    weeklyMegaStreakRequired: 7,
    monthlyGrandPrizeEnabled: true,
    monthlyGrandPrizeAmount: 10000,
    monthlyGrandPrizeStreakRequired: 30,
    achievementsEnabled: true,
    achievements: [
        { id: 'first_claim', name: 'First Steps', description: 'Claim your first daily reward', icon: '🎯', streakRequired: 1, reward: 50 },
        { id: 'streak_3', name: 'Getting Warmed Up', description: 'Maintain a 3-day streak', icon: '🔥', streakRequired: 3, reward: 100 },
        { id: 'streak_7', name: 'Week Warrior', description: 'Complete a full 7-day streak', icon: '⚔️', streakRequired: 7, reward: 500 },
        { id: 'streak_14', name: 'Fortnight Fighter', description: '14-day streak achieved', icon: '🛡️', streakRequired: 14, reward: 1000 },
        { id: 'streak_30', name: 'Monthly Master', description: '30-day streak legend', icon: '👑', streakRequired: 30, reward: 5000 },
        { id: 'streak_60', name: 'Diamond Hands', description: '60-day streak champion', icon: '💎', streakRequired: 60, reward: 10000 },
        { id: 'streak_100', name: 'Century Club', description: '100-day streak immortal', icon: '🏆', streakRequired: 100, reward: 25000 },
        { id: 'total_10k', name: 'Big Earner', description: 'Earn ₹10,000 total from daily rewards', icon: '💰', totalEarnedRequired: 10000, reward: 2000 },
    ],
    referralBonusEnabled: true,
    referralBonusPercent: 20,
    referralBonusMaxPerDay: 500,
    leaderboardEnabled: true,
    leaderboardTopN: 10,
    faqs: [
        { q: 'What happens if I miss a day?', a: 'Depending on the settings, your streak may reset to 0 or continue from where you left off. If "Reset on Miss" is enabled, consistency is key!' },
        { q: 'How does the spin wheel work?', a: 'Instead of claiming a fixed reward, you can spin the wheel for a random prize. Each slice has a different value and probability.' },
        { q: 'What are VIP multipliers?', a: 'If you have an approved VIP status, your daily rewards are automatically multiplied. Bronze gets 1x, Silver 1.5x, Gold 2x, Platinum 3x, and Diamond 5x!' },
        { q: 'How do milestone rewards work?', a: 'When you hit specific streak milestones (like 7 days or 30 days), your reward is multiplied by a special milestone bonus.' },
        { q: 'Do I need to deposit to claim rewards?', a: 'Yes, you must have made at least one deposit to be eligible for daily rewards.' },
    ],
};

// ─── GET Config ──────────────────────────────────────────────────────────────

export async function getDailyCheckinConfig() {
    try {
        await connectMongo();
        let config = await DailyCheckinConfig.findOne({ configKey: CONFIG_KEY }).lean();

        if (!config) {
            config = await DailyCheckinConfig.create(DEFAULT_CONFIG);
            config = await DailyCheckinConfig.findOne({ configKey: CONFIG_KEY }).lean();
        }

        return { success: true, data: JSON.parse(JSON.stringify(config)) };
    } catch (error) {
        console.error('[DailyCheckin] getConfig error:', error);
        return { success: false, error: 'Failed to load config', data: DEFAULT_CONFIG };
    }
}

// ─── SAVE Config (upsert) ────────────────────────────────────────────────────

export async function saveDailyCheckinConfig(payload: Record<string, any>) {
    try {
        await connectMongo();

        const cycleDays = Number(payload.cycleDays) || 7;

        const padArray = (arr: any[], len: number, fill: number) => {
            const a = Array.isArray(arr) ? arr.map(Number) : [];
            while (a.length < len) a.push(fill);
            return a.slice(0, len);
        };

        const fixedRewards = padArray(payload.fixedRewards, cycleDays, 0);
        const randomMin = padArray(payload.randomMin, cycleDays, 0);
        const randomMax = padArray(payload.randomMax, cycleDays, 0);

        let milestoneMultipliers = payload.milestoneMultipliers ?? { '7': 2, '30': 5 };
        if (typeof milestoneMultipliers === 'string') {
            try { milestoneMultipliers = JSON.parse(milestoneMultipliers); } catch { milestoneMultipliers = {}; }
        }

        let vipTierMultipliers = payload.vipTierMultipliers ?? DEFAULT_CONFIG.vipTierMultipliers;
        if (typeof vipTierMultipliers === 'string') {
            try { vipTierMultipliers = JSON.parse(vipTierMultipliers); } catch { vipTierMultipliers = DEFAULT_CONFIG.vipTierMultipliers; }
        }

        let spinWheelSlices = payload.spinWheelSlices ?? DEFAULT_CONFIG.spinWheelSlices;
        if (typeof spinWheelSlices === 'string') {
            try { spinWheelSlices = JSON.parse(spinWheelSlices); } catch { spinWheelSlices = DEFAULT_CONFIG.spinWheelSlices; }
        }

        let achievements = payload.achievements ?? DEFAULT_CONFIG.achievements;
        if (typeof achievements === 'string') {
            try { achievements = JSON.parse(achievements); } catch { achievements = DEFAULT_CONFIG.achievements; }
        }

        let faqs = payload.faqs ?? DEFAULT_CONFIG.faqs;
        if (typeof faqs === 'string') {
            try { faqs = JSON.parse(faqs); } catch { faqs = DEFAULT_CONFIG.faqs; }
        }

        const update = {
            ...payload,
            fixedRewards,
            randomMin,
            randomMax,
            milestoneMultipliers,
            vipTierMultipliers,
            spinWheelSlices,
            achievements,
            faqs,
            cycleDays,
            customIntervalDays: Number(payload.customIntervalDays) || 1,
            minDepositAmount: Number(payload.minDepositAmount) || 0,
            maxDailyClaimsPerUser: Number(payload.maxDailyClaimsPerUser) || 1,
            maxTotalRewardPerUser: Number(payload.maxTotalRewardPerUser) || 0,
            luckyJackpotChancePercent: Number(payload.luckyJackpotChancePercent) || 2,
            luckyJackpotAmount: Number(payload.luckyJackpotAmount) || 5000,
            weeklyMegaRewardAmount: Number(payload.weeklyMegaRewardAmount) || 1000,
            weeklyMegaStreakRequired: Number(payload.weeklyMegaStreakRequired) || 7,
            monthlyGrandPrizeAmount: Number(payload.monthlyGrandPrizeAmount) || 10000,
            monthlyGrandPrizeStreakRequired: Number(payload.monthlyGrandPrizeStreakRequired) || 30,
            referralBonusPercent: Number(payload.referralBonusPercent) || 20,
            referralBonusMaxPerDay: Number(payload.referralBonusMaxPerDay) || 500,
            leaderboardTopN: Number(payload.leaderboardTopN) || 10,
            enabled: Boolean(payload.enabled),
            requiresDeposit: Boolean(payload.requiresDeposit),
            streakResetOnMiss: Boolean(payload.streakResetOnMiss),
            spinWheelEnabled: Boolean(payload.spinWheelEnabled),
            vipMultiplierEnabled: Boolean(payload.vipMultiplierEnabled),
            luckyJackpotEnabled: Boolean(payload.luckyJackpotEnabled),
            weeklyMegaRewardEnabled: Boolean(payload.weeklyMegaRewardEnabled),
            monthlyGrandPrizeEnabled: Boolean(payload.monthlyGrandPrizeEnabled),
            achievementsEnabled: Boolean(payload.achievementsEnabled),
            referralBonusEnabled: Boolean(payload.referralBonusEnabled),
            leaderboardEnabled: Boolean(payload.leaderboardEnabled),
            activeFrom: payload.activeFrom || null,
            activeTo: payload.activeTo || null,
            updatedBy: payload.updatedBy || 'admin',
        };

        await DailyCheckinConfig.findOneAndUpdate(
            { configKey: CONFIG_KEY },
            { $set: update },
            { upsert: true, returnDocument: 'after' }
        );

        revalidatePath(REVALIDATE_PATH);
        return { success: true };
    } catch (error) {
        console.error('[DailyCheckin] saveConfig error:', error);
        return { success: false, error: 'Failed to save config' };
    }
}

// ─── RESET to defaults ────────────────────────────────────────────────────────

export async function resetDailyCheckinConfig() {
    try {
        await connectMongo();
        await DailyCheckinConfig.findOneAndUpdate(
            { configKey: CONFIG_KEY },
            { $set: DEFAULT_CONFIG },
            { upsert: true }
        );
        revalidatePath(REVALIDATE_PATH);
        return { success: true };
    } catch (error) {
        console.error('[DailyCheckin] resetConfig error:', error);
        return { success: false, error: 'Failed to reset config' };
    }
}

// ─── TOGGLE enabled ───────────────────────────────────────────────────────────

export async function toggleDailyCheckin(enabled: boolean) {
    try {
        await connectMongo();
        await DailyCheckinConfig.findOneAndUpdate(
            { configKey: CONFIG_KEY },
            { $set: { enabled } },
            { upsert: true }
        );
        revalidatePath(REVALIDATE_PATH);
        return { success: true };
    } catch (error) {
        console.error('[DailyCheckin] toggle error:', error);
        return { success: false, error: 'Failed to toggle' };
    }
}

// ─── GET Claims (paginated) ──────────────────────────────────────────────────

export async function getDailyCheckinClaims(page = 1, limit = 50, search?: string) {
    try {
        await connectMongo();
        const query: any = {};
        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { userId: isNaN(Number(search)) ? -1 : Number(search) },
            ];
        }

        const [claims, total] = await Promise.all([
            DailyCheckinClaim.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            DailyCheckinClaim.countDocuments(query),
        ]);

        return {
            success: true,
            data: JSON.parse(JSON.stringify(claims)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    } catch (error) {
        console.error('[DailyCheckin] getClaims error:', error);
        return { success: false, error: 'Failed to load claims', data: [], total: 0 };
    }
}

// ─── GET Stats ───────────────────────────────────────────────────────────────

export async function getDailyCheckinStats() {
    try {
        await connectMongo();
        const today = new Date().toISOString().split('T')[0];

        const [
            totalClaims,
            todayClaims,
            totalRewarded,
            todayRewarded,
            uniqueUsers,
            jackpotHits,
            weeklyMegaHits,
            monthlyGrandHits,
            topStreaker,
        ] = await Promise.all([
            DailyCheckinClaim.countDocuments(),
            DailyCheckinClaim.countDocuments({ claimDate: today }),
            DailyCheckinClaim.aggregate([{ $group: { _id: null, total: { $sum: '$totalReward' } } }]),
            DailyCheckinClaim.aggregate([{ $match: { claimDate: today } }, { $group: { _id: null, total: { $sum: '$totalReward' } } }]),
            DailyCheckinClaim.distinct('userId').then(ids => ids.length),
            DailyCheckinClaim.countDocuments({ jackpotAmount: { $gt: 0 } }),
            DailyCheckinClaim.countDocuments({ weeklyMegaClaimed: true }),
            DailyCheckinClaim.countDocuments({ monthlyGrandClaimed: true }),
            DailyCheckinClaim.findOne().sort({ streak: -1 }).select('username streak').lean(),
        ]);

        return {
            success: true,
            data: {
                totalClaims,
                todayClaims,
                totalRewarded: totalRewarded[0]?.total || 0,
                todayRewarded: todayRewarded[0]?.total || 0,
                uniqueUsers,
                jackpotHits,
                weeklyMegaHits,
                monthlyGrandHits,
                topStreaker: topStreaker ? { username: topStreaker.username, streak: topStreaker.streak } : null,
            },
        };
    } catch (error) {
        console.error('[DailyCheckin] getStats error:', error);
        return { success: false, error: 'Failed to load stats' };
    }
}

// ─── GET Leaderboard ─────────────────────────────────────────────────────────

export async function getDailyCheckinLeaderboard(limit = 10) {
    try {
        await connectMongo();
        const leaderboard = await DailyCheckinClaim.aggregate([
            {
                $group: {
                    _id: '$userId',
                    username: { $last: '$username' },
                    totalEarned: { $sum: '$totalReward' },
                    totalClaims: { $sum: 1 },
                    maxStreak: { $max: '$streak' },
                },
            },
            { $sort: { totalEarned: -1 } },
            { $limit: limit },
        ]);

        return { success: true, data: JSON.parse(JSON.stringify(leaderboard)) };
    } catch (error) {
        console.error('[DailyCheckin] getLeaderboard error:', error);
        return { success: false, error: 'Failed to load leaderboard', data: [] };
    }
}
