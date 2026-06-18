'use server'

import connectMongo from '@/lib/mongo';
import { prisma } from '@/lib/db';
import { Bonus } from '@/models/MongoModels';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

type DepositCurrency = 'INR' | 'CRYPTO';
type BonusDocumentShape = {
    _id: string;
    title: string;
    percentage?: number | null;
    amount?: number | null;
    maxBonus?: number | null;
    currency?: string | null;
    validFrom?: Date | string | null;
    validUntil?: Date | string | null;
    usageLimit?: number | null;
    usageCount?: number | null;
    forFirstDepositOnly?: boolean | null;
    minDeposit?: number | null;
    minDepositFiat?: number | null;
    minDepositCrypto?: number | null;
    applicableTo?: string | null;
    wageringRequirement?: number | null;
    depositWagerMultiplier?: number | null;
    expiryDays?: number | null;
};
type UserBonusRecord = {
    id: number;
    userId: number;
    bonusId: string;
    bonusCode: string;
    bonusTitle: string;
    bonusCurrency: string | null;
    applicableTo: string | null;
    bonusAmount: number;
    wageringRequired: number;
    wageringDone: number;
    status: string;
    expiresAt: Date | null;
};
type UserBonusTxClient = Prisma.TransactionClient & {
    userBonus: {
        findUnique(args: { where: { id: number } }): Promise<UserBonusRecord | null>;
        findMany(args: {
            where: {
                userId: number;
                status: string;
                expiresAt?: { lte: Date };
                applicableTo?: { in: string[] };
                bonusId?: string;
            };
        }): Promise<UserBonusRecord[]>;
        findFirst(args: {
            where: {
                userId: number;
                bonusId?: string;
                status?: string | { not: string };
                applicableTo?: { in: string[] };
            };
        }): Promise<UserBonusRecord | null>;
        create(args: { data: Record<string, unknown> }): Promise<unknown>;
        update(args: {
            where: { id: number };
            data: Record<string, unknown>;
        }): Promise<unknown>;
    };
};
type NotificationClient = typeof prisma & {
    notification: {
        create(args: {
            data: {
                userId: number;
                title: string;
                body: string;
            };
        }): Promise<unknown>;
    };
};

const withUserBonusTx = (tx: Prisma.TransactionClient) =>
    tx as unknown as UserBonusTxClient;
const prismaWithNotification = prisma as unknown as NotificationClient;

const roundCurrency = (value: number) =>
    parseFloat((Number(value || 0)).toFixed(2));

const normalizeDepositCurrency = (currency?: unknown): DepositCurrency =>
    currency === 'CRYPTO' ? 'CRYPTO' : 'INR';

const isBonusCurrencyEligible = (
    bonusCurrency?: string | null,
    depositCurrency?: DepositCurrency,
) => !bonusCurrency || bonusCurrency === 'BOTH' || bonusCurrency === depositCurrency;

const getMinimumDepositForCurrency = (
    bonus: BonusDocumentShape,
    depositCurrency: DepositCurrency,
) => {
    const legacyMinimum = roundCurrency(Number(bonus.minDeposit || 0));
    const fiatMinimum = bonus.minDepositFiat == null
        ? null
        : roundCurrency(Number(bonus.minDepositFiat || 0));
    const cryptoMinimum = bonus.minDepositCrypto == null
        ? null
        : roundCurrency(Number(bonus.minDepositCrypto || 0));

    if (depositCurrency === 'CRYPTO') return cryptoMinimum ?? legacyMinimum;
    return fiatMinimum ?? legacyMinimum;
};

const calculateBonusAmount = (
    bonus: BonusDocumentShape,
    depositAmount: number,
) => {
    let bonusAmount =
        Number(bonus?.percentage || 0) > 0
            ? (depositAmount * Number(bonus.percentage || 0)) / 100
            : Number(bonus?.amount || 0);

    const maxBonus = Number(bonus?.maxBonus || 0);
    if (maxBonus > 0) {
        bonusAmount = Math.min(bonusAmount, maxBonus);
    }

    return roundCurrency(bonusAmount);
};

const getBonusWalletField = (
    applicableTo?: string | null,
    isCrypto = false,
) => {
    if (isCrypto) return 'cryptoBonus';
    return applicableTo === 'SPORTS' ? 'sportsBonus' : 'casinoBonus';
};

const getBonusWalletLabel = (
    applicableTo?: string | null,
    isCrypto = false,
) => {
    if (isCrypto) return 'Crypto Bonus';
    return applicableTo === 'SPORTS' ? 'Sports Bonus' : 'Casino Bonus';
};

const getBonusConflictTypes = (applicableTo?: string | null) =>
    applicableTo === 'BOTH' ? ['CASINO', 'SPORTS', 'BOTH'] : [applicableTo || 'BOTH', 'BOTH'];

async function forfeitUserBonus(tx: Prisma.TransactionClient, userBonusId: number) {
    const bonusTx = withUserBonusTx(tx);
    const userBonus = await bonusTx.userBonus.findUnique({
        where: { id: userBonusId },
    });
    if (!userBonus || userBonus.status !== 'ACTIVE') return null;

    const applicableTo = userBonus.applicableTo || 'BOTH';
    const isCrypto = userBonus.bonusCurrency === 'CRYPTO';
    const bonusWalletField = getBonusWalletField(applicableTo, isCrypto);
    const wageringDone = Math.min(
        Number(userBonus.wageringDone || 0),
        Number(userBonus.wageringRequired || 0),
    );

    await bonusTx.userBonus.update({
        where: { id: userBonusId },
        data: {
            status: 'FORFEITED',
            forfeitedAt: new Date(),
        },
    });

    const userUpdate: Record<string, unknown> = {
        [bonusWalletField]: { decrement: Number(userBonus.bonusAmount || 0) },
        wageringRequired: { decrement: Number(userBonus.wageringRequired || 0) },
        wageringDone: { decrement: wageringDone },
    };

    if (applicableTo !== 'SPORTS') {
        userUpdate.casinoBonusWageringRequired = {
            decrement: Number(userBonus.wageringRequired || 0),
        };
        userUpdate.casinoBonusWageringDone = { decrement: wageringDone };
    }

    if (applicableTo === 'SPORTS') {
        userUpdate.sportsBonusWageringRequired = {
            decrement: Number(userBonus.wageringRequired || 0),
        };
        userUpdate.sportsBonusWageringDone = { decrement: wageringDone };
    }

    await tx.user.update({
        where: { id: userBonus.userId },
        data: userUpdate as Prisma.UserUpdateInput,
    });

    return userBonus;
}

async function expireOverdueUserBonuses(
    tx: Prisma.TransactionClient,
    userId: number,
) {
    const bonusTx = withUserBonusTx(tx);
    const expiredBonuses = await bonusTx.userBonus.findMany({
        where: {
            userId,
            status: 'ACTIVE',
            expiresAt: { lte: new Date() },
        },
    });

    for (const userBonus of expiredBonuses) {
        await forfeitUserBonus(tx, userBonus.id);
    }
}

