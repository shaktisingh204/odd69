import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DailyCheckinConfig, DailyCheckinConfigDocument } from './schemas/daily-checkin-config.schema';
import { DailyCheckinClaim, DailyCheckinClaimDocument } from './schemas/daily-checkin-claim.schema';
import { PrismaService } from '../prisma.service';

const DEFAULT_CONFIG = {
    configKey: 'default',
    enabled: true,
    scheduleType: 'daily',
    customIntervalDays: 1,
    rewardMode: 'fixed',
    fixedRewards: [10, 20, 30, 50, 75, 100, 200],
    randomMin: [5, 10, 15, 25, 35, 50, 100],
    randomMax: [20, 40, 60, 100, 150, 200, 500],
    currency: 'INR',
    walletTarget: 'MAIN',
    requiresDeposit: true,
    minDepositAmount: 0,
    streakResetOnMiss: false,
    cycleDays: 7,
    milestoneMultipliers: { '7': 2, '30': 5 },
    maxDailyClaimsPerUser: 1,
    maxTotalRewardPerUser: 0,
    activeFrom: null,
    activeTo: null,
    updatedBy: 'system',
    note: '',
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

@Injectable()
export class DailyCheckinService {
    constructor(
        @InjectModel(DailyCheckinConfig.name)
        private readonly configModel: Model<DailyCheckinConfigDocument>,
        @InjectModel(DailyCheckinClaim.name)
        private readonly claimModel: Model<DailyCheckinClaimDocument>,
        private readonly prisma: PrismaService,
    ) {}

    // ─── Config ──────────────────────────────────────────────────────────

    async getConfig(): Promise<DailyCheckinConfigDocument> {
        let config = await this.configModel.findOne({ configKey: 'default' }).exec();
        if (!config) {
            config = await this.configModel.create(DEFAULT_CONFIG);
        }
        return config;
    }

    async getEnabledStatus(): Promise<{ enabled: boolean }> {
        const config = await this.configModel
            .findOne({ configKey: 'default' })
            .select('enabled')
            .lean()
            .exec();
        return { enabled: config?.enabled ?? true };
    }

    async getFullConfig() {
        const config = await this.getConfig();
        return config.toObject();
    }

    // ─── User Status ─────────────────────────────────────────────────────

    async getUserStatus(userId: number) {
        const config = await this.getConfig();
        const today = this.getTodayStr();

        // Get user's last claim
        const lastClaim = await this.claimModel
            .findOne({ userId })
            .sort({ createdAt: -1 })
            .lean()
            .exec();

        // Calculate streak
        const yesterday = this.getDateStr(-1);
        let streak = 0;
        let canClaimToday = true;

        if (lastClaim) {
            if (lastClaim.claimDate === today) {
                canClaimToday = false;
                streak = lastClaim.streak;
            } else if (lastClaim.claimDate === yesterday) {
                streak = lastClaim.streak;
            } else if (config.streakResetOnMiss) {
                streak = 0;
            } else {
                streak = lastClaim.streak;
            }
        }

        const cycleDay = streak === 0 ? 1 : ((streak) % config.cycleDays) + 1;

        // Build rewards array
        const rewards = [];
        for (let i = 0; i < config.cycleDays; i++) {
            const day = i + 1;
            const reward = config.rewardMode === 'fixed'
                ? (config.fixedRewards[i] || 0)
                : Math.round((config.randomMin[i] + config.randomMax[i]) / 2);

            rewards.push({
                day,
                reward,
                currency: config.currency,
                claimed: canClaimToday ? day < cycleDay : day <= cycleDay,
                isCurrent: canClaimToday && day === cycleDay,
            });
        }

        // Total earned
        const totalEarnedResult = await this.claimModel.aggregate([
            { $match: { userId } },
            { $group: { _id: null, total: { $sum: '$totalReward' } } },
        ]);
        const totalEarned = totalEarnedResult[0]?.total || 0;

        // Get unlocked achievements
        const allClaims = await this.claimModel.find({ userId }).lean().exec();
        const unlockedAchievements = new Set<string>();
        allClaims.forEach(c => c.achievementsUnlocked?.forEach(a => unlockedAchievements.add(a)));

        // Countdown to next claim (milliseconds)
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const countdownMs = tomorrow.getTime() - now.getTime();

        return {
            streak,
            canClaimToday,
            cycleDay,
            rewards,
            totalEarned,
            lastClaimDate: lastClaim?.claimDate || null,
            unlockedAchievements: Array.from(unlockedAchievements),
            countdownMs,
            config: {
                cycleDays: config.cycleDays,
                currency: config.currency,
                spinWheelEnabled: config.spinWheelEnabled,
                spinWheelSlices: config.spinWheelSlices,
                vipMultiplierEnabled: config.vipMultiplierEnabled,
                luckyJackpotEnabled: config.luckyJackpotEnabled,
                weeklyMegaRewardEnabled: config.weeklyMegaRewardEnabled,
                weeklyMegaStreakRequired: config.weeklyMegaStreakRequired,
                monthlyGrandPrizeEnabled: config.monthlyGrandPrizeEnabled,
                monthlyGrandPrizeStreakRequired: config.monthlyGrandPrizeStreakRequired,
                achievementsEnabled: config.achievementsEnabled,
                achievements: config.achievements,
                leaderboardEnabled: config.leaderboardEnabled,
                referralBonusEnabled: config.referralBonusEnabled,
                faqs: config.faqs || [],
            },
        };
    }

    // ─── Claim Reward ────────────────────────────────────────────────────

    async claimReward(userId: number, useSpinWheel = false) {
        const config = await this.getConfig();
        if (!config.enabled) throw new BadRequestException('Daily rewards are currently disabled');

        // Check active window
        const now = new Date();
        if (config.activeFrom && now < new Date(config.activeFrom)) {
            throw new BadRequestException('Daily rewards are not active yet');
        }
        if (config.activeTo && now > new Date(config.activeTo)) {
            throw new BadRequestException('Daily rewards period has ended');
        }

        const today = this.getTodayStr();

        // Check if already claimed
        const existingClaim = await this.claimModel.findOne({ userId, claimDate: today }).exec();
        if (existingClaim) throw new BadRequestException('Already claimed today');

        // Get user info from Prisma
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true, username: true, balance: true, fiatBonus: true,
                referrerId: true, role: true,
            },
        });
        if (!user) throw new BadRequestException('User not found');

        // Check deposit requirement
        if (config.requiresDeposit) {
            const depositCount = await this.prisma.transaction.count({
                where: { userId, type: 'DEPOSIT', status: 'COMPLETED' },
            });
            if (depositCount === 0) throw new BadRequestException('You must make a deposit first');
        }

        // Calculate streak
        const yesterday = this.getDateStr(-1);
        const lastClaim = await this.claimModel
            .findOne({ userId })
            .sort({ createdAt: -1 })
            .lean()
            .exec();

        let streak = 1;
        if (lastClaim) {
            if (lastClaim.claimDate === yesterday) {
                streak = lastClaim.streak + 1;
            } else if (!config.streakResetOnMiss) {
                streak = lastClaim.streak + 1;
            }
        }

        const cycleDay = ((streak - 1) % config.cycleDays) + 1;

        // ── Calculate base reward ────────────────────────────────────────
        let baseReward = 0;
        let rewardType = 'fixed';
        let spinWheelSlice: string | null = null;

        if (useSpinWheel && config.spinWheelEnabled) {
            // Spin wheel - weighted random selection
            const result = this.spinWheel(config.spinWheelSlices);
            baseReward = result.value;
            spinWheelSlice = result.label;
            rewardType = 'spin_wheel';
        } else if (config.rewardMode === 'random') {
            const min = config.randomMin[cycleDay - 1] || 5;
            const max = config.randomMax[cycleDay - 1] || 20;
            baseReward = Math.floor(Math.random() * (max - min + 1)) + min;
            rewardType = 'random';
        } else {
            baseReward = config.fixedRewards[cycleDay - 1] || 10;
            rewardType = 'fixed';
        }

        // ── VIP Multiplier ───────────────────────────────────────────────
        let vipMultiplier = 1;
        if (config.vipMultiplierEnabled) {
            const vipApp = await this.prisma.vipApplication.findFirst({
                where: { userId, status: 'APPROVED' },
                orderBy: { createdAt: 'desc' },
            });
            if (vipApp) {
                // VIP approved users get GOLD tier multiplier by default
                vipMultiplier = config.vipTierMultipliers?.['GOLD'] || 2;
            }
        }

        // ── Milestone Multiplier ─────────────────────────────────────────
        let milestoneMultiplier = 1;
        if (config.milestoneMultipliers) {
            const ms = config.milestoneMultipliers[String(streak)];
            if (ms) milestoneMultiplier = ms;
        }

        // ── Lucky Jackpot ────────────────────────────────────────────────
        let jackpotAmount = 0;
        if (config.luckyJackpotEnabled) {
            const roll = Math.random() * 100;
            if (roll < config.luckyJackpotChancePercent) {
                jackpotAmount = config.luckyJackpotAmount;
            }
        }

        // ── Referral Bonus ───────────────────────────────────────────────
        let referralBonus = 0;
        if (config.referralBonusEnabled && user.referrerId) {
            const referrerActiveToday = await this.claimModel.findOne({
                userId: user.referrerId,
                claimDate: today,
            }).exec();
            if (referrerActiveToday) {
                referralBonus = Math.min(
                    Math.round(baseReward * (config.referralBonusPercent / 100)),
                    config.referralBonusMaxPerDay,
                );
            }
        }

        // ── Weekly Mega Reward ───────────────────────────────────────────
        let weeklyMegaClaimed = false;
        let weeklyMegaAmount = 0;
        if (config.weeklyMegaRewardEnabled && streak > 0 && streak % config.weeklyMegaStreakRequired === 0) {
            weeklyMegaClaimed = true;
            weeklyMegaAmount = config.weeklyMegaRewardAmount;
        }

        // ── Monthly Grand Prize ──────────────────────────────────────────
        let monthlyGrandClaimed = false;
        let monthlyGrandAmount = 0;
        if (config.monthlyGrandPrizeEnabled && streak > 0 && streak % config.monthlyGrandPrizeStreakRequired === 0) {
            monthlyGrandClaimed = true;
            monthlyGrandAmount = config.monthlyGrandPrizeAmount;
        }

        // ── Calculate total ──────────────────────────────────────────────
        let totalReward = Math.round(
            (baseReward * vipMultiplier * milestoneMultiplier)
            + referralBonus
            + jackpotAmount
            + weeklyMegaAmount
            + monthlyGrandAmount
        );

        // Check max total reward limit
        if (config.maxTotalRewardPerUser > 0) {
            const totalEarnedResult = await this.claimModel.aggregate([
                { $match: { userId } },
                { $group: { _id: null, total: { $sum: '$totalReward' } } },
            ]);
            const alreadyEarned = totalEarnedResult[0]?.total || 0;
            const remaining = config.maxTotalRewardPerUser - alreadyEarned;
            if (remaining <= 0) throw new BadRequestException('Maximum total reward limit reached');
            totalReward = Math.min(totalReward, remaining);
        }

        // ── Check achievements ───────────────────────────────────────────
        const achievementsUnlocked: string[] = [];
        if (config.achievementsEnabled) {
            const previouslyUnlocked = new Set<string>();
            const prevClaims = await this.claimModel.find({ userId }).select('achievementsUnlocked').lean().exec();
            prevClaims.forEach(c => c.achievementsUnlocked?.forEach(a => previouslyUnlocked.add(a)));

            const totalEarnedAfter = (await this.claimModel.aggregate([
                { $match: { userId } },
                { $group: { _id: null, total: { $sum: '$totalReward' } } },
            ]))[0]?.total || 0;
            const projectedTotal = totalEarnedAfter + totalReward;

            for (const ach of config.achievements) {
                if (previouslyUnlocked.has(ach.id)) continue;
                if (ach.streakRequired && streak >= ach.streakRequired) {
                    achievementsUnlocked.push(ach.id);
                    totalReward += ach.reward;
                }
                if (ach.totalEarnedRequired && projectedTotal >= ach.totalEarnedRequired) {
                    achievementsUnlocked.push(ach.id);
                    totalReward += ach.reward;
                }
            }
        }

        // ── Credit wallet ────────────────────────────────────────────────
        if (config.walletTarget === 'BONUS') {
            await this.prisma.user.update({
                where: { id: userId },
                data: { fiatBonus: { increment: totalReward } },
            });
        } else {
            await this.prisma.user.update({
                where: { id: userId },
                data: { balance: { increment: totalReward } },
            });
        }

        // ── Create transaction record ────────────────────────────────────
        await this.prisma.transaction.create({
            data: {
                userId,
                type: 'BONUS',
                amount: totalReward,
                status: 'COMPLETED',
                remarks: `Daily reward - Day ${cycleDay} (Streak: ${streak})`,
                transactionId: `daily-reward-${userId}-${today}`,
            },
        });

        // ── Save claim record ────────────────────────────────────────────
        const claim = await this.claimModel.create({
            userId,
            username: user.username || `User${userId}`,
            cycleDay,
            streak,
            baseReward,
            vipMultiplier,
            milestoneMultiplier,
            referralBonus,
            jackpotAmount,
            totalReward,
            walletTarget: config.walletTarget,
            rewardType,
            spinWheelSlice,
            achievementsUnlocked,
            weeklyMegaClaimed,
            weeklyMegaAmount,
            monthlyGrandClaimed,
            monthlyGrandAmount,
            currency: config.currency,
            claimDate: today,
        });

        return {
            success: true,
            reward: totalReward,
            baseReward,
            vipMultiplier,
            milestoneMultiplier,
            referralBonus,
            jackpotAmount,
            weeklyMegaClaimed,
            weeklyMegaAmount,
            monthlyGrandClaimed,
            monthlyGrandAmount,
            achievementsUnlocked,
            streak,
            cycleDay,
            rewardType,
            spinWheelSlice,
            currency: config.currency,
        };
    }

    // ─── Leaderboard ─────────────────────────────────────────────────────

    async getLeaderboard(limit = 10) {
        const config = await this.getConfig();
        if (!config.leaderboardEnabled) return [];

        const leaderboard = await this.claimModel.aggregate([
            {
                $group: {
                    _id: '$userId',
                    username: { $last: '$username' },
                    totalEarned: { $sum: '$totalReward' },
                    totalClaims: { $sum: 1 },
                    maxStreak: { $max: '$streak' },
                    lastClaim: { $max: '$claimDate' },
                },
            },
            { $sort: { totalEarned: -1 } },
            { $limit: limit },
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    username: 1,
                    totalEarned: 1,
                    totalClaims: 1,
                    maxStreak: 1,
                    lastClaim: 1,
                },
            },
        ]);

        return leaderboard;
    }

    // ─── Reward History ──────────────────────────────────────────────────

    async getRewardHistory(userId: number, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [claims, total] = await Promise.all([
            this.claimModel
                .find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            this.claimModel.countDocuments({ userId }),
        ]);

        return { claims, total, page, totalPages: Math.ceil(total / limit) };
    }

    // ─── Admin: All Claims ───────────────────────────────────────────────

    async getAllClaims(page = 1, limit = 50, search?: string) {
        const query: any = {};
        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { userId: isNaN(Number(search)) ? -1 : Number(search) },
            ];
        }

        const [claims, total] = await Promise.all([
            this.claimModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
            this.claimModel.countDocuments(query),
        ]);

        return { claims, total, page, totalPages: Math.ceil(total / limit) };
    }

    // ─── Admin: Stats ────────────────────────────────────────────────────

    async getStats() {
        const today = this.getTodayStr();
        const [
            totalClaims,
            todayClaims,
            totalRewarded,
            todayRewarded,
            uniqueUsers,
            jackpotHits,
            weeklyMegaHits,
            monthlyGrandHits,
        ] = await Promise.all([
            this.claimModel.countDocuments(),
            this.claimModel.countDocuments({ claimDate: today }),
            this.claimModel.aggregate([{ $group: { _id: null, total: { $sum: '$totalReward' } } }]),
            this.claimModel.aggregate([{ $match: { claimDate: today } }, { $group: { _id: null, total: { $sum: '$totalReward' } } }]),
            this.claimModel.distinct('userId').then(ids => ids.length),
            this.claimModel.countDocuments({ jackpotAmount: { $gt: 0 } }),
            this.claimModel.countDocuments({ weeklyMegaClaimed: true }),
            this.claimModel.countDocuments({ monthlyGrandClaimed: true }),
        ]);

        return {
            totalClaims,
            todayClaims,
            totalRewarded: totalRewarded[0]?.total || 0,
            todayRewarded: todayRewarded[0]?.total || 0,
            uniqueUsers,
            jackpotHits,
            weeklyMegaHits,
            monthlyGrandHits,
        };
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private getTodayStr(): string {
        return new Date().toISOString().split('T')[0];
    }

    private getDateStr(offsetDays: number): string {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        return d.toISOString().split('T')[0];
    }

    private spinWheel(slices: { label: string; value: number; probability: number }[]) {
        const totalProb = slices.reduce((sum, s) => sum + s.probability, 0);
        let roll = Math.random() * totalProb;
        for (const slice of slices) {
            roll -= slice.probability;
            if (roll <= 0) return slice;
        }
        return slices[0];
    }
}
