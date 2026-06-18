'use server'

import connectMongo from '@/lib/mongo';
import { Bet } from '@/models/MongoModels';
import { prisma } from '@/lib/db';
import { settleEventMatchOddsInternal } from '@/actions/internal-match-odds-settlement';
import { internalSportradarSettlement } from '@/actions/internal-sportradar-settlement';
import { revalidatePath } from 'next/cache';
import { verifyAdmin } from '@/lib/admin-auth';

type BetWalletField = 'balance' | 'cryptoBalance' | 'sportsBonus';
type BetPayoutAllocation = {
    walletField: BetWalletField;
    walletLabel: string;
    amount: number;
};
type RawBet = Record<string, any> & {
    _id: any;
    userId: number;
    eventId?: string;
    matchId?: string;
    eventName?: string;
    marketId?: string;
    selectionName?: string;
    walletType?: string;
    betSource?: string;
    status?: string;
    stake?: number;
    potentialWin?: number;
    originalStake?: number;
    originalPotentialWin?: number;
};

function roundCurrency(value: number) {
    return Number(Number(value || 0).toFixed(2));
}

function normalizeText(value: unknown) {
    return String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim();
}

function getPrimaryWalletField(walletType?: string | null): BetWalletField {
    return walletType === 'crypto' ? 'cryptoBalance' : 'balance';
}

function getWalletFieldLabel(walletField: BetWalletField) {
    if (walletField === 'sportsBonus') return 'Sports Bonus Wallet';
    return walletField === 'cryptoBalance' ? 'Crypto Wallet' : 'Main Wallet';
}

function mapWalletFieldToPaymentMethod(walletField: BetWalletField) {
    if (walletField === 'sportsBonus') return 'BONUS_WALLET';
    return walletField === 'cryptoBalance' ? 'CRYPTO_WALLET' : 'MAIN_WALLET';
}

function getBetOriginalStake(bet: Pick<RawBet, 'stake' | 'originalStake'>) {
    return roundCurrency(Number(bet.originalStake ?? bet.stake ?? 0));
}

function getBetOriginalPotentialWin(bet: Pick<RawBet, 'potentialWin' | 'originalPotentialWin'>) {
    return roundCurrency(Number(bet.originalPotentialWin ?? bet.potentialWin ?? 0));
}

function resolveWalletFieldFromTransaction(txn: any): BetWalletField | null {
    const walletField = String(txn?.paymentDetails?.walletField || txn?.walletField || '').trim();
    if (walletField === 'balance' || walletField === 'cryptoBalance' || walletField === 'sportsBonus') {
        return walletField;
    }

    const paymentMethod = String(txn?.paymentMethod || txn?.paymentDetails?.paymentMethod || '').toUpperCase();
    if (paymentMethod === 'CRYPTO_WALLET') return 'cryptoBalance';
    if (paymentMethod === 'BONUS_WALLET') return 'sportsBonus';
    if (paymentMethod === 'MAIN_WALLET' || paymentMethod === 'FIAT_WALLET') return 'balance';

    return null;
}

function sumAllocations(allocations: BetPayoutAllocation[]) {
    const totals = new Map<BetWalletField, number>();

    for (const allocation of allocations) {
        if (!allocation.amount) continue;
        totals.set(
            allocation.walletField,
            roundCurrency((totals.get(allocation.walletField) || 0) + allocation.amount),
        );
    }

    return Array.from(totals.entries()).map(([walletField, amount]) => ({
        walletField,
        walletLabel: getWalletFieldLabel(walletField),
        amount: roundCurrency(amount),
    }));
}

function getBetBonusStakeAmount(bet: RawBet): number {
    const stored = roundCurrency(Number(bet.bonusStakeAmount ?? 0));
    if (stored > 0) return stored;
    const src = String(bet.betSource || '');
    return src.includes('sportsBonus') ? getBetOriginalStake(bet) : 0;
}