async function applyEligibleDepositBonus(
    tx: Prisma.TransactionClient,
    transaction: {
        userId: number;
        amount: number;
        paymentDetails: Prisma.JsonValue | null;
    },
    approvedDepositCountBeforeThisDeposit: number,
) {
    const paymentDetails =
        transaction.paymentDetails &&
            typeof transaction.paymentDetails === 'object' &&
            !Array.isArray(transaction.paymentDetails)
            ? (transaction.paymentDetails as Record<string, unknown>)
            : {};

    const rawBonusCode =
        typeof paymentDetails.bonusCode === 'string'
            ? paymentDetails.bonusCode
            : '';
    const bonusCode = rawBonusCode.trim().toUpperCase();
    if (!bonusCode) return { applied: false };

    await connectMongo();
    const bonus = await Bonus.findOne({ code: bonusCode, isActive: true }).lean<BonusDocumentShape>();
    if (!bonus) return { applied: false };

    const now = new Date();
    const depositCurrency = normalizeDepositCurrency(paymentDetails.depositCurrency);
    if (bonus.validFrom && new Date(bonus.validFrom) > now) return { applied: false };
    if (bonus.validUntil && new Date(bonus.validUntil) < now) return { applied: false };
    if (Number(bonus.usageLimit || 0) > 0 && Number(bonus.usageCount || 0) >= Number(bonus.usageLimit || 0)) return { applied: false };
    if (!isBonusCurrencyEligible(bonus.currency, depositCurrency)) return { applied: false };
    if (bonus.forFirstDepositOnly && approvedDepositCountBeforeThisDeposit > 0) return { applied: false };
    if (transaction.amount < getMinimumDepositForCurrency(bonus, depositCurrency)) return { applied: false };

    const applicableTo = bonus.applicableTo || 'BOTH';

    const bonusTx = withUserBonusTx(tx);
    const existingRedemption = await bonusTx.userBonus.findFirst({
        where: {
            userId: transaction.userId,
            bonusId: String(bonus._id),
            status: { not: 'FORFEITED' },
        },
    });
    if (existingRedemption) return { applied: false };

    await expireOverdueUserBonuses(tx, transaction.userId);

    const existingConflict = await bonusTx.userBonus.findFirst({
        where: {
            userId: transaction.userId,
            status: 'ACTIVE',
            applicableTo: { in: getBonusConflictTypes(applicableTo) },
        },
    });
    if (existingConflict) {
        await forfeitUserBonus(tx, existingConflict.id);
    }

    const bonusAmount = calculateBonusAmount(bonus, transaction.amount);
    if (bonusAmount <= 0) return { applied: false };

    const wageringRequirement = Number(bonus.wageringRequirement || 1);
    const wageringRequired = roundCurrency(bonusAmount * wageringRequirement);
    const depositWagerMultiplier = Number(bonus.depositWagerMultiplier ?? 1) || 1;
    const expiryDays = Number(bonus.expiryDays ?? 30) || 30;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    const isCrypto = depositCurrency === 'CRYPTO';
    const bonusWalletField = getBonusWalletField(applicableTo, isCrypto);
    const walletLabel = getBonusWalletLabel(applicableTo, isCrypto);

    const userUpdate: Record<string, unknown> = {
        [bonusWalletField]: { increment: bonusAmount },
        wageringRequired: { increment: wageringRequired },
        depositWageringRequired: {
            increment: roundCurrency(transaction.amount * depositWagerMultiplier),
        },
    };

    if (!isCrypto) {
        if (applicableTo === 'SPORTS') {
            userUpdate.sportsBonusWageringRequired = { increment: wageringRequired };
        } else {
            userUpdate.casinoBonusWageringRequired = { increment: wageringRequired };
        }
    }

    await tx.user.update({
        where: { id: transaction.userId },
        data: userUpdate as Prisma.UserUpdateInput,
    });

    await bonusTx.userBonus.create({
        data: {
            userId: transaction.userId,
            bonusId: String(bonus._id),
            bonusCode,
            bonusTitle: bonus.title,
            bonusCurrency: bonus.currency || 'INR',
            applicableTo,
            depositAmount: transaction.amount,
            bonusAmount,
            wageringRequired,
            wageringDone: 0,
            status: 'ACTIVE',
            expiresAt,
        },
    });

    await tx.transaction.create({
        data: {
            userId: transaction.userId,
            amount: bonusAmount,
            type: 'BONUS',
            status: 'APPROVED',
            remarks: `${walletLabel}: ${bonus.title} (${bonusCode}) — ${wageringRequirement}x wagering, ${applicableTo} only`,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    });

    await Bonus.findByIdAndUpdate(bonus._id, { $inc: { usageCount: 1 } });

    return {
        applied: true,
        bonusCode,
        bonusAmount,
        bonusTitle: bonus.title,
    };
}

export async function getTransactions(
    page = 1,
    limit = 10,
    search = '',
    status = '',
    type = '',
    reviewQueueOnly = false,
    currencyFilter = 'ALL',
) {
    const skip = (page - 1) * limit;
    const where: Prisma.TransactionWhereInput = {};
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    where.NOT = {
        type: 'BONUS_CONVERT_REVERSED',
    };

    if (search) {
        where.OR = [
            { utr: { contains: search, mode: 'insensitive' } },
            { transactionId: { contains: search, mode: 'insensitive' } },
            { remarks: { contains: search, mode: 'insensitive' } },
            { paymentMethod: { contains: search, mode: 'insensitive' } },
            { user: { username: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
            { user: { phoneNumber: { contains: search, mode: 'insensitive' } } },
            { paymentDetails: { path: ['upiId'], string_contains: search } },
            { paymentDetails: { path: ['receive_account'], string_contains: search } },
            { paymentDetails: { path: ['receiveAccount'], string_contains: search } },
            { paymentDetails: { path: ['acctNo'], string_contains: search } },
            { paymentDetails: { path: ['accountNo'], string_contains: search } },
            { paymentDetails: { path: ['holderName'], string_contains: search } },
            { paymentDetails: { path: ['acctName'], string_contains: search } },
            { paymentDetails: { path: ['receive_name'], string_contains: search } },
            { paymentDetails: { path: ['address'], string_contains: search } },
            { paymentDetails: { path: ['senderUpiId'], string_contains: search } },
            { paymentDetails: { path: ['gateway'], string_contains: search } },
            { paymentDetails: { path: ['orderNo'], string_contains: search } },
            { paymentDetails: { path: ['bonusCode'], string_contains: search } },
        ];
    }

    if (status && status !== 'ALL') {
        if (type === 'DEPOSIT' && status === 'COMPLETED') {
            where.status = { in: ['COMPLETED', 'APPROVED'] };
        } else {
            where.status = status;
        }
    }

    if (type && type !== 'ALL') {
        where.type = type;
    }

    if (currencyFilter === 'FIAT') {
        where.NOT = {
            OR: [
                { paymentMethod: { in: ['NOWPAYMENTS', 'CRYPTO_WALLET', 'CRYPTO'] } },
                { paymentMethod: { startsWith: 'CRYPTO_' } },
            ],
        };
    } else if (currencyFilter === 'CRYPTO') {
        where.OR = [
            { paymentMethod: { in: ['NOWPAYMENTS', 'CRYPTO_WALLET', 'CRYPTO'] } },
            { paymentMethod: { startsWith: 'CRYPTO_' } },
        ];
    }

    if (reviewQueueOnly && type === 'DEPOSIT') {
        const existingAndClauses = Array.isArray(where.AND)
            ? where.AND
            : where.AND
                ? [where.AND]
                : [];
        where.AND = [
            ...existingAndClauses,
            {
                OR: [
                    { paymentMethod: { contains: 'manual', mode: 'insensitive' } },
                    { paymentDetails: { path: ['gateway'], equals: 'manual_upi' } },
                    { paymentDetails: { path: ['gateway'], equals: 'admin_manual' } },
                    { paymentDetails: { path: ['requiresAdminReview'], equals: true } },
                ],
            },
        ];
    }

    try {
        const summaryBaseWhere: Prisma.TransactionWhereInput = { ...where };
        Reflect.deleteProperty(summaryBaseWhere, 'status');

        const [transactions, total, uniqueDepositorRows, todayAmountAgg, todayCount] = await Promise.all([
            prisma.transaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { username: true, email: true, phoneNumber: true } }
                }
            }),
            prisma.transaction.count({ where }),
            type === 'DEPOSIT'
                ? prisma.transaction.findMany({
                    where: {
                        ...summaryBaseWhere,
                        type: 'DEPOSIT',
                        status: { in: ['APPROVED', 'COMPLETED'] },
                    },
                    distinct: ['userId'],
                    select: { userId: true },
                })
                : Promise.resolve([]),
            (type === 'DEPOSIT' || type === 'WITHDRAWAL')
                ? prisma.transaction.aggregate({
                    where: {
                        ...summaryBaseWhere,
                        type,
                        createdAt: {
                            gte: startOfToday,
                            lt: endOfToday,
                        },
                    },
                    _sum: { amount: true },
                })
                : Promise.resolve({ _sum: { amount: 0 } }),
            (type === 'DEPOSIT' || type === 'WITHDRAWAL')
                ? prisma.transaction.count({
                    where: {
                        ...summaryBaseWhere,
                        type,
                        createdAt: {
                            gte: startOfToday,
                            lt: endOfToday,
                        },
                    },
                })
                : Promise.resolve(0),
        ]);

        return {
            transactions,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            summary: {
                uniqueDepositors: uniqueDepositorRows.length,
                todayAmount: Number(todayAmountAgg._sum.amount || 0),
                todayCount,
            },
        };
    } catch (error) {
        console.error('Failed to fetch transactions:', error);
        throw new Error('Failed to fetch transactions');
    }
}

