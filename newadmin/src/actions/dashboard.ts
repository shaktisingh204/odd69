'use server'

import { prisma } from '@/lib/db';
import connectMongo from '@/lib/mongo';
import { Bet } from '@/models/MongoModels';

// ─── Main Dashboard Stats (all from Prisma / PostgreSQL) ────────────────────

const completedDepositStatuses = ['APPROVED', 'COMPLETED'];

// Methods that count as "manual adjustments" (not real gateway flow)
const manualPaymentMethods = ['MAIN_WALLET', 'Manual Deposit (Admin)', 'Manual Bank Transfer', 'Cash', 'UPI', 'Crypto (Manual)', 'Agent Deposit', 'Adjustment', 'Other'];

type DashboardOverviewData = {
    recentTransactions: DashboardOverviewRecentTransaction[];
    wallets: {
        totalUserBalance: number;
        totalUserExposure: number;
        mainWalletExposure: number;
        bonusWalletExposure: number;
        totalUserBonus: number;
    };
    financials: {
        ggr: number;
        totalDeposits: number;
        depositCount: number;
        gatewayDeposits: number;
        gatewayCount: number;
        manualDeposits: number;
        manualCount: number;
        cryptoDeposits: number;
        cryptoCount: number;
        totalWithdrawals: number;
        withdrawalCount: number;
        pendingWithdrawals: number;
        pendingWithdrawalsAmount: number;
        avgDeposit: number;
        avgWithdrawal: number;
    };
    users: {
        totalUsers: number;
        newUsers: number;
        activeUsers: number;
        uniqueDepositors: number;
        ftdCount: number;
        ftdDepositAmount: number;
        ftdRate: number;
    };
    bets: {
        totalBets: number;
        pendingBets: number;
        wonBets: number;
        lostBets: number;
        betVolume: number;
    };
    chart: Array<{
        date: string;
        deposits: number;
        withdrawals: number;
        ggr: number;
    }>;
};

type DashboardOverviewRecentTransaction = {
    id: number;
    type: string;
    amount: number;
    status: string;
    createdAt: string;
    user?: {
        username?: string | null;
        email?: string | null;
    } | null;
};

const emptyDashboardOverview = (): DashboardOverviewData => ({
    wallets: {
        totalUserBalance: 0,
        totalUserExposure: 0,
        mainWalletExposure: 0,
        bonusWalletExposure: 0,
        totalUserBonus: 0,
    },
    financials: {
        ggr: 0,
        totalDeposits: 0,
        depositCount: 0,
        gatewayDeposits: 0,
        gatewayCount: 0,
        manualDeposits: 0,
        manualCount: 0,
        cryptoDeposits: 0,
        cryptoCount: 0,
        totalWithdrawals: 0,
        withdrawalCount: 0,
        pendingWithdrawals: 0,
        pendingWithdrawalsAmount: 0,
        avgDeposit: 0,
        avgWithdrawal: 0,
    },
    users: {
        totalUsers: 0,
        newUsers: 0,
        activeUsers: 0,
        uniqueDepositors: 0,
        ftdCount: 0,
        ftdDepositAmount: 0,
        ftdRate: 0,
    },
    bets: {
        totalBets: 0,
        pendingBets: 0,
        wonBets: 0,
        lostBets: 0,
        betVolume: 0,
    },
    chart: [],
    recentTransactions: [],
});

function normalizeRange(startDate?: Date | string, endDate?: Date | string) {
    let start: Date;
    let end: Date;

    const getISTDateStr = (d: Date) => {
        const ist = new Date(d.getTime() + 5.5 * 3600000);
        return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
    };

    if (endDate && typeof endDate === 'string') {
        end = new Date(`${endDate}T23:59:59.999+05:30`);
    } else if (endDate) {
        end = new Date(endDate);
    } else {
        const nowStr = getISTDateStr(new Date());
        end = new Date(`${nowStr}T23:59:59.999+05:30`);
    }

    if (startDate && typeof startDate === 'string') {
        start = new Date(`${startDate}T00:00:00.000+05:30`);
    } else if (startDate) {
        start = new Date(startDate);
    } else {
        const prev = new Date(end.getTime() - 6 * 24 * 3600000);
        const prevStr = getISTDateStr(prev);
        start = new Date(`${prevStr}T00:00:00.000+05:30`);
    }

    if (start > end) {
        return { start: end, end: start };
    }

    return { start, end };
}