function buildPayoutAllocations(bet: RawBet, payoutAmount: number): BetPayoutAllocation[] {
    const payout = roundCurrency(payoutAmount);
    if (payout <= 0) return [];

    const primaryWalletField = getPrimaryWalletField(String(bet.walletType || ''));
    const originalStake = getBetOriginalStake(bet);
    const bonusStake = Math.min(originalStake, getBetBonusStakeAmount(bet));
    const walletStake = roundCurrency(Math.max(0, originalStake - bonusStake));

    // Pure main wallet bet
    if (bonusStake <= 0 || originalStake <= 0) {
        return [{ walletField: primaryWalletField, walletLabel: getWalletFieldLabel(primaryWalletField), amount: payout }];
    }

    // Pure bonus bet
    if (walletStake <= 0) {
        return [{ walletField: 'sportsBonus', walletLabel: getWalletFieldLabel('sportsBonus'), amount: payout }];
    }

    // Split bet — proportional split
    const bonusPayout = roundCurrency((payout * bonusStake) / originalStake);
    const walletPayout = roundCurrency(payout - bonusPayout);
    return ([
        { walletField: 'sportsBonus' as BetWalletField, walletLabel: getWalletFieldLabel('sportsBonus'), amount: bonusPayout },
        { walletField: primaryWalletField as BetWalletField, walletLabel: getWalletFieldLabel(primaryWalletField), amount: walletPayout },
    ] as BetPayoutAllocation[]).filter(a => a.amount > 0);
}

function buildVoidRefundAllocations(bet: RawBet): BetPayoutAllocation[] {
    const originalStake = getBetOriginalStake(bet);
    const bonusStakeAmount = roundCurrency(Number(bet.bonusStakeAmount || 0));
    const walletStakeAmount = roundCurrency(Number(bet.walletStakeAmount || 0));
    const primaryWalletField = getPrimaryWalletField(String(bet.walletType || ''));
    const allocations: BetPayoutAllocation[] = [];

    if (bonusStakeAmount > 0) {
        allocations.push({
            walletField: 'sportsBonus',
            walletLabel: getWalletFieldLabel('sportsBonus'),
            amount: bonusStakeAmount,
        });
    }

    const primaryWalletAmount = walletStakeAmount > 0
        ? walletStakeAmount
        : Math.max(0, roundCurrency(originalStake - bonusStakeAmount));

    if (primaryWalletAmount > 0) {
        allocations.push({
            walletField: primaryWalletField,
            walletLabel: getWalletFieldLabel(primaryWalletField),
            amount: primaryWalletAmount,
        });
    }

    if (!allocations.length && originalStake > 0) {
        allocations.push({
            walletField: primaryWalletField,
            walletLabel: getWalletFieldLabel(primaryWalletField),
            amount: originalStake,
        });
    }

    return sumAllocations(allocations);
}

function getVoidRefundAllocations(bet: RawBet): BetPayoutAllocation[] {
    return buildVoidRefundAllocations(bet);
}



async function getCashoutReversalAllocations(bet: RawBet): Promise<BetPayoutAllocation[]> {
    const cashoutTransactions = await prisma.transaction.findMany({
        where: {
            userId: Number(bet.userId),
            type: 'BET_CASHOUT',
            status: 'COMPLETED',
        },
        orderBy: { createdAt: 'asc' },
    });

    const relevantTransactions = cashoutTransactions.filter((txn) => {
        const paymentDetails =
            txn.paymentDetails && typeof txn.paymentDetails === 'object' && !Array.isArray(txn.paymentDetails)
                ? (txn.paymentDetails as Record<string, any>)
                : {};

        return String(paymentDetails.betId || '') === String(bet._id);
    });

    const allocations: BetPayoutAllocation[] = [];

    for (const txn of relevantTransactions) {
        const paymentDetails =
            txn.paymentDetails && typeof txn.paymentDetails === 'object' && !Array.isArray(txn.paymentDetails)
                ? (txn.paymentDetails as Record<string, any>)
                : {};
        const rawAllocations = Array.isArray(paymentDetails.allocations) ? paymentDetails.allocations : [];

        if (rawAllocations.length > 0) {
            for (const allocation of rawAllocations) {
                const walletField = resolveWalletFieldFromTransaction(allocation);
                const amount = roundCurrency(Number(allocation?.amount || 0));
                if (!walletField || amount <= 0) continue;

                allocations.push({
                    walletField,
                    walletLabel: getWalletFieldLabel(walletField),
                    amount,
                });
            }
            continue;
        }

        const fallbackWalletField =
            resolveWalletFieldFromTransaction(txn) ||
            (String(bet.betSource || '').includes('sportsBonus')
                ? 'sportsBonus'
                : getPrimaryWalletField(String(bet.walletType || '')));
        const fallbackAmount = roundCurrency(Number(txn.amount || 0));

        if (fallbackAmount > 0) {
            allocations.push({
                walletField: fallbackWalletField,
                walletLabel: getWalletFieldLabel(fallbackWalletField),
                amount: fallbackAmount,
            });
        }
    }

    return sumAllocations(allocations);
}