export async function getTransactionsFiltered(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    type?: string;
    reviewQueueOnly?: boolean;
    currencyFilter?: string;
    dateFrom?: string;
    dateTo?: string;
    amountMin?: string;
    amountMax?: string;
    methodFilter?: string;
}) {
    const {
        page = 1,
        limit = 15,
        search = '',
        status = '',
        type = '',
        reviewQueueOnly = false,
        currencyFilter = 'ALL',
        dateFrom = '',
        dateTo = '',
        amountMin = '',
        amountMax = '',
        methodFilter = '',
    } = params;

    const skip = (page - 1) * limit;
    const where: Prisma.TransactionWhereInput = {};
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    where.NOT = { type: 'BONUS_CONVERT_REVERSED' };

    if (search) {
        where.OR = [
            // ── Top-level string columns ─────────────────────────────────────
            { utr: { contains: search, mode: 'insensitive' } },
            { transactionId: { contains: search, mode: 'insensitive' } },
            { remarks: { contains: search, mode: 'insensitive' } },
            { paymentMethod: { contains: search, mode: 'insensitive' } },
            // ── User fields ──────────────────────────────────────────────────
            { user: { username: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
            { user: { phoneNumber: { contains: search, mode: 'insensitive' } } },
            // ── paymentDetails JSON — UPI ────────────────────────────────────
            { paymentDetails: { path: ['upiId'], string_contains: search } },
            { paymentDetails: { path: ['receive_account'], string_contains: search } },
            { paymentDetails: { path: ['receiveAccount'], string_contains: search } },
            { paymentDetails: { path: ['acctNo'], string_contains: search } },
            // ── paymentDetails JSON — Bank ───────────────────────────────────
            { paymentDetails: { path: ['accountNo'], string_contains: search } },
            { paymentDetails: { path: ['ifsc'], string_contains: search } },
            { paymentDetails: { path: ['ifscCode'], string_contains: search } },
            { paymentDetails: { path: ['acctCode'], string_contains: search } },
            { paymentDetails: { path: ['bankName'], string_contains: search } },
            { paymentDetails: { path: ['bank'], string_contains: search } },
            // ── paymentDetails JSON — Holder names ───────────────────────────
            { paymentDetails: { path: ['holderName'], string_contains: search } },
            { paymentDetails: { path: ['acctName'], string_contains: search } },
            { paymentDetails: { path: ['receive_name'], string_contains: search } },
            // ── paymentDetails JSON — Crypto ─────────────────────────────────
            { paymentDetails: { path: ['address'], string_contains: search } },
            { paymentDetails: { path: ['coin'], string_contains: search } },
            { paymentDetails: { path: ['coinLabel'], string_contains: search } },
            { paymentDetails: { path: ['network'], string_contains: search } },
            // ── paymentDetails JSON — Reference IDs ──────────────────────────
            { paymentDetails: { path: ['gateway'], string_contains: search } },
            { paymentDetails: { path: ['orderNo'], string_contains: search } },
            { paymentDetails: { path: ['referenceId'], string_contains: search } },
            { paymentDetails: { path: ['transferId'], string_contains: search } },
            { paymentDetails: { path: ['senderUpiId'], string_contains: search } },
            { paymentDetails: { path: ['accountTag'], string_contains: search } },
            { paymentDetails: { path: ['bonusCode'], string_contains: search } },
        ];
    }

    if (status && status !== 'ALL') {
        if (type === 'DEPOSIT' && status === 'COMPLETED') {
            where.status = { in: ['COMPLETED', 'APPROVED'] };
        } else {
            where.status = status;
        }
    }

    if (type && type !== 'ALL') {
        where.type = type;
    }

    // Currency filter — include CRYPTO_* prefixed methods (CRYPTO_USDTBSC, CRYPTO_BTC, etc.)
    if (currencyFilter === 'FIAT') {
        where.NOT = {
            OR: [
                { paymentMethod: { in: ['NOWPAYMENTS', 'CRYPTO_WALLET', 'CRYPTO'] } },
                { paymentMethod: { startsWith: 'CRYPTO_' } },
            ],
        };
    } else if (currencyFilter === 'CRYPTO') {
        where.OR = [
            { paymentMethod: { in: ['NOWPAYMENTS', 'CRYPTO_WALLET', 'CRYPTO'] } },
            { paymentMethod: { startsWith: 'CRYPTO_' } },
        ];
    }

    const andClauses: Prisma.TransactionWhereInput[] = [];

    // Payment Method Filter
    if (methodFilter && methodFilter !== 'ALL') {
        if (methodFilter === 'UPI') {
            andClauses.push({ paymentMethod: { contains: 'upi', mode: 'insensitive' } });
        } else if (methodFilter === 'BANK') {
            andClauses.push({
                OR: [
                    { paymentMethod: { contains: 'bank', mode: 'insensitive' } },
                    { paymentMethod: { contains: 'neft', mode: 'insensitive' } },
                    { paymentMethod: { contains: 'imps', mode: 'insensitive' } },
                ],
            });
        } else if (methodFilter === 'CRYPTO') {
            andClauses.push({
                OR: [
                    { paymentMethod: { in: ['NOWPAYMENTS', 'CRYPTO_WALLET', 'CRYPTO'] } },
                    { paymentMethod: { contains: 'crypto', mode: 'insensitive' } },
                ],
            });
        } else if (methodFilter === 'MANUAL') {
            andClauses.push({ paymentMethod: { contains: 'manual', mode: 'insensitive' } });
        }
    }

    // Date Range
    if (dateFrom || dateTo) {
        const createdAtFilter: Prisma.DateTimeFilter = {};
        if (dateFrom) createdAtFilter.gte = new Date(dateFrom);
        if (dateTo) {
            const endDate = new Date(dateTo);
            endDate.setHours(23, 59, 59, 999);
            createdAtFilter.lte = endDate;
        }
        andClauses.push({ createdAt: createdAtFilter });
    }

    // Amount Range
    if (amountMin || amountMax) {
        const amountFilter: { gte?: number; lte?: number } = {};
        if (amountMin) amountFilter.gte = parseFloat(amountMin);
        if (amountMax) amountFilter.lte = parseFloat(amountMax);
        andClauses.push({ amount: amountFilter });
    }

    // Review queue (manual deposits only)
    if (reviewQueueOnly && type === 'DEPOSIT') {
        andClauses.push({
            OR: [
                { paymentMethod: { contains: 'manual', mode: 'insensitive' } },
                { paymentDetails: { path: ['gateway'], equals: 'manual_upi' } },
                { paymentDetails: { path: ['gateway'], equals: 'admin_manual' } },
                { paymentDetails: { path: ['requiresAdminReview'], equals: true } },
            ],
        });
    }

    if (andClauses.length > 0) {
        where.AND = andClauses;
    }

    try {
        const summaryBaseWhere: Prisma.TransactionWhereInput = { ...where };
        Reflect.deleteProperty(summaryBaseWhere, 'status');

        const [transactions, total, uniqueDepositorRows, todayAmountAgg, todayCount] = await Promise.all([
            prisma.transaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { username: true, email: true, phoneNumber: true } } },
            }),
            prisma.transaction.count({ where }),
            type === 'DEPOSIT'
                ? prisma.transaction.findMany({
                    where: { ...summaryBaseWhere, type: 'DEPOSIT', status: { in: ['APPROVED', 'COMPLETED'] } },
                    distinct: ['userId'],
                    select: { userId: true },
                })
                : Promise.resolve([]),
            (type === 'DEPOSIT' || type === 'WITHDRAWAL')
                ? prisma.transaction.aggregate({
                    where: { ...summaryBaseWhere, type, createdAt: { gte: startOfToday, lt: endOfToday } },
                    _sum: { amount: true },
                })
                : Promise.resolve({ _sum: { amount: 0 } }),
            (type === 'DEPOSIT' || type === 'WITHDRAWAL')
                ? prisma.transaction.count({
                    where: { ...summaryBaseWhere, type, createdAt: { gte: startOfToday, lt: endOfToday } },
                })
                : Promise.resolve(0),
        ]);

        return {
            transactions,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            summary: {
                uniqueDepositors: uniqueDepositorRows.length,
                todayAmount: Number(todayAmountAgg._sum.amount || 0),
                todayCount,
            },
        };
    } catch (error) {
        console.error('Failed to fetch transactions (filtered):', error);
        throw new Error('Failed to fetch transactions');
    }
}