function toDateKey(date: Date | string) {
    if (typeof date === 'string') return date;
    const offsetDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    const year = offsetDate.getUTCFullYear();
    const month = String(offsetDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(offsetDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatChartLabel(date: Date, totalDays: number) {
    const ist = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    return ist.toLocaleDateString('en-IN', {
        timeZone: 'UTC',
        ...(totalDays > 14 ? { month: 'short', day: 'numeric' } : { weekday: 'short', day: 'numeric' })
    });
}

function isManualDepositTransaction(paymentMethod?: string | null, paymentDetails?: unknown) {
    const gateway = paymentDetails && typeof paymentDetails === 'object'
        ? (paymentDetails as Record<string, unknown>).gateway
        : null;

    return manualPaymentMethods.includes(paymentMethod || '') || gateway === 'admin_manual';
}

function isCryptoDepositTransaction(paymentMethod?: string | null) {
    const method = String(paymentMethod || '').toLowerCase();
    return (
        method.startsWith('crypto') ||
        method === 'nowpayments' ||
        method.includes('nowpayments') ||
        method.includes('bitcoin') ||
        method.includes('usdt') ||
        method.includes('eth')
    );
}

export async function getDashboardStats() {
    try {
        const now = new Date();
        const istNow = new Date(now.getTime() + 5.5 * 3600000);
        const todayStr = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}-${String(istNow.getUTCDate()).padStart(2, '0')}`;
        const todayStart = new Date(`${todayStr}T00:00:00.000+05:30`);

        const weekStart = new Date(todayStart.getTime() - 7 * 24 * 3600000);

        const [
            totalUsers,
            activeUsers,
            newTodayUsers,
            newWeekUsers,

            // Deposits can land as APPROVED (gateway) or COMPLETED (manual/admin)
            totalDeposits,
            todayDeposits,

            // Withdrawals: admin approves → status = 'APPROVED'
            totalWithdrawals,
            todayWithdrawals,
            pendingWithdrawals,
            pendingWithdrawalsAmount,

            // Recent transactions
            recentTransactions,
            userWalletTotals,
        ] = await Promise.all([
            prisma.user.count({ where: { isBanned: false } }),
            prisma.user.count({ where: { isBanned: false } }),
            prisma.user.count({ where: { createdAt: { gte: todayStart }, isBanned: false } }),
            prisma.user.count({ where: { createdAt: { gte: weekStart }, isBanned: false } }),

            prisma.transaction.aggregate({
                where: { type: 'DEPOSIT', status: { in: completedDepositStatuses }, user: { isBanned: false } },
                _sum: { amount: true },
                _count: true,
            }),
            prisma.transaction.aggregate({
                where: {
                    type: 'DEPOSIT',
                    status: { in: completedDepositStatuses },
                    createdAt: { gte: todayStart },
                    user: { isBanned: false },
                },
                _sum: { amount: true },
            }),

            prisma.transaction.aggregate({
                where: { type: 'WITHDRAWAL', status: { in: ['APPROVED', 'COMPLETED', 'PROCESSED'] }, user: { isBanned: false } },
                _sum: { amount: true },
                _count: true,
            }),
            prisma.transaction.aggregate({
                where: { type: 'WITHDRAWAL', status: { in: ['APPROVED', 'COMPLETED', 'PROCESSED'] }, createdAt: { gte: todayStart }, user: { isBanned: false } },
                _sum: { amount: true },
            }),
            prisma.transaction.count({
                where: { type: 'WITHDRAWAL', status: 'PENDING', user: { isBanned: false } },
            }),
            prisma.transaction.aggregate({
                where: { type: 'WITHDRAWAL', status: 'PENDING', user: { isBanned: false } },
                _sum: { amount: true },
            }),

            prisma.transaction.findMany({
                where: { user: { isBanned: false } },
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { username: true, email: true } } },
            }),

            prisma.user.aggregate({
                where: { isBanned: false },
                _sum: {
                    balance: true,
                    exposure: true,
                    fiatBonus: true,
                    casinoBonus: true,
                    sportsBonus: true,
                },
            }),
        ]);

        const depositsTotal = totalDeposits._sum.amount || 0;
        const withdrawalsTotal = totalWithdrawals._sum.amount || 0;
        const ggr = depositsTotal - withdrawalsTotal;
        const totalUserBonus =
            Number(userWalletTotals._sum.fiatBonus || 0) +
            Number(userWalletTotals._sum.casinoBonus || 0) +
            Number(userWalletTotals._sum.sportsBonus || 0);

        const totalUserExposure = Number(userWalletTotals._sum.exposure || 0);
        let mainWalletExposure = totalUserExposure;
        let bonusWalletExposure = 0;

        try {
            await connectMongo();
            const bannedUsers = await prisma.user.findMany({ where: { isBanned: true }, select: { id: true } });
            const bannedUserIds = bannedUsers.map(u => u.id);
            const exposureSplit = await Bet.aggregate([
                { $match: { status: 'PENDING', userId: { $nin: bannedUserIds } } },
                { $group: { 
                    _id: null, 
                    bonusSum: { $sum: "$bonusStakeAmount" } 
                } }
            ]);
            if (exposureSplit && exposureSplit.length > 0) {
                bonusWalletExposure = exposureSplit[0].bonusSum || 0;
                mainWalletExposure = Math.max(0, totalUserExposure - bonusWalletExposure);
            }
        } catch (e) {
            console.error('Failed to fetch exposure split from Mongo', e);
        }

        return {
            success: true,
            data: {
                // User stats
                totalUsers,
                activeUsers,
                newTodayUsers,
                newWeekUsers,
                totalUserBalance: Number(userWalletTotals._sum.balance || 0),
                totalUserExposure,
                mainWalletExposure,
                bonusWalletExposure,
                totalUserBonus,

                // Financial
                ggr,
                totalDeposits: depositsTotal,
                todayDeposits: todayDeposits._sum.amount || 0,
                totalWithdrawals: withdrawalsTotal,
                todayWithdrawals: todayWithdrawals._sum.amount || 0,
                pendingWithdrawals,
                pendingWithdrawalsAmount: pendingWithdrawalsAmount._sum.amount || 0,
                depositCount: totalDeposits._count,
                withdrawalCount: totalWithdrawals._count,

                // Transactions
                recentTransactions: JSON.parse(JSON.stringify(recentTransactions)),
            }
        };
    } catch (error) {
        console.error('getDashboardStats error:', error);
        return {
            success: false,
            data: {
                totalUsers: 0, activeUsers: 0, newTodayUsers: 0, newWeekUsers: 0,
                totalUserBalance: 0, totalUserExposure: 0, totalUserBonus: 0,
                ggr: 0, totalDeposits: 0, todayDeposits: 0,
                totalWithdrawals: 0, todayWithdrawals: 0,
                pendingWithdrawals: 0, pendingWithdrawalsAmount: 0,
                depositCount: 0, withdrawalCount: 0,
                recentTransactions: [],
            }
        };
    }
}

// ─── Deposit Breakdown: Gateway / Manual / Crypto + unique depositors ─────────

// All paymentMethod patterns that indicate a crypto transaction
// Matches: CRYPTO, CRYPTO_WALLET, CRYPTO_USDTTRC20, CRYPTO_BTC, NOWPAYMENTS, etc.
const CRYPTO_METHOD_FILTER = {
    OR: [
        { paymentMethod: { startsWith: 'CRYPTO' } },
        { paymentMethod: { equals: 'NOWPAYMENTS' } },
        { paymentMethod: { contains: 'nowpayments' } },
        { paymentMethod: { contains: 'bitcoin' } },
        { paymentMethod: { contains: 'usdt' } },
        { paymentMethod: { contains: 'eth' } },
    ],
};

export async function getDepositBreakdown(startDate?: Date, endDate?: Date) {
    try {
        const dateFilter = startDate && endDate
            ? { gte: startDate, lte: endDate }
            : undefined;

        const where = {
            type: 'DEPOSIT',
            status: { in: completedDepositStatuses },
            user: { isBanned: false },
            ...(dateFilter ? { createdAt: dateFilter } : {}),
        };

        const [
            allDeposits,
            manualMethodDeposits,
            adminManualGatewayDeposits,
            cryptoDeposits,
            uniqueDepositorRows,
        ] = await Promise.all([
            // All approved deposits
            prisma.transaction.aggregate({
                where,
                _sum: { amount: true },
                _count: true,
            }),
            // Manual by paymentMethod
            prisma.transaction.aggregate({
                where: {
                    ...where,
                    paymentMethod: { in: manualPaymentMethods },
                },
                _sum: { amount: true },
                _count: true,
            }),
            // Manual by gateway = admin_manual inside paymentDetails
            prisma.transaction.findMany({
                where: {
                    ...where,
                    paymentDetails: { path: ['gateway'], equals: 'admin_manual' },
                },
                select: { amount: true },
            }),
            // Crypto deposits — match any CRYPTO_* or NOWPAYMENTS variant
            prisma.transaction.aggregate({
                where: {
                    ...where,
                    ...CRYPTO_METHOD_FILTER,
                },
                _sum: { amount: true },
                _count: true,
            }),
            // Unique depositors in this range
            prisma.transaction.findMany({
                where,
                distinct: ['userId'],
                select: { userId: true },
            }),
        ]);

        const adminManualSum = adminManualGatewayDeposits.reduce((s, t) => s + Number(t.amount || 0), 0);
        const manualMethodSum = Number(manualMethodDeposits._sum.amount || 0);

        // Manual = union of method-based + gateway-based — deduplicate by taking larger
        const manualTotal = Math.max(manualMethodSum, adminManualSum);
        const manualCount = Math.max(manualMethodDeposits._count, adminManualGatewayDeposits.length);

        const cryptoTotal = Number(cryptoDeposits._sum.amount || 0);
        const cryptoCount = cryptoDeposits._count;

        const totalAll = Number(allDeposits._sum.amount || 0);
        const totalCount = allDeposits._count;

        // Gateway = total minus manual (crypto already counted inside gateway flow)
        const gatewayTotal = Math.max(0, totalAll - manualTotal);
        const gatewayCount = Math.max(0, totalCount - manualCount);

        return {
            success: true,
            data: {
                gatewayDeposits: gatewayTotal,
                gatewayCount,
                manualDeposits: manualTotal,
                manualCount,
                cryptoDeposits: cryptoTotal,
                cryptoCount,
                totalDeposits: totalAll,
                totalCount,
                uniqueDepositors: uniqueDepositorRows.length,
            },
        };
    } catch (e) {
        console.error('getDepositBreakdown error:', e);
        return {
            success: false,
            data: {
                gatewayDeposits: 0, gatewayCount: 0,
                manualDeposits: 0, manualCount: 0,
                cryptoDeposits: 0, cryptoCount: 0,
                totalDeposits: 0, totalCount: 0,
                uniqueDepositors: 0,
            },
        };
    }
}

// ─── Date-range aware withdrawal stats ───────────────────────────────────────

export async function getWithdrawalStatsByRange(startDate: Date, endDate: Date) {
    try {
        const [total, count] = await Promise.all([
            prisma.transaction.aggregate({
                where: {
                    type: 'WITHDRAWAL',
                    status: 'APPROVED',
                    createdAt: { gte: startDate, lte: endDate },
                    user: { isBanned: false },
                },
                _sum: { amount: true },
            }),
            prisma.transaction.count({
                where: {
                    type: 'WITHDRAWAL',
                    status: 'APPROVED',
                    createdAt: { gte: startDate, lte: endDate },
                    user: { isBanned: false },
                },
            }),
        ]);
        return {
            success: true,
            data: { total: Number(total._sum.amount || 0), count },
        };
    } catch {
        return { success: false, data: { total: 0, count: 0 } };
    }
}

// ─── Bet Stats (from MongoDB) ─────────────────────────────────────────────────

export async function getBetStats() {
    try {
        await connectMongo();
        const bannedUsers = await prisma.user.findMany({ where: { isBanned: true }, select: { id: true } });
        const bannedUserIds = bannedUsers.map(u => u.id);
        const [totalBets, pendingBets, wonBets, lostBets, betVolume] = await Promise.all([
            Bet.countDocuments({ userId: { $nin: bannedUserIds } }),
            Bet.countDocuments({ status: 'PENDING', userId: { $nin: bannedUserIds } }),
            Bet.countDocuments({ status: 'WON', userId: { $nin: bannedUserIds } }),
            Bet.countDocuments({ status: 'LOST', userId: { $nin: bannedUserIds } }),
            Bet.aggregate([
                { $match: { status: { $in: ['PENDING', 'WON', 'LOST', 'SETTLED'] }, userId: { $nin: bannedUserIds } } },
                { $group: { _id: null, total: { $sum: '$stake' } } }
            ]),
        ]);
        return {
            success: true,
            data: {
                totalBets, pendingBets, wonBets, lostBets,
                betVolume: betVolume[0]?.total || 0,
            }
        };
    } catch {
        return {
            success: false,
            data: { totalBets: 0, pendingBets: 0, wonBets: 0, lostBets: 0, betVolume: 0 }
        };
    }
}

// ─── Weekly Revenue Chart ─────────────────────────────────────────────────────

export async function getWeeklyRevenueData() {
    try {
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const start = new Date();
            start.setDate(start.getDate() - i);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setHours(23, 59, 59, 999);

            const [dep, wd] = await Promise.all([
                prisma.transaction.aggregate({
                    where: {
                        type: 'DEPOSIT',
                        status: { in: completedDepositStatuses },
                        createdAt: { gte: start, lte: end },
                        user: { isBanned: false }
                    },
                    _sum: { amount: true }
                }),
                prisma.transaction.aggregate({
                    where: { type: 'WITHDRAWAL', status: { in: ['APPROVED', 'COMPLETED', 'PROCESSED'] }, createdAt: { gte: start, lte: end }, user: { isBanned: false } },
                    _sum: { amount: true }
                }),
            ]);

            data.push({
                date: start.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }),
                deposits: dep._sum.amount || 0,
                withdrawals: wd._sum.amount || 0,
                ggr: (dep._sum.amount || 0) - (wd._sum.amount || 0),
            });
        }
        return data;
    } catch {
        return [];
    }
}

export async function getDashboardOverviewByRange(startDate?: Date | string, endDate?: Date | string) {
    try {
        const { start, end } = normalizeRange(startDate, endDate);
        const chartSeed = new Map<string, { date: string; deposits: number; withdrawals: number; ggr: number }>();
        const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);

        let currentIter = new Date(start.getTime()); // this is 00:00:00 IST
        while (currentIter <= end) {
            chartSeed.set(toDateKey(currentIter), {
                date: formatChartLabel(currentIter, totalDays),
                deposits: 0,
                withdrawals: 0,
                ggr: 0,
            });
            currentIter = new Date(currentIter.getTime() + 24 * 60 * 60 * 1000);
        }

        const [
            totalUsers,
            newUserRows,
            depositRows,
            withdrawalRows,
            pendingWithdrawalAgg,
            recentTransactions,
            firstDepositGroups,
            userWalletTotals,
        ] = await Promise.all([
            prisma.user.count({ where: { isBanned: false } }),
            prisma.user.findMany({
                where: { createdAt: { gte: start, lte: end }, isBanned: false },
                select: { id: true },
            }),
            prisma.transaction.findMany({
                where: {
                    type: 'DEPOSIT',
                    status: { in: completedDepositStatuses },
                    createdAt: { gte: start, lte: end },
                    user: { isBanned: false }
                },
                select: {
                    userId: true,
                    amount: true,
                    paymentMethod: true,
                    paymentDetails: true,
                    createdAt: true,
                },
            }),
            prisma.transaction.findMany({
                where: {
                    type: 'WITHDRAWAL',
                    status: 'APPROVED',
                    createdAt: { gte: start, lte: end },
                    user: { isBanned: false }
                },
                select: {
                    userId: true,
                    amount: true,
                    createdAt: true,
                },
            }),
            prisma.transaction.aggregate({
                where: {
                    type: 'WITHDRAWAL',
                    status: 'PENDING',
                    createdAt: { gte: start, lte: end },
                    user: { isBanned: false }
                },
                _count: true,
                _sum: { amount: true },
            }),
            prisma.transaction.findMany({
                where: { createdAt: { gte: start, lte: end }, user: { isBanned: false } },
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            username: true,
                            email: true,
                        },
                    },
                },
            }),
            prisma.transaction.groupBy({
                by: ['userId'],
                where: {
                    type: 'DEPOSIT',
                    status: { in: completedDepositStatuses },
                    createdAt: { lte: end },
                    user: { isBanned: false }
                },
                _min: { createdAt: true },
            }),
            prisma.user.aggregate({
                where: { isBanned: false },
                _sum: {
                    balance: true,
                    exposure: true,
                    fiatBonus: true,
                    casinoBonus: true,
                    sportsBonus: true,
                },
            }),
        ]);

        const overview = emptyDashboardOverview();
        const activeUserIds = new Set<number>(newUserRows.map((user) => user.id));
        const uniqueDepositorIds = new Set<number>();
        const firstDepositByUser = new Map<number, Date>();
        const countedFtdUsers = new Set<number>();
        const totalUserBalance = Number(userWalletTotals._sum.balance || 0);
        const totalUserExposure = Number(userWalletTotals._sum.exposure || 0);

        overview.users.totalUsers = totalUsers;
        overview.users.newUsers = newUserRows.length;
        overview.wallets.totalUserBalance = totalUserBalance;
        overview.wallets.totalUserExposure = totalUserExposure;
        overview.wallets.totalUserBonus =
            Number(userWalletTotals._sum.fiatBonus || 0) +
            Number(userWalletTotals._sum.casinoBonus || 0) +
            Number(userWalletTotals._sum.sportsBonus || 0);
        overview.wallets.mainWalletExposure = totalUserExposure;
        for (const entry of firstDepositGroups) {
            if (entry._min.createdAt) {
                firstDepositByUser.set(entry.userId, entry._min.createdAt);
            }
        }

        for (const deposit of depositRows) {
            const amount = Number(deposit.amount || 0);
            const depositCreatedAt = new Date(deposit.createdAt);
            const key = toDateKey(depositCreatedAt);
            const bucket = chartSeed.get(key);
            if (bucket) {
                bucket.deposits += amount;
                bucket.ggr += amount;
            }

            overview.financials.totalDeposits += amount;
            overview.financials.depositCount += 1;
            uniqueDepositorIds.add(deposit.userId);
            activeUserIds.add(deposit.userId);

            if (isManualDepositTransaction(deposit.paymentMethod, deposit.paymentDetails)) {
                overview.financials.manualDeposits += amount;
                overview.financials.manualCount += 1;
            } else {
                overview.financials.gatewayDeposits += amount;
                overview.financials.gatewayCount += 1;
            }

            if (isCryptoDepositTransaction(deposit.paymentMethod)) {
                overview.financials.cryptoDeposits += amount;
                overview.financials.cryptoCount += 1;
            }

            const firstDepositAt = firstDepositByUser.get(deposit.userId);
            if (
                firstDepositAt &&
                firstDepositAt.getTime() === depositCreatedAt.getTime() &&
                !countedFtdUsers.has(deposit.userId)
            ) {
                countedFtdUsers.add(deposit.userId);
                overview.users.ftdDepositAmount += amount;
            }
        }

        for (const withdrawal of withdrawalRows) {
            const amount = Number(withdrawal.amount || 0);
            const key = toDateKey(new Date(withdrawal.createdAt));
            const bucket = chartSeed.get(key);
            if (bucket) {
                bucket.withdrawals += amount;
                bucket.ggr -= amount;
            }

            overview.financials.totalWithdrawals += amount;
            overview.financials.withdrawalCount += 1;
            activeUserIds.add(withdrawal.userId);
        }

        overview.financials.pendingWithdrawals = pendingWithdrawalAgg._count;
        overview.financials.pendingWithdrawalsAmount = Number(pendingWithdrawalAgg._sum.amount || 0);
        overview.financials.ggr = overview.financials.totalDeposits - overview.financials.totalWithdrawals;
        overview.financials.avgDeposit = overview.financials.depositCount > 0
            ? overview.financials.totalDeposits / overview.financials.depositCount
            : 0;
        overview.financials.avgWithdrawal = overview.financials.withdrawalCount > 0
            ? overview.financials.totalWithdrawals / overview.financials.withdrawalCount
            : 0;

        overview.users.uniqueDepositors = uniqueDepositorIds.size;
        overview.users.ftdCount = firstDepositGroups.filter((entry) => {
            const firstDepositAt = entry._min.createdAt;
            return firstDepositAt && firstDepositAt >= start && firstDepositAt <= end;
        }).length;
        overview.users.ftdRate = overview.users.uniqueDepositors > 0
            ? (overview.users.ftdCount / overview.users.uniqueDepositors) * 100
            : 0;

        try {
            await connectMongo();
            const bannedUsers = await prisma.user.findMany({ where: { isBanned: true }, select: { id: true } });
            const bannedUserIds = bannedUsers.map(u => u.id);
            const [betAgg, exposureSplit] = await Promise.all([
                Bet.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: start, $lte: end },
                            userId: { $nin: bannedUserIds }
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            totalBets: { $sum: 1 },
                            pendingBets: {
                                $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] },
                            },
                            wonBets: {
                                $sum: { $cond: [{ $eq: ['$status', 'WON'] }, 1, 0] },
                            },
                            lostBets: {
                                $sum: { $cond: [{ $eq: ['$status', 'LOST'] }, 1, 0] },
                            },
                            betVolume: { $sum: '$stake' },
                            userIds: { $addToSet: '$userId' },
                        },
                    },
                ]),
                Bet.aggregate([
                    { $match: { status: 'PENDING', userId: { $nin: bannedUserIds } } },
                    {
                        $group: {
                            _id: null,
                            bonusSum: { $sum: '$bonusStakeAmount' },
                        },
                    },
                ]),
            ]);

            const rangeBets = betAgg[0];
            if (rangeBets) {
                overview.bets.totalBets = Number(rangeBets.totalBets || 0);
                overview.bets.pendingBets = Number(rangeBets.pendingBets || 0);
                overview.bets.wonBets = Number(rangeBets.wonBets || 0);
                overview.bets.lostBets = Number(rangeBets.lostBets || 0);
                overview.bets.betVolume = Number(rangeBets.betVolume || 0);

                const betUserIds = Array.isArray(rangeBets.userIds) ? rangeBets.userIds : [];
                for (const userId of betUserIds) {
                    activeUserIds.add(Number(userId));
                }
            }

            const bonusWalletExposure = Number(exposureSplit[0]?.bonusSum || 0);
            overview.wallets.bonusWalletExposure = bonusWalletExposure;
            overview.wallets.mainWalletExposure = Math.max(0, totalUserExposure - bonusWalletExposure);
        } catch (mongoError) {
            console.error('getDashboardOverviewByRange Mongo error:', mongoError);
        }

        overview.users.activeUsers = activeUserIds.size;
        overview.chart = Array.from(chartSeed.values());
        overview.recentTransactions = JSON.parse(JSON.stringify(recentTransactions));

        return {
            success: true,
            data: overview,
        };
    } catch (error) {
        console.error('getDashboardOverviewByRange error:', error);
        return {
            success: false,
            data: emptyDashboardOverview(),
        };
    }
}