async function getWinReversalAllocations(bet: RawBet): Promise<BetPayoutAllocation[]> {
    if (String(bet.status || '') !== 'WON') {
        return [];
    }

    const winAmount = roundCurrency(Number(bet.potentialWin || 0));
    if (winAmount <= 0) {
        return [];
    }

    const winTransactions = await prisma.transaction.findMany({
        where: {
            userId: Number(bet.userId),
            type: 'BET_WIN',
            status: 'COMPLETED',
            amount: winAmount,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
    });

    const matchedTransaction =
        winTransactions.find((txn) => {
            const paymentDetails =
                txn.paymentDetails && typeof txn.paymentDetails === 'object' && !Array.isArray(txn.paymentDetails)
                    ? (txn.paymentDetails as Record<string, any>)
                    : {};

            if (String(paymentDetails.marketId || '') === String(bet.marketId || '')) {
                return true;
            }

            const remarks = String(txn.remarks || '');
            return remarks.includes(String(bet.eventName || '')) && remarks.includes(String(bet.selectionName || ''));
        }) || winTransactions[0];

    const walletField = resolveWalletFieldFromTransaction(matchedTransaction) || 'balance';

    return [{
        walletField,
        walletLabel: getWalletFieldLabel(walletField),
        amount: winAmount,
    }];
}

async function getAdminIdFromSession() {
    // SECURITY: verify JWT signature — `decodeJwt` alone is not an auth check.
    const admin = await verifyAdmin();
    return admin ? admin.id : null;
}

function getBetProviderLabel(bet: any) {
    const rawProvider = normalizeText(
        bet?.provider ||
        bet?.snapshot?.providerName ||
        bet?.paymentDetails?.provider ||
        '',
    ).toLowerCase();

    return rawProvider === 'sportradar' ? 'SPORTRADAR' : 'DIAMOND';
}

function getBetDisplayMarketName(bet: any) {
    return normalizeText(
        bet?.srMarketName ||
        bet?.marketName ||
        bet?.computedMarketName ||
        bet?.nat ||
        bet?.srMarketFullId ||
        bet?.marketId ||
        '',
    );
}

function getBetDisplaySelectionName(bet: any) {
    return normalizeText(
        bet?.srRunnerName ||
        bet?.selectionName ||
        bet?.selectedTeam ||
        bet?.srRunnerId ||
        bet?.selectionId ||
        '',
    );
}

function getBetWinnerName(bet: any) {
    const settledReason = normalizeText(bet?.settledReason || '');
    const match = /winner:\s*([^.]*)/i.exec(settledReason);
    return normalizeText(match?.[1] || '');
}

function buildBetOddsInfo(bet: any) {
    const snapshot = bet?.snapshot;
    if (snapshot && typeof snapshot === 'object') {
        return {
            provider: getBetProviderLabel(bet),
            acceptedOdds: snapshot.odds ?? bet.odds,
            submittedOdds: snapshot.submittedOdds ?? null,
            profit: snapshot.profit ?? null,
            marketType: snapshot.marketType ?? bet.gtype ?? null,
            oddsAdjusted:
                snapshot.submittedOdds != null &&
                snapshot.submittedOdds !== snapshot.odds,
        };
    }

    return {
        provider: getBetProviderLabel(bet),
        acceptedOdds: bet.odds,
        submittedOdds: null,
        profit: null,
        marketType: bet.gtype ?? null,
        oddsAdjusted: false,
    };
}

function enrichBetsWithUsers(bets: any[], usernameByUserId: Map<number, string | null>) {
    return bets.map((bet: any) => ({
        ...bet,
        id: String(bet._id),
        username: usernameByUserId.get(Number(bet.userId)) || null,
        providerLabel: getBetProviderLabel(bet),
        displayMarketName: getBetDisplayMarketName(bet),
        displaySelectionName: getBetDisplaySelectionName(bet),
        winnerName: getBetWinnerName(bet),
        oddsInfo: buildBetOddsInfo(bet),
    }));
}

// ─── Get pending bets ──────────────────────────────────────────────────────────
export async function getPendingBets(page = 1, limit = 100) {
    try {
        await connectMongo();
        const skip = (page - 1) * limit;
        const [bets, total] = await Promise.all([
            Bet.find({ status: 'PENDING' })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Bet.countDocuments({ status: 'PENDING' }),
        ]);
        const userIds = Array.from(
            new Set(
                bets
                    .map((bet: any) => Number(bet.userId))
                    .filter((userId) => Number.isFinite(userId) && userId > 0),
            ),
        );
        const users = userIds.length
            ? await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, username: true },
            })
            : [];
        const usernameByUserId = new Map(
            users.map((user) => [user.id, user.username || null]),
        );
        const enrichedBets = enrichBetsWithUsers(bets, usernameByUserId);
        return {
            success: true,
            data: JSON.parse(JSON.stringify(enrichedBets)),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    } catch (err: any) {
        console.error('getPendingBets error:', err);
        return { success: false, data: [], pagination: { page, limit, total: 0, pages: 0 } };
    }
}