export async function getTransactionStats() {
    try {
        const [deposits, withdrawals, pendingWithdrawals] = await Promise.all([
            prisma.transaction.aggregate({
                where: { type: 'DEPOSIT', status: { in: ['APPROVED', 'COMPLETED'] } },
                _sum: { amount: true }
            }),
            prisma.transaction.aggregate({
                where: { type: 'WITHDRAWAL', status: 'Approved' }, // Case sensitivity check needed
                _sum: { amount: true }
            }),
            prisma.transaction.count({
                where: { type: 'WITHDRAWAL', status: 'PENDING' }
            })
        ]);

        return {
            totalDeposits: deposits._sum.amount || 0,
            totalWithdrawals: withdrawals._sum.amount || 0,
            pendingWithdrawals,
            todayRevenue: 0 // Need date filter logic
        };
    } catch {
        return {
            totalDeposits: 0,
            totalWithdrawals: 0,
            pendingWithdrawals: 0,
            todayRevenue: 0
        };
    }
}

// ── Withdrawal 4-step flow: PENDING → PROCESSED → APPROVED → COMPLETED ──

/** Helper: trigger a withdrawal status email via the backend API */
async function sendWithdrawalEmail(
    step: 'pending' | 'processed' | 'approved' | 'completed',
    email: string,
    username: string,
    amount: number,
    currency: string = 'INR',
) {
    try {
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:9828/api';
        const adminToken = process.env.ADMIN_API_TOKEN || '';
        const resp = await fetch(`${baseUrl}/transactions/send-withdrawal-status-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
            body: JSON.stringify({ step, email, username, amount: amount.toFixed(2), currency }),
        });
        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            console.error(`[sendWithdrawalEmail] Failed — step:${step} email:${email} HTTP:${resp.status} body:${body}`);
        }
    } catch (e: any) {
        console.error(`[sendWithdrawalEmail] Error — step:${step} email:${email}`, e?.message);
    }
}

/**
 * Step 1→2: PENDING → PROCESSED (admin reviewed / acknowledged)
 */
export async function processWithdrawal(transactionId: number, adminId: number, remarks: string) {
    try {
        const txn = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { user: { select: { email: true, username: true } } },
        });
        if (!txn) return { success: false, error: 'Transaction not found' };
        if (txn.status !== 'PENDING') return { success: false, error: 'Transaction is not pending' };

        await prisma.transaction.update({
            where: { id: transactionId },
            data: { status: 'PROCESSED', adminId, remarks, updatedAt: new Date() },
        });

        const amtStr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(txn.amount);
        await prismaWithNotification.notification.create({
            data: {
                userId: txn.userId,
                title: 'Withdrawal Being Processed',
                body: `Your withdrawal of ${amtStr} is being processed.`,
            },
        });

        await prisma.auditLog.create({
            data: { adminId, action: 'PROCESS_WITHDRAWAL', details: { transactionId, remarks } },
        });

        // Send email
        const pd = (txn.paymentDetails as Record<string, any>) || {};
        if (txn.user?.email) {
            sendWithdrawalEmail('processed', txn.user.email, txn.user.username || txn.user.email, txn.amount, pd.currency || 'INR');
        }

        revalidatePath('/dashboard/finance/transactions');
        return { success: true };
    } catch (error) {
        console.error('processWithdrawal error:', error);
        return { success: false, error: 'Failed to process withdrawal' };
    }
}

/**
 * Step 2→3: PROCESSED → APPROVED (payment initiated / approved)
 */
export async function approveWithdrawal(
    transactionId: number,
    adminId: number,
    remarks: string,
    txnId?: string,
    senderUpiId?: string,
    gateway: 'manual' | 'upi2' | 'upi3' | 'upi4' | 'upi5' | 'nexpay' = 'manual',
) {
    try {
        const txn = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { user: { select: { email: true, username: true, phoneNumber: true, firstName: true, lastName: true } } },
        });
        if (!txn) return { success: false, error: 'Transaction not found' };
        if (txn.status !== 'PROCESSED') return { success: false, error: 'Transaction must be in PROCESSED status to approve' };

        // ── NexPay: direct API call from admin action ──
        if (gateway === 'nexpay') {
            try {
                const pd = (txn.paymentDetails as Record<string, any>) || {};
                const user = txn.user as any;
                const payeeName = pd.holderName || pd.acctName || pd.receive_name || pd.payeeName
                    || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Beneficiary';
                const payeeAccount = pd.accountNo || pd.acctNo || pd.receive_account || pd.receiveAccount || pd.payeeAccount;
                const payeeIfsc = pd.ifsc || pd.ifscCode || pd.acctCode || pd.payeeIfsc || '';
                const payeeAcType = pd.accountType || pd.payeeAcType || 'savings';
                const payeeBankName = pd.bankName || pd.payeeBankName || 'Unknown Bank';
                const rawMobile = pd.phoneNumber || pd.mobile || pd.phone || user?.phoneNumber || '9999999999';
                const cleanMobile = rawMobile.replace(/\D/g, '').slice(-10);
                const payeeMobile = cleanMobile.slice(0, 2) + '00000' + cleanMobile.slice(7);
                const payeeEmail = pd.email || user?.email || 'fix';

                if (!payeeAccount) return { success: false, error: 'Beneficiary account number missing in payment details' };
                if (!payeeIfsc) return { success: false, error: 'Beneficiary IFSC missing in payment details' };

                const externalTxnId = `NXP${txn.id}${Date.now()}`;
                const nexpayToken = process.env.NEXPAY_API_TOKEN || '';
                if (!nexpayToken) return { success: false, error: 'NEXPAY_API_TOKEN not configured' };

                const nexpayResp = await fetch('https://nexpay.space/api/payout/v1/createOrder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_token: nexpayToken,
                        amount: txn.amount,
                        transfer_mode: 'IMPS',
                        externalTxnId,
                        payee_name: payeeName,
                        payee_account: payeeAccount,
                        payee_ifsc: payeeIfsc,
                        payee_ac_type: payeeAcType,
                        payee_bank_name: payeeBankName,
                        payee_mobile: payeeMobile,
                        payee_email: payeeEmail,
                    }),
                });
                const nexpayData = await nexpayResp.json().catch(() => ({}));

                console.log(`[NexPay] Response HTTP:${nexpayResp.status} | externalTxnId:${externalTxnId} | body:`, JSON.stringify(nexpayData));

                const nxStatus = (nexpayData?.data?.status || nexpayData?.status || '').toLowerCase();
                if (!(nexpayResp.status === 200 && (nxStatus === 'success' || nxStatus === 'pending'))) {
                    const errMsg = nexpayData?.data?.message || nexpayData?.message || 'NexPay rejected the payout';
                    console.error(`[NexPay] Payout REJECTED — txn:${transactionId} | error: ${errMsg}`);
                    return { success: false, error: errMsg };
                }

                // NexPay accepted — update DB
                let isCompleted = nxStatus === 'success';
                const nxUtr = nexpayData?.utr || nexpayData?.data?.utr || nexpayData?.data?.bank_ref_no || externalTxnId;

                // Guard: real bank UTRs are max 12 digits. If NexPay returns
                // a >12-digit UTR, don't mark as COMPLETED — keep in APPROVED
                // and stamp a remark for manual review.
                const nxUtrDigits = String(nxUtr || '').replace(/\D/g, '').length;
                const utrSuspect = isCompleted && nxUtrDigits > 12;
                if (utrSuspect) {
                    isCompleted = false;
                    console.warn(`[NexPay] txn:${transactionId} received ${nxUtrDigits}-digit utr "${nxUtr}" — NOT marking COMPLETED`);
                }

                await prisma.transaction.update({
                    where: { id: transactionId },
                    data: {
                        status: isCompleted ? 'COMPLETED' : 'APPROVED',
                        paymentMethod: 'NexPay',
                        utr: isCompleted ? nxUtr : externalTxnId,
                        adminId,
                        remarks: utrSuspect
                            ? `got ${nxUtrDigits} digit utr ${nxUtr}`
                            : (remarks || (isCompleted ? 'NexPay fund transfer successful' : 'Sent to NexPay')),
                        paymentDetails: {
                            ...pd,
                            gateway: 'nexpay',
                            externalTxnId,
                            bankRefNo: nexpayData.data?.bank_ref_no,
                            utr: nxUtr,
                            ...(utrSuspect ? { suspectUtr: nxUtr } : {}),
                        } as any,
                    },
                });

                await prisma.auditLog.create({
                    data: {
                        adminId,
                        action: 'APPROVE_WITHDRAWAL',
                        details: { transactionId, remarks, gateway: 'nexpay', externalTxnId, bankRefNo: nexpayData.data?.bank_ref_no },
                    },
                });

                const amtStr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(txn.amount);
                await prismaWithNotification.notification.create({
                    data: {
                        userId: txn.userId,
                        title: 'Withdrawal Approved',
                        body: `Your withdrawal of ${amtStr} has been approved and is being processed.`,
                    },
                });

                if (txn.user?.email) {
                    sendWithdrawalEmail('approved', txn.user.email, txn.user.username || txn.user.email, txn.amount, pd.currency || 'INR');
                }

                revalidatePath('/dashboard/finance/transactions');
                return { success: true };
            } catch (e: any) {
                console.error('NexPay payout trigger failed:', e);
                return { success: false, error: e?.message || 'Failed to trigger NexPay payout' };
            }
        }

        // ── Other gateways: hand off to backend payout endpoint ──
        const gatewayEndpoints: Record<string, string> = {
            upi2: '/payment2/admin/process-withdrawal',
            upi3: '/payment3/admin/process-withdrawal',
            upi4: '/payment4/admin/process-withdrawal',
            upi5: '/payment5/admin/process-withdrawal',
        };

        if (gateway in gatewayEndpoints) {
            try {
                const baseUrl = process.env.BACKEND_URL || 'http://localhost:9828/api';
                const adminToken = process.env.ADMIN_API_TOKEN || '';
                const resp = await fetch(`${baseUrl}${gatewayEndpoints[gateway]}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-token': adminToken,
                    },
                    body: JSON.stringify({ transactionId, adminId, remarks }),
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok || !data?.success) {
                    return {
                        success: false,
                        error: data?.message || 'Gateway rejected the payout',
                    };
                }

                await prisma.auditLog.create({
                    data: {
                        adminId,
                        action: 'APPROVE_WITHDRAWAL',
                        details: { transactionId, remarks, gateway, orderNo: data.orderNo },
                    },
                });

                const amtStr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(txn.amount);
                await prismaWithNotification.notification.create({
                    data: {
                        userId: txn.userId,
                        title: 'Withdrawal Approved',
                        body: `Your withdrawal of ${amtStr} has been approved and is being processed.`,
                    },
                });

                // Send email
                const pd = (txn.paymentDetails as Record<string, any>) || {};
                if (txn.user?.email) {
                    sendWithdrawalEmail('approved', txn.user.email, txn.user.username || txn.user.email, txn.amount, pd.currency || 'INR');
                }

                revalidatePath('/dashboard/finance/transactions');
                return { success: true };
            } catch (e: any) {
                console.error(`${gateway} payout trigger failed:`, e);
                return { success: false, error: e?.message || `Failed to trigger ${gateway.toUpperCase()} payout` };
            }
        }

        // ── Manual path: mark as APPROVED (admin will complete separately) ──
        await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                status: 'APPROVED',
                adminId,
                remarks,
                ...(txnId ? { transactionId: txnId } : {}),
                updatedAt: new Date(),
            },
        });

        const amtStr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(txn.amount);
        await prismaWithNotification.notification.create({
            data: {
                userId: txn.userId,
                title: 'Withdrawal Approved',
                body: `Your withdrawal of ${amtStr} has been approved. Payment will be sent shortly.`,
            },
        });

        await prisma.auditLog.create({
            data: {
                adminId,
                action: 'APPROVE_WITHDRAWAL',
                details: { transactionId, remarks, txnId, senderUpiId },
            },
        });

        if (senderUpiId) {
            try {
                const { recordUpiLedgerEffect } = await import('@/actions/expenses');
                const u = await prisma.user.findUnique({ where: { id: txn.userId } });
                const pd = (txn.paymentDetails as Record<string, any>) || {};
                const hName = pd.holderName || pd.acctName || pd.receive_name;
                const extId = pd.upiId || pd.receive_account || pd.receiveAccount || pd.accountNo || pd.acctNo;

                await recordUpiLedgerEffect(
                    senderUpiId,
                    txn.amount,
                    'WITHDRAWAL',
                    u?.username || `User_${txn.userId}`,
                    adminId.toString(),
                    { holderName: hName, externalId: extId }
                );
            } catch (e) {
                console.error('Ledger linkage failed:', e);
            }
        }

        // Send email
        {
            const pd = (txn.paymentDetails as Record<string, any>) || {};
            if (txn.user?.email) {
                sendWithdrawalEmail('approved', txn.user.email, txn.user.username || txn.user.email, txn.amount, pd.currency || 'INR');
            }
        }

        revalidatePath('/dashboard/finance/transactions');
        return { success: true };
    } catch (error) {
        console.error('approveWithdrawal error:', error);
        return { success: false, error: 'Failed to approve withdrawal' };
    }
}

/**
 * Step 3→4: APPROVED → COMPLETED (payment confirmed done)
 */
export async function completeWithdrawal(
    transactionId: number,
    adminId: number,
    remarks: string,
    txnId?: string,
) {
    try {
        const txn = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { user: { select: { email: true, username: true } } },
        });
        if (!txn) return { success: false, error: 'Transaction not found' };
        if (txn.status !== 'APPROVED') return { success: false, error: 'Transaction must be in APPROVED status to complete' };

        await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                status: 'COMPLETED',
                adminId,
                remarks,
                ...(txnId ? { transactionId: txnId } : {}),
                updatedAt: new Date(),
            },
        });

        const amtStr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(txn.amount);
        const notifBody = txnId
            ? `Your withdrawal of ${amtStr} has been completed. Transaction ID: ${txnId}`
            : `Your withdrawal of ${amtStr} has been completed.`;

        await prismaWithNotification.notification.create({
            data: {
                userId: txn.userId,
                title: 'Withdrawal Completed',
                body: notifBody,
            },
        });

        await prisma.auditLog.create({
            data: {
                adminId,
                action: 'COMPLETE_WITHDRAWAL',
                details: { transactionId, remarks, txnId },
            },
        });

        // Send email
        const pd = (txn.paymentDetails as Record<string, any>) || {};
        if (txn.user?.email) {
            sendWithdrawalEmail('completed', txn.user.email, txn.user.username || txn.user.email, txn.amount, pd.currency || 'INR');
        }

        revalidatePath('/dashboard/finance/transactions');
        return { success: true };
    } catch (error) {
        console.error('completeWithdrawal error:', error);
        return { success: false, error: 'Failed to complete withdrawal' };
    }
}

/**
 * Revert a COMPLETED NexPay withdrawal back to PROCESSED so admin can retry.
 * Typically used when "Sent to NexPay" rows were auto-marked completed but the
 * bank transfer actually failed.
 */
export async function revertWithdrawalToProcessed(
    transactionId: number,
    adminId: number,
    remarks?: string,
) {
    try {
        const txn = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { user: { select: { email: true, username: true } } },
        });
        if (!txn) return { success: false, error: 'Transaction not found' };
        if (txn.type !== 'WITHDRAWAL') return { success: false, error: 'Not a withdrawal transaction' };
        if (!['COMPLETED', 'APPROVED'].includes(txn.status)) {
            return { success: false, error: 'Only COMPLETED/APPROVED withdrawals can be reverted' };
        }

        await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                status: 'PROCESSED',
                adminId,
                remarks: remarks || 'Reverted to Processed — NexPay transfer failed, retry required',
                updatedAt: new Date(),
            },
        });

        await prisma.auditLog.create({
            data: {
                adminId,
                action: 'REVERT_WITHDRAWAL_TO_PROCESSED',
                details: { transactionId, previousStatus: txn.status, remarks },
            },
        });

        revalidatePath('/dashboard/finance/transactions');
        revalidatePath('/dashboard/finance/withdrawals');
        return { success: true };
    } catch (error) {
        console.error('revertWithdrawalToProcessed error:', error);
        return { success: false, error: 'Failed to revert withdrawal' };
    }
}