// ─── Manual settle a single bet ────────────────────────────────────────────────
export async function manualSettleBet(
    betId: string,
    outcome: 'WON' | 'LOST' | 'VOID',
    adminNote = 'Manual admin settlement',
): Promise<{ success: boolean; message: string }> {
    try {
        await connectMongo();

        const bet = await Bet.findById(betId);
        if (!bet) return { success: false, message: `Bet ${betId} not found` };
        if (bet.status !== 'PENDING') {
            return { success: false, message: `Bet is already ${bet.status}, cannot re-settle` };
        }

        // ── Build wallet allocations respecting original funding source ─────────
        const updateData: any = {
            exposure: { decrement: Number(bet.stake || 0) }, // always release exposure
        };

        let allocations: BetPayoutAllocation[] = [];
        let txType: string;
        let txAmount: number;
        let paymentMethod: string | null = null;

        if (outcome === 'WON') {
            allocations = buildPayoutAllocations(bet as any, Number(bet.potentialWin || 0));
            for (const alloc of allocations) {
                updateData[alloc.walletField] = { increment: alloc.amount };
            }
            txType = 'BET_WIN';
            txAmount = roundCurrency(Number(bet.potentialWin || 0));
            paymentMethod = allocations.length === 1
                ? mapWalletFieldToPaymentMethod(allocations[0].walletField)
                : 'MULTI_WALLET';
        } else if (outcome === 'VOID') {
            allocations = buildVoidRefundAllocations(bet as any);
            for (const alloc of allocations) {
                updateData[alloc.walletField] = { increment: alloc.amount };
            }
            txType = 'BET_REFUND';
            txAmount = roundCurrency(Number(bet.stake || 0));
            paymentMethod = allocations.length === 1
                ? mapWalletFieldToPaymentMethod(allocations[0].walletField)
                : 'MULTI_WALLET';
        } else {
            // LOST — no credit, only release exposure
            txType = 'BET_LOSS';
            txAmount = roundCurrency(Number(bet.stake || 0));
        }

        await prisma.$transaction([
            prisma.user.update({ where: { id: bet.userId }, data: updateData }),
            prisma.transaction.create({
                data: {
                    userId: bet.userId,
                    amount: txAmount,
                    type: txType,
                    status: 'COMPLETED',
                    paymentMethod: outcome === 'LOST' ? null : paymentMethod,
                    paymentDetails: outcome === 'LOST' ? undefined : {
                        source: 'MANUAL_SETTLEMENT',
                        betId: String(bet._id),
                        walletField: allocations.length === 1 ? allocations[0].walletField : null,
                        walletLabel: allocations.length === 1
                            ? allocations[0].walletLabel
                            : allocations.map(a => a.walletLabel).join(' + '),
                        allocations,
                    },
                    remarks: `${adminNote} — ${outcome}`,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            }),
        ]);

        // ── Update MongoDB bet document ────────────────────────────────────────
        bet.status = outcome;
        bet.settledReason = adminNote;
        bet.settledAt = new Date();
        await bet.save();

        return { success: true, message: `Bet settled as ${outcome}` };
    } catch (err: any) {
        console.error('manualSettleBet error:', err);
        return { success: false, message: err.message || 'Settlement failed' };
    }
}


export async function settleEventMatchOdds(
    eventId: string,
    winningSelectionId: string,
    winningSelectionName?: string,
): Promise<{ success: boolean; message: string; settled?: number; total?: number; errors?: number }> {
    return settleEventMatchOddsInternal(eventId, winningSelectionId, winningSelectionName);
}

export async function superVoidEvent(
    eventId: string,
    reason: string,
): Promise<{
    success: boolean;
    message: string;
    data?: {
        total?: number;
        voided?: number;
        alreadyVoided?: number;
        reversedAmount?: number;
        refundedAmount?: number;
        errors?: string[];
    };
}> {
    const normalizedEventId = normalizeText(eventId);
    const normalizedReason = normalizeText(reason);

    if (!normalizedEventId) {
        return { success: false, message: 'Enter the event ID you want to super void.' };
    }

    if (!normalizedReason) {
        return { success: false, message: 'Enter a reason so users can see why the event was voided.' };
    }

    try {
        const adminId = await getAdminIdFromSession();
        if (!adminId) {
            return { success: false, message: 'Admin session expired. Please sign in again.' };
        }
        await connectMongo();

        const bets = await Bet.collection.find({
            $or: [{ eventId: normalizedEventId }, { matchId: normalizedEventId }],
        }).toArray() as RawBet[];

        if (!bets.length) {
            return { success: false, message: 'No bets found for this event.' };
        }

        const summary = {
            total: bets.length,
            voided: 0,
            alreadyVoided: 0,
            reversedAmount: 0,
            refundedAmount: 0,
            errors: [] as string[],
        };

        for (const bet of bets) {
            if (String(bet.status || '') === 'VOID') {
                summary.alreadyVoided += 1;
                continue;
            }

            try {
                const previousStatus = String(bet.status || 'PENDING');
                const originalStake = getBetOriginalStake(bet);
                const originalPotentialWin = getBetOriginalPotentialWin(bet);
                const remainingExposure = previousStatus === 'PENDING'
                    ? roundCurrency(Number(bet.stake || 0))
                    : 0;

                const [cashoutReversals, winReversals] = await Promise.all([
                    getCashoutReversalAllocations(bet),
                    getWinReversalAllocations(bet),
                ]);

                const reversalAllocations = sumAllocations([...cashoutReversals, ...winReversals]);
                const refundAllocations = getVoidRefundAllocations(bet);
                const totalReversed = roundCurrency(
                    reversalAllocations.reduce((sum, allocation) => sum + allocation.amount, 0),
                );
                const totalRefunded = roundCurrency(
                    refundAllocations.reduce((sum, allocation) => sum + allocation.amount, 0),
                );

                const walletDeltas = new Map<BetWalletField, number>();
                for (const allocation of refundAllocations) {
                    walletDeltas.set(
                        allocation.walletField,
                        roundCurrency((walletDeltas.get(allocation.walletField) || 0) + allocation.amount),
                    );
                }
                for (const allocation of reversalAllocations) {
                    walletDeltas.set(
                        allocation.walletField,
                        roundCurrency((walletDeltas.get(allocation.walletField) || 0) - allocation.amount),
                    );
                }

                const userUpdateData: Record<string, any> = {};
                for (const [walletField, amount] of walletDeltas.entries()) {
                    if (amount > 0) {
                        userUpdateData[walletField] = { increment: amount };
                    } else if (amount < 0) {
                        userUpdateData[walletField] = { decrement: Math.abs(amount) };
                    }
                }
                if (remainingExposure > 0) {
                    userUpdateData.exposure = { decrement: remainingExposure };
                }

                const reasonForHistory = [
                    'Event super void applied by admin.',
                    `Reason: ${normalizedReason}.`,
                    `Previous status: ${previousStatus}.`,
                    totalReversed > 0 ? `Reversed previous returns ₹${totalReversed.toFixed(2)}.` : null,
                    `Refunded original stake ₹${totalRefunded.toFixed(2)}.`,
                ]
                    .filter(Boolean)
                    .join(' ');

                await prisma.$transaction(async (tx) => {
                    if (Object.keys(userUpdateData).length > 0) {
                        await tx.user.update({
                            where: { id: Number(bet.userId) },
                            data: userUpdateData,
                        });
                    }

                    for (const allocation of reversalAllocations) {
                        await tx.transaction.create({
                            data: {
                                userId: Number(bet.userId),
                                amount: allocation.amount,
                                type: 'BET_VOID_DEBIT',
                                status: 'COMPLETED',
                                paymentMethod: mapWalletFieldToPaymentMethod(allocation.walletField),
                                paymentDetails: {
                                    source: 'BET_EVENT_SUPER_VOID',
                                    direction: 'DEBIT',
                                    walletField: allocation.walletField,
                                    walletLabel: allocation.walletLabel,
                                    betId: String(bet._id),
                                    eventId: normalizedEventId,
                                    previousStatus,
                                },
                                remarks: `Super void reversal: ${bet.eventName || 'Unknown event'} — ${bet.selectionName || 'Unknown selection'}. ${normalizedReason}`,
                                adminId,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            },
                        });
                    }

                    for (const allocation of refundAllocations) {
                        await tx.transaction.create({
                            data: {
                                userId: Number(bet.userId),
                                amount: allocation.amount,
                                type: 'BET_REFUND',
                                status: 'COMPLETED',
                                paymentMethod: mapWalletFieldToPaymentMethod(allocation.walletField),
                                paymentDetails: {
                                    source: 'BET_EVENT_SUPER_VOID',
                                    tag: 'EVENT_VOID_REFUND',
                                    walletField: allocation.walletField,
                                    walletLabel: allocation.walletLabel,
                                    betId: String(bet._id),
                                    eventId: normalizedEventId,
                                    previousStatus,
                                },
                                remarks: `Super void refund: ${bet.eventName || 'Unknown event'} — ${bet.selectionName || 'Unknown selection'}. ${normalizedReason}`,
                                adminId,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            },
                        });
                    }
                });

                await Bet.collection.updateOne(
                    { _id: bet._id },
                    {
                        $set: {
                            status: 'VOID',
                            originalStake,
                            stake: originalStake,
                            originalPotentialWin,
                            potentialWin: originalPotentialWin,
                            partialCashoutValue: 0,
                            partialCashoutCount: 0,
                            settledReason: reasonForHistory,
                            settledAt: new Date(),
                        },
                        $unset: {
                            lastPartialCashoutAt: '',
                            cashoutValue: '',
                            cashedOutAt: '',
                        },
                    },
                );

                summary.voided += 1;
                summary.reversedAmount = roundCurrency(summary.reversedAmount + totalReversed);
                summary.refundedAmount = roundCurrency(summary.refundedAmount + totalRefunded);
            } catch (error: any) {
                console.error(`superVoidEvent failed for bet ${String(bet._id)}:`, error);
                summary.errors.push(`Bet ${String(bet._id)}: ${error?.message || 'Failed to void bet'}`);
            }
        }

        revalidatePath('/dashboard/settlement');
        revalidatePath('/dashboard/sports/settlement');
        revalidatePath('/dashboard/sports/super-void');

        return {
            success: true,
            message: 'Super void complete',
            data: summary,
        };
    } catch (error) {
        console.error('superVoidEvent error:', error);
        return { success: false, message: 'Failed to super void the event.' };
    }
}

// ─── Simple stats for display ──────────────────────────────────────────────────
export async function getSettlementStats() {
    try {
        await connectMongo();
        const [pending, wonToday, lostToday] = await Promise.all([
            Bet.countDocuments({ status: 'PENDING' }),
            Bet.countDocuments({
                status: 'WON',
                settledAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            }),
            Bet.countDocuments({
                status: 'LOST',
                settledAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            }),
        ]);
        return { success: true, data: { pending, wonToday, lostToday } };
    } catch {
        return { success: false, data: { pending: 0, wonToday: 0, lostToday: 0 } };
    }
}

// ─── Dangerous: wipe ALL bets from the database ───────────────────────────────
export async function clearAllBets(): Promise<{ success: boolean; message: string; deleted?: number }> {
    try {
        const adminId = await getAdminIdFromSession();
        if (!adminId) {
            return { success: false, message: 'Admin session expired. Please sign in again.' };
        }
        await connectMongo();
        const result = await Bet.deleteMany({});
        revalidatePath('/dashboard/settlement');
        return {
            success: true,
            message: `Deleted ${result.deletedCount ?? 0} bet(s) from the database.`,
            deleted: result.deletedCount ?? 0,
        };
    } catch (err: any) {
        console.error('clearAllBets error:', err);
        return { success: false, message: err?.message || 'Failed to clear bets.' };
    }
}

// ─── Get settled bets (WON / LOST / VOID / CASHED_OUT) ────────────────────────
export async function getSettledBets(page = 1, limit = 100) {
    try {
        await connectMongo();
        const skip = (page - 1) * limit;
        const [bets, total] = await Promise.all([
            Bet.find({ status: { $in: ['WON', 'LOST', 'VOID', 'CASHED_OUT'] } })
                .sort({ settledAt: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Bet.countDocuments({ status: { $in: ['WON', 'LOST', 'VOID', 'CASHED_OUT'] } }),
        ]);

        const userIds = Array.from(new Set(
            bets.map((b: any) => Number(b.userId)).filter(id => Number.isFinite(id) && id > 0)
        ));
        const users = userIds.length
            ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } })
            : [];
        const usernameByUserId = new Map(users.map(u => [u.id, u.username || null]));

        const enriched = enrichBetsWithUsers(bets, usernameByUserId);

        return {
            success: true,
            data: JSON.parse(JSON.stringify(enriched)),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    } catch (err: any) {
        console.error('getSettledBets error:', err);
        return { success: false, data: [], pagination: { page, limit, total: 0, pages: 0 } };
    }
}

// ─── Settle all bets for a market by winning selectionId ──────────────────────
export async function settleBetsByMarket(
    marketId: string,
    winningSelectionId: string,
    eventId?: string,
): Promise<{ success: boolean; message: string; settled?: number }> {
    try {
        await connectMongo();

        const pendingBets = await Bet.find({
            status: 'PENDING',
            $and: [
                { $or: [{ marketId }, { srMarketFullId: marketId }] },
                ...(eventId?.trim()
                    ? [{ $or: [{ eventId }, { matchId: eventId }, { srEventId: eventId }] }]
                    : []),
            ],
        }).lean() as RawBet[];

        if (!pendingBets.length) {
            return { success: false, message: 'No pending bets found for this market' };
        }

        let settled = 0;
        for (const bet of pendingBets) {
            const isWinner = String(bet.selectionId || '') === String(winningSelectionId);
            const outcome = isWinner ? 'WON' : 'LOST';
            const result = await manualSettleBet(bet._id.toString(), outcome, 'Admin market settlement');
            if (result.success) settled++;
        }

        revalidatePath('/dashboard/sports/settlement');
        revalidatePath('/dashboard/settlement');
        return { success: true, message: `Settled ${settled} of ${pendingBets.length} bets`, settled };
    } catch (err: any) {
        console.error('settleBetsByMarket error:', err);
        return { success: false, message: err.message || 'Settlement failed' };
    }
}

// ─── Settle bets by Sportradar market-result (auto-settlement) ──────────────
/**
 * Calls the backend to fetch Sportradar market-result for an event
 * and auto-settle all PENDING bets for the SETTLED markets.
 *
 * @param eventId   - Sportradar event ID (e.g. sr:match:70210632)
 * @param marketId  - (optional) only settle bets for this specific market
 */
export async function settleByMarketResult(
    eventId: string,
    marketId?: string,
): Promise<{
    success: boolean;
    message: string;
    marketsProcessed?: number;
    betsSettled?: number;
    errors?: string[];
}> {
    if (!eventId?.trim()) {
        return { success: false, message: 'eventId is required' };
    }

    try {
        const adminId = 0; // Or retrieve from session if needed
        const result = await internalSportradarSettlement(eventId.trim(), adminId, marketId);

        revalidatePath('/dashboard/sports/settlement');
        revalidatePath('/dashboard/settlement');

        return result;
    } catch (err: any) {
        console.error('settleByMarketResult error:', err);
        return { success: false, message: err.message || 'Settlement request failed locally' };
    }
}