export async function rejectWithdrawal(transactionId: number, adminId: number, remarks: string) {
    try {
        const txn = await prisma.transaction.findUnique({ where: { id: transactionId } });
        if (!txn) return { success: false, error: 'Transaction not found' };
        if (!['PENDING', 'PROCESSED'].includes(txn.status)) {
            return { success: false, error: 'Transaction can only be rejected from PENDING or PROCESSED status' };
        }

        // Refund to the wallet the withdrawal was originally debited from.
        // Crypto withdrawals debit `cryptoBalance`, so we must credit the
        // same wallet on reject — not `balance`.
        const details = (txn.paymentDetails as Record<string, any>) || {};
        const wasCrypto =
            String(txn.paymentMethod || '').toUpperCase().includes('CRYPTO') ||
            String(details?.method || '').toUpperCase() === 'CRYPTO' ||
            String(details?.currency || '').toUpperCase() === 'CRYPTO' ||
            String(details?.wallet || '').toUpperCase() === 'CRYPTO';

        // Refund balance if rejected
        // Use transaction to ensure atomicity
        await prisma.$transaction([
            prisma.transaction.update({
                where: { id: transactionId },
                data: {
                    status: 'REJECTED',
                    adminId,
                    remarks,
                    updatedAt: new Date()
                }
            }),
            prisma.user.update({
                where: { id: txn.userId },
                data: wasCrypto
                    ? { cryptoBalance: { increment: txn.amount } }
                    : { balance: { increment: txn.amount } }
            }),
            prisma.auditLog.create({
                data: {
                    adminId,
                    action: 'REJECT_WITHDRAWAL',
                    details: { transactionId, remarks, wallet: wasCrypto ? 'crypto' : 'fiat' }
                }
            })
        ]);

        revalidatePath('/dashboard/finance/transactions');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to reject withdrawal' };
    }
}

export async function approveDeposit(transactionId: number, adminId: number, remarks: string, txnId?: string, receiverUpiId?: string) {
    try {
        const txn = await prisma.transaction.findUnique({ where: { id: transactionId } });
        if (!txn) return { success: false, error: 'Transaction not found' };
        if (txn.type !== 'DEPOSIT') return { success: false, error: 'Transaction is not a deposit' };
        if (txn.status !== 'PENDING') return { success: false, error: 'Transaction is not pending' };

        const approvedDepositCountBeforeThisDeposit = await prisma.transaction.count({
            where: {
                userId: txn.userId,
                type: 'DEPOSIT',
                status: { in: ['APPROVED', 'COMPLETED'] },
                id: { not: transactionId },
            },
        });

        // ── Wallet routing: crypto deposits must credit cryptoBalance ──
        // and skip the INR-denominated totalDeposited + depositWagering lock.
        const pd = (txn.paymentDetails as Record<string, any>) || {};
        const isCryptoDeposit =
            String(pd?.depositCurrency || '').toUpperCase() === 'CRYPTO' ||
            String(pd?.currency || '').toUpperCase() === 'CRYPTO' ||
            String(pd?.wallet || '').toUpperCase() === 'CRYPTO' ||
            String(pd?.method || '').toUpperCase().includes('CRYPTO') ||
            String(txn.paymentMethod || '').toUpperCase().includes('CRYPTO');

        const bonusResult = await prisma.$transaction(async (tx) => {
            await tx.transaction.update({
                where: { id: transactionId },
                data: {
                    status: 'COMPLETED',
                    adminId,
                    remarks,
                    ...(txnId ? { transactionId: txnId } : {}),
                    updatedAt: new Date(),
                },
            });

            await tx.user.update({
                where: { id: txn.userId },
                data: isCryptoDeposit
                    ? { cryptoBalance: { increment: txn.amount } }
                    : {
                        balance: { increment: txn.amount },
                        totalDeposited: { increment: txn.amount },
                    },
            });

            const appliedBonus = await applyEligibleDepositBonus(
                tx,
                {
                    userId: txn.userId,
                    amount: txn.amount,
                    paymentDetails: txn.paymentDetails,
                },
                approvedDepositCountBeforeThisDeposit,
            );

            // Deposit-wagering lock is INR-only — crypto deposits skip it.
            if (!appliedBonus.applied && !isCryptoDeposit) {
                await tx.user.update({
                    where: { id: txn.userId },
                    data: {
                        depositWageringRequired: { increment: txn.amount },
                    } as Prisma.UserUpdateInput,
                });
            }

            await tx.auditLog.create({
                data: {
                    adminId,
                    action: 'APPROVE_DEPOSIT',
                    details: {
                        transactionId,
                        remarks,
                        txnId,
                        receiverUpiId,
                        bonusApplied: appliedBonus.applied,
                        bonusCode: appliedBonus.applied ? appliedBonus.bonusCode : null,
                    },
                },
            });

            return appliedBonus;
        });

        if (receiverUpiId) {
            try {
                const { recordUpiLedgerEffect } = await import('@/actions/expenses');
                const u = await prisma.user.findUnique({ where: { id: txn.userId } });
                const pd = (txn.paymentDetails as Record<string, any>) || {};
                const extId = pd.senderUpiId || pd.utr || pd.gateway || '';

                await recordUpiLedgerEffect(
                    receiverUpiId,
                    txn.amount,
                    'DEPOSIT',
                    u?.username || `User_${txn.userId}`,
                    adminId.toString(),
                    { holderName: u?.username || undefined, externalId: extId }
                );
            } catch (e) {
                console.error('Ledger linkage failed:', e);
            }
        }


        // Note: wallet update notification to the frontend is handled by the
        // database-level balance change above. The legacy backend emit-wallet-update
        // call has been removed — the NestJS backend is no longer a dependency.



        // Create in-app notification (non-blocking — don't fail the approval if this fails)
        try {
            const amtStr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(txn.amount);
            const bonusLine = bonusResult.applied
                ? ` Bonus ${bonusResult.bonusCode} was applied to this deposit.`
                : '';
            const notifBody = txnId
                ? `Your deposit of ${amtStr} has been approved. Transaction ID: ${txnId}.${bonusLine}`
                : `Your deposit of ${amtStr} has been approved and credited to your account.${bonusLine}`;

            await prismaWithNotification.notification.create({
                data: {
                    userId: txn.userId,
                    title: '✅ Deposit Approved',
                    body: notifBody,
                }
            });
        } catch (notifErr) {
            console.warn('Failed to create deposit approval notification:', notifErr);
        }

        revalidatePath('/dashboard/finance/transactions');
        revalidatePath('/dashboard/finance/deposits');
        return {
            success: true,
            bonusApplied: bonusResult.applied,
            bonusCode: bonusResult.applied ? bonusResult.bonusCode : undefined,
        };
    } catch (error) {
        console.error('approveDeposit error:', error);
        return { success: false, error: 'Failed to approve deposit' };
    }
}

export async function rejectDeposit(transactionId: number, adminId: number, remarks: string) {
    try {
        const txn = await prisma.transaction.findUnique({ where: { id: transactionId } });
        if (!txn) return { success: false, error: 'Transaction not found' };
        if (txn.type !== 'DEPOSIT') return { success: false, error: 'Transaction is not a deposit' };
        if (txn.status !== 'PENDING') return { success: false, error: 'Transaction is not pending' };

        await prisma.$transaction([
            prisma.transaction.update({
                where: { id: transactionId },
                data: {
                    status: 'REJECTED',
                    adminId,
                    remarks,
                    updatedAt: new Date()
                }
            }),
            prisma.auditLog.create({
                data: {
                    adminId,
                    action: 'REJECT_DEPOSIT',
                    details: { transactionId, remarks }
                }
            })
        ]);

        // Notify user (non-blocking)
        try {
            const amtStr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(txn.amount);
            await prismaWithNotification.notification.create({
                data: {
                    userId: txn.userId,
                    title: '❌ Deposit Rejected',
                    body: `Your deposit of ${amtStr} has been rejected. Reason: ${remarks}`,
                }
            });
        } catch (notifErr) {
            console.warn('Failed to create deposit rejection notification:', notifErr);
        }

        revalidatePath('/dashboard/finance/transactions');
        revalidatePath('/dashboard/finance/deposits');
        return { success: true };
    } catch (error) {
        console.error('rejectDeposit error:', error);
        return { success: false, error: 'Failed to reject deposit' };
    }
}

export async function createManualAdjustment(
    userId: number,
    type: 'DEPOSIT' | 'WITHDRAWAL',
    amount: number,
    remarks: string,
    adminId: number,
    wallet: 'fiat' | 'crypto' | 'casinoBonus' | 'sportsBonus' | 'cryptoBonus' = 'fiat',
    options?: {
        skipTransactionLog?: boolean;
    },
) {
    try {
        const normalizedAmount = roundCurrency(Number(amount || 0));
        if (!userId || normalizedAmount <= 0) {
            return { success: false, error: 'Enter a valid amount' };
        }

        const skipTransactionLog = Boolean(options?.skipTransactionLog);
        const isBonusTarget =
            wallet === 'casinoBonus' ||
            wallet === 'sportsBonus' ||
            wallet === 'cryptoBonus';

        if (isBonusTarget && type === 'DEPOSIT') {
            return { success: false, error: 'Use Add Bonus to credit a bonus wallet' };
        }

        const walletMeta = (() => {
            switch (wallet) {
                case 'crypto':
                    return { walletField: 'cryptoBalance', paymentMethod: 'CRYPTO_WALLET', walletLabel: 'Crypto Wallet' } as const;
                case 'casinoBonus':
                    return { walletField: 'casinoBonus', paymentMethod: 'BONUS_WALLET', walletLabel: 'Casino Bonus' } as const;
                case 'sportsBonus':
                    return { walletField: 'sportsBonus', paymentMethod: 'BONUS_WALLET', walletLabel: 'Sports Bonus' } as const;
                case 'cryptoBonus':
                    return { walletField: 'cryptoBonus', paymentMethod: 'BONUS_WALLET', walletLabel: 'Crypto Bonus' } as const;
                default:
                    return { walletField: 'balance', paymentMethod: 'MAIN_WALLET', walletLabel: 'Main Wallet' } as const;
            }
        })();

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    balance: true,
                    cryptoBalance: true,
                    fiatBonus: true,
                    casinoBonus: true,
                    sportsBonus: true,
                    cryptoBonus: true,
                    wageringRequired: true,
                    wageringDone: true,
                    casinoBonusWageringRequired: true,
                    casinoBonusWageringDone: true,
                    sportsBonusWageringRequired: true,
                    sportsBonusWageringDone: true,
                },
            });

            if (!user) {
                throw new Error('User not found');
            }

            const userUpdate: Record<string, unknown> = {};

            if (!isBonusTarget) {
                const increment = type === 'DEPOSIT' ? normalizedAmount : -normalizedAmount;
                const currentBalance = wallet === 'crypto'
                    ? Number(user.cryptoBalance || 0)
                    : Number(user.balance || 0);

                if (type === 'WITHDRAWAL' && currentBalance + 0.0001 < normalizedAmount) {
                    throw new Error('Insufficient balance');
                }

                userUpdate[walletMeta.walletField] = { increment };

                if (type === 'DEPOSIT') {
                    userUpdate.wageringRequired = { increment: normalizedAmount };
                }
            } else {
                const currentBonusBalance =
                    wallet === 'sportsBonus'
                        ? roundCurrency(Number(user.sportsBonus || 0))
                        : wallet === 'cryptoBonus'
                            ? roundCurrency(Number(user.cryptoBonus || 0))
                            : roundCurrency(Number(user.casinoBonus || 0) + Number(user.fiatBonus || 0));

                if (currentBonusBalance + 0.0001 < normalizedAmount) {
                    throw new Error('Insufficient bonus balance');
                }

                const activeBonuses = await (tx as any).userBonus.findMany({
                    where: {
                        userId,
                        status: 'ACTIVE',
                        ...(wallet === 'sportsBonus'
                            ? {
                                applicableTo: { in: ['SPORTS'] },
                                bonusCurrency: { not: 'CRYPTO' },
                            }
                            : wallet === 'cryptoBonus'
                                ? {
                                    bonusCurrency: 'CRYPTO',
                                }
                                : {
                                    applicableTo: { in: ['CASINO', 'BOTH'] },
                                    bonusCurrency: { not: 'CRYPTO' },
                                }),
                    },
                    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                });

                let remaining = normalizedAmount;
                let globalReqDecrement = 0;
                let globalDoneDecrement = 0;
                let casinoReqDecrement = 0;
                let casinoDoneDecrement = 0;
                let sportsReqDecrement = 0;
                let sportsDoneDecrement = 0;
                const now = new Date();

                for (const bonus of activeBonuses) {
                    if (remaining <= 0.0001) break;

                    const currentBonusAmount = roundCurrency(Number(bonus.bonusAmount || 0));
                    if (currentBonusAmount <= 0.0001) continue;

                    const deduction = roundCurrency(Math.min(remaining, currentBonusAmount));
                    const currentReq = roundCurrency(Number(bonus.wageringRequired || 0));
                    const currentDone = roundCurrency(Math.min(Number(bonus.wageringDone || 0), currentReq));
                    const reqReduction =
                        currentBonusAmount > 0.0001 && currentReq > 0.0001
                            ? roundCurrency((currentReq * deduction) / currentBonusAmount)
                            : 0;
                    const nextBonusAmount = roundCurrency(Math.max(0, currentBonusAmount - deduction));
                    let nextWageringRequired = roundCurrency(Math.max(0, currentReq - reqReduction));
                    if (nextBonusAmount <= 0.0001) {
                        nextWageringRequired = 0;
                    }
                    const nextWageringDone = roundCurrency(Math.min(currentDone, nextWageringRequired));

                    globalReqDecrement = roundCurrency(globalReqDecrement + Math.max(0, currentReq - nextWageringRequired));
                    globalDoneDecrement = roundCurrency(globalDoneDecrement + Math.max(0, currentDone - nextWageringDone));

                    if (wallet === 'sportsBonus') {
                        sportsReqDecrement = roundCurrency(sportsReqDecrement + Math.max(0, currentReq - nextWageringRequired));
                        sportsDoneDecrement = roundCurrency(sportsDoneDecrement + Math.max(0, currentDone - nextWageringDone));
                    } else if (wallet === 'casinoBonus') {
                        casinoReqDecrement = roundCurrency(casinoReqDecrement + Math.max(0, currentReq - nextWageringRequired));
                        casinoDoneDecrement = roundCurrency(casinoDoneDecrement + Math.max(0, currentDone - nextWageringDone));
                    }

                    await (tx as any).userBonus.update({
                        where: { id: bonus.id },
                        data: {
                            bonusAmount: nextBonusAmount,
                            wageringRequired: nextWageringRequired,
                            wageringDone: nextWageringDone,
                            status: nextBonusAmount <= 0.0001 ? 'FORFEITED' : 'ACTIVE',
                            isEnabled: nextBonusAmount > 0.0001 ? Boolean(bonus.isEnabled) : false,
                            forfeitedAt: nextBonusAmount <= 0.0001 ? now : null,
                        },
                    });

                    remaining = roundCurrency(Math.max(0, remaining - deduction));
                }

                if (wallet === 'sportsBonus') {
                    userUpdate.sportsBonus = { decrement: normalizedAmount };
                } else if (wallet === 'cryptoBonus') {
                    userUpdate.cryptoBonus = { decrement: normalizedAmount };
                } else {
                    const casinoBalance = roundCurrency(Number(user.casinoBonus || 0));
                    const casinoDeduction = roundCurrency(Math.min(casinoBalance, normalizedAmount));
                    const fiatDeduction = roundCurrency(Math.max(0, normalizedAmount - casinoDeduction));
                    if (casinoDeduction > 0.0001) {
                        userUpdate.casinoBonus = { decrement: casinoDeduction };
                    }
                    if (fiatDeduction > 0.0001) {
                        userUpdate.fiatBonus = { decrement: fiatDeduction };
                    }
                }

                if (globalReqDecrement > 0.0001) {
                    userUpdate.wageringRequired = {
                        decrement: Math.min(roundCurrency(Number(user.wageringRequired || 0)), globalReqDecrement),
                    };
                }
                if (globalDoneDecrement > 0.0001) {
                    userUpdate.wageringDone = {
                        decrement: Math.min(roundCurrency(Number(user.wageringDone || 0)), globalDoneDecrement),
                    };
                }
                if (casinoReqDecrement > 0.0001) {
                    userUpdate.casinoBonusWageringRequired = {
                        decrement: Math.min(roundCurrency(Number(user.casinoBonusWageringRequired || 0)), casinoReqDecrement),
                    };
                }
                if (casinoDoneDecrement > 0.0001) {
                    userUpdate.casinoBonusWageringDone = {
                        decrement: Math.min(roundCurrency(Number(user.casinoBonusWageringDone || 0)), casinoDoneDecrement),
                    };
                }
                if (sportsReqDecrement > 0.0001) {
                    userUpdate.sportsBonusWageringRequired = {
                        decrement: Math.min(roundCurrency(Number(user.sportsBonusWageringRequired || 0)), sportsReqDecrement),
                    };
                }
                if (sportsDoneDecrement > 0.0001) {
                    userUpdate.sportsBonusWageringDone = {
                        decrement: Math.min(roundCurrency(Number(user.sportsBonusWageringDone || 0)), sportsDoneDecrement),
                    };
                }
            }

            await tx.user.update({
                where: { id: userId },
                data: userUpdate as Prisma.UserUpdateInput,
            });

            if (!skipTransactionLog) {
                await tx.transaction.create({
                    data: {
                        userId,
                        amount: normalizedAmount,
                        type: isBonusTarget ? 'BONUS_DEBIT' : type,
                        status: 'COMPLETED',
                        paymentMethod: walletMeta.paymentMethod,
                        paymentDetails: {
                            source: 'MANUAL_ADJUSTMENT',
                            walletType: wallet,
                            walletLabel: walletMeta.walletLabel,
                            skipTransactionLog: false,
                            isBonusAdjustment: isBonusTarget,
                        },
                        adminId,
                        remarks,
                        transactionId: `MAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    },
                });
            }

            await tx.auditLog.create({
                data: {
                    adminId,
                    action: isBonusTarget ? 'MANUAL_BONUS_ADJUSTMENT' : 'MANUAL_ADJUSTMENT',
                    details: {
                        userId,
                        type,
                        amount: normalizedAmount,
                        remarks,
                        wallet,
                        skipTransactionLog,
                    },
                },
            });
        });

        revalidatePath('/dashboard/finance/transactions');
        revalidatePath(`/dashboard/users/${userId}`);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to create adjustment' };
    }
}

export async function searchUsersForManualDeposit(search: string, limit = 8) {
    try {
        const query = search.trim();
        if (query.length < 2) return { success: true, data: [] };

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } },
                ],
            },
            select: {
                id: true,
                username: true,
                email: true,
                balance: true,
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        return { success: true, data: users };
    } catch (error) {
        console.error('searchUsersForManualDeposit error:', error);
        return { success: false, error: 'Failed to search users', data: [] };
    }
}

export async function createManualDeposit(data: {
    userId: number;
    amount: number;
    method?: string;
    utr?: string;
    remarks?: string;
    adminId?: number;
    wallet?: 'fiat' | 'crypto';
}) {
    try {
        const numAmount = Number(data.amount);
        if (!data.userId || !numAmount || numAmount <= 0) {
            return { success: false, error: 'userId and a positive amount are required' };
        }

        const user = await prisma.user.findUnique({
            where: { id: Number(data.userId) },
            select: { id: true, username: true, email: true },
        });
        if (!user) return { success: false, error: 'User not found' };

        // Determine target wallet. Prefer explicit `wallet` from the UI, fall
        // back to inferring from the `method` label so legacy callers still
        // route Crypto deposits to the right wallet instead of silently
        // crediting the fiat (INR) balance.
        const methodStr = (data.method || '').toLowerCase();
        const isCrypto =
            data.wallet === 'crypto' ||
            methodStr.includes('crypto');

        const utrRef = (data.utr || '').trim() || `ADMIN${Date.now()}`;
        const adminId = Number(data.adminId || 1);

        // Wallet routing:
        //  • Fiat: increment `balance`, bump INR totalDeposited + 1× deposit
        //    wagering lock (matches existing gateway deposit semantics).
        //  • Crypto: increment `cryptoBalance`. Deposit-wagering and
        //    totalDeposited are INR-denominated, so we intentionally do not
        //    touch them here (same pattern as createManualAdjustment above).
        const userUpdate: Prisma.UserUpdateInput = isCrypto
            ? { cryptoBalance: { increment: numAmount } }
            : {
                balance: { increment: numAmount },
                totalDeposited: { increment: numAmount },
                wageringRequired: { increment: numAmount },
            };

        const [, txn] = await prisma.$transaction([
            prisma.user.update({
                where: { id: Number(data.userId) },
                data: userUpdate,
            }),
            prisma.transaction.create({
                data: {
                    userId: Number(data.userId),
                    amount: numAmount,
                    type: 'DEPOSIT',
                    status: 'COMPLETED',
                    paymentMethod: data.method || (isCrypto ? 'Crypto (Manual)' : 'Manual Deposit (Admin)'),
                    utr: utrRef,
                    remarks: data.remarks || 'Manual deposit by admin',
                    adminId,
                    paymentDetails: {
                        gateway: 'admin_manual',
                        requiresAdminReview: false,
                        addedBy: adminId,
                        adminNote: data.remarks || '',
                        wallet: isCrypto ? 'crypto' : 'fiat',
                        currency: isCrypto ? 'USD' : 'INR',
                    } as Prisma.JsonObject,
                },
            }),
            prisma.auditLog.create({
                data: {
                    adminId,
                    action: 'MANUAL_DEPOSIT',
                    details: {
                        userId: Number(data.userId),
                        amount: numAmount,
                        method: data.method || 'Manual Deposit (Admin)',
                        utr: utrRef,
                        remarks: data.remarks || '',
                        wallet: isCrypto ? 'crypto' : 'fiat',
                    },
                },
            }),
        ]);

        revalidatePath('/dashboard/finance/deposits');
        revalidatePath('/dashboard/finance/transactions');
        revalidatePath(`/dashboard/users/${data.userId}`);

        const amountLabel = isCrypto ? `$${numAmount}` : `₹${numAmount}`;
        return {
            success: true,
            message: `Deposited ${amountLabel} to ${user.username || user.email}`,
            transactionId: txn.id,
        };
    } catch (error) {
        console.error('createManualDeposit error:', error);
        return { success: false, error: 'Failed to process manual deposit' };
    }
}

// dispatchWithdrawal removed — all withdrawals are now fully manual (admin approve/reject only).

/** Fetch transactions by their transactionId strings — used for CSV reconciliation */
export async function getTransactionsByIds(txnIds: string[]) {
    try {
        if (!txnIds.length) return [];
        const records = await prisma.transaction.findMany({
            where: { transactionId: { in: txnIds } },
            select: { transactionId: true, status: true, amount: true, type: true },
        });
        return records;
    } catch {
        return [];
    }
}


export async function getManualAdjustmentsList(page = 1, limit = 20, search = '') {
    try {
        const skip = (page - 1) * limit;

        // Query AuditLog for MANUAL_ADJUSTMENT / MANUAL_BONUS_ADJUSTMENT
        const auditWhere: Prisma.AuditLogWhereInput = {
            action: { in: ['MANUAL_ADJUSTMENT', 'MANUAL_BONUS_ADJUSTMENT'] },
        };

        const [auditLogs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where: auditWhere,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.auditLog.count({ where: auditWhere }),
        ]);

        // Hydrate with user info
        const userIds = [...new Set(
            auditLogs
                .map((log) => ((log.details as any)?.userId as number | undefined))
                .filter((id): id is number => typeof id === 'number'),
        )];

        const users = userIds.length
            ? await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, username: true, email: true, balance: true, cryptoBalance: true },
            })
            : [];

        const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

        const rows = auditLogs.map((log) => {
            const details = (log.details ?? {}) as Record<string, any>;
            const uid = details.userId as number | undefined;
            return {
                id: log.id,
                adminId: log.adminId,
                action: log.action,
                type: (details.type ?? 'DEPOSIT') as 'DEPOSIT' | 'WITHDRAWAL',
                amount: Number(details.amount ?? 0),
                wallet: (details.wallet ?? 'fiat') as string,
                remarks: (details.remarks ?? '') as string,
                createdAt: log.createdAt,
                user: uid ? (userMap[uid] ?? null) : null,
            };
        });

        // Optional search filter (client-side on hydrated rows, fast enough for audit logs)
        const filteredRows = search
            ? rows.filter(
                (r) =>
                    r.user?.username?.toLowerCase().includes(search.toLowerCase()) ||
                    r.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
                    r.remarks?.toLowerCase().includes(search.toLowerCase()),
            )
            : rows;

        return {
            success: true,
            data: filteredRows,
            pagination: {
                total: search ? filteredRows.length : total,
                page,
                limit,
                totalPages: Math.ceil((search ? filteredRows.length : total) / limit),
            },
        };
    } catch (error) {
        console.error('Failed to fetch manual adjustments:', error);
        return { success: false, error: 'Failed to fetch manual adjustments', data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    }
}
