'use server'

import connectMongo from '@/lib/mongo';
import { prisma } from '@/lib/db';
import { Bet } from '@/models/MongoModels';
import mongoose from 'mongoose';

type BetWalletField = 'balance' | 'cryptoBalance' | 'sportsBonus';

function roundCurrency(value: number) {
    return Number(Number(value || 0).toFixed(2));
}

function normalizeText(value: unknown) {
    return String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isMatchOddsBet(bet: {
    gtype?: string | null;
    marketName?: string | null;
    computedMarketName?: string | null;
    mname?: string | null;
}) {
    const gtype = String(bet.gtype || '').toLowerCase();
    const marketName = String(bet.marketName || bet.computedMarketName || '').toLowerCase();
    const mname = String(bet.mname || '').toLowerCase();

    if (['session', 'fancy', 'fancy2', 'khado', 'meter', 'oddeven', 'other fancy'].includes(gtype)) {
        return false;
    }

    if (mname.includes('bookmaker') || mname.includes('fancy')) {
        return false;
    }

    return marketName.includes('match odds') || marketName.includes('match_odds') || gtype === 'match';
}

function getRunnerSelectionId(runner: any) {
    const rawId =
        runner?.sid ??
        runner?.selectionId ??
        runner?.selection_id ??
        runner?.id ??
        runner?.ri ??
        runner?.RunnerID;

    if (rawId === null || rawId === undefined || rawId === '') return '';
    return String(rawId);
}

function getRunnerDisplayName(runner: any) {
    return normalizeText(
        runner?.nat ??
        runner?.RunnerName ??
        runner?.runnerName ??
        runner?.name ??
        runner?.oname,
    );
}

function getBetSelectionName(bet: any) {
    return normalizeText(bet.selectionName || bet.selectedTeam || bet.selectionId || '');
}

async function resolveSportradarWinningSelection(
    eventId: string,
    winningSelectionId: string,
    winningSelectionName: string | undefined,
) {
    if (!eventId.startsWith('sr:')) return null;

    const sportsApiKey = process.env.SPORTS_API_KEY || '6a9d10424b039000ab1caa11';
    const apiUrl = `https://sportradar-api.p.rapidapi.com/market-result?sportId=sr:sport:21&eventId=${eventId}`;
    const normalizedSelectionId = normalizeText(winningSelectionId);
    const normalizedSelectionName = normalizeText(winningSelectionName);
    const normalizedSelectionNameLower = normalizedSelectionName.toLowerCase();

    try {
        const response = await fetch(apiUrl, {
            headers: {
                'X-RapidAPI-Key': sportsApiKey,
                'X-RapidAPI-Host': 'sportradar-api.p.rapidapi.com',
            },
        });
        const result = await response.json();
        const matchOdds: any[] = result?.event?.markets?.matchOdds ?? [];

        for (const market of matchOdds) {
            const runners = Array.isArray(market?.runners) ? market.runners : [];
            for (const runner of runners) {
                const runnerId = normalizeText(runner?.runnerId);
                const runnerName = normalizeText(runner?.runnerName);
                if (!runnerId && !runnerName) continue;

                if (normalizedSelectionId && runnerId === normalizedSelectionId) {
                    return {
                        selectionId: runnerId,
                        selectionName: runnerName || normalizedSelectionName,
                    };
                }

                if (
                    normalizedSelectionNameLower &&
                    runnerName &&
                    runnerName.toLowerCase() === normalizedSelectionNameLower
                ) {
                    return {
                        selectionId: runnerId,
                        selectionName: runnerName,
                    };
                }
            }
        }
    } catch (error) {
        console.warn(`[settleEventMatchOddsInternal] official result lookup failed for ${eventId}:`, error);
    }

    return null;
}

function getBetBonusStakeAmount(bet: any): number {
    const stored = roundCurrency(Number(bet.bonusStakeAmount ?? 0));
    if (stored > 0) return stored;
    const src = String(bet.betSource || '');
    return src.includes('sportsBonus') ? roundCurrency(Number(bet.originalStake || bet.stake || 0)) : 0;
}

type BetPayoutAllocation = {
    walletField: BetWalletField;
    walletLabel: string;
    amount: number;
};

function buildPayoutAllocations(bet: any, payoutAmount: number): BetPayoutAllocation[] {
    const payout = roundCurrency(payoutAmount);
    if (payout <= 0) return [];

    const walletType = String(bet.walletType || '');
    const primaryWalletField: BetWalletField = walletType === 'crypto' ? 'cryptoBalance' : 'balance';
    const originalStake = roundCurrency(Number(bet.originalStake || bet.stake || 0));
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

    // Split bet — proportional
    const bonusPayout = roundCurrency((payout * bonusStake) / originalStake);
    const walletPayout = roundCurrency(payout - bonusPayout);
    const splitAllocs: BetPayoutAllocation[] = [];
    if (bonusPayout > 0) splitAllocs.push({ walletField: 'sportsBonus', walletLabel: getWalletFieldLabel('sportsBonus'), amount: bonusPayout });
    if (walletPayout > 0) splitAllocs.push({ walletField: primaryWalletField, walletLabel: getWalletFieldLabel(primaryWalletField), amount: walletPayout });
    return splitAllocs;
}

function mapWalletFieldToPaymentMethod(walletField: BetWalletField) {
    if (walletField === 'sportsBonus') return 'BONUS_WALLET';
    return walletField === 'cryptoBalance' ? 'CRYPTO_WALLET' : 'MAIN_WALLET';
}

function getWalletFieldLabel(walletField: BetWalletField) {
    if (walletField === 'sportsBonus') return 'Sports Bonus Wallet';
    return walletField === 'cryptoBalance' ? 'Crypto Wallet' : 'Main Wallet';
}

async function resolveWinningSelection(
    eventId: string,
    winningSelectionId: string,
    winningSelectionName: string | undefined,
    bets: any[],
) {
    const apiResolvedWinner = await resolveSportradarWinningSelection(
        eventId,
        winningSelectionId,
        winningSelectionName,
    );
    if (apiResolvedWinner) {
        return apiResolvedWinner;
    }

    const normalizedSelectionId = normalizeText(winningSelectionId);
    const normalizedSelectionName = normalizeText(winningSelectionName);
    const normalizedSelectionNameLower = normalizedSelectionName.toLowerCase();

    if (normalizedSelectionId) {
        const matchingBet = bets.find((bet) => String(bet.selectionId || '') === normalizedSelectionId);
        if (matchingBet) {
            return {
                selectionId: normalizedSelectionId,
                selectionName: getBetSelectionName(matchingBet) || normalizedSelectionName,
            };
        }
    }

    if (normalizedSelectionNameLower) {
        const matchingBet = bets.find(
            (bet) => getBetSelectionName(bet).toLowerCase() === normalizedSelectionNameLower,
        );
        if (matchingBet) {
            return {
                selectionId: normalizeText(matchingBet.selectionId),
                selectionName: getBetSelectionName(matchingBet) || normalizedSelectionName,
            };
        }
    }

    const db = mongoose.connection.db;
    if (db) {
        const markets = await db.collection('markets')
            .find({ event_id: eventId })
            .project({ market_name: 1, gtype: 1, mname: 1, runners_data: 1, marketOdds: 1, section: 1 })
            .toArray();

        for (const market of markets) {
            if (!isMatchOddsBet({
                gtype: market?.gtype,
                marketName: market?.market_name,
                mname: market?.mname,
            })) {
                continue;
            }

            const runnerCollections = [market?.runners_data, market?.marketOdds, market?.section];
            for (const runners of runnerCollections) {
                if (!Array.isArray(runners)) continue;

                for (const runner of runners) {
                    const runnerId = getRunnerSelectionId(runner);
                    const runnerName = getRunnerDisplayName(runner);

                    if (normalizedSelectionId && runnerId === normalizedSelectionId) {
                        return {
                            selectionId: runnerId,
                            selectionName: runnerName || normalizedSelectionName,
                        };
                    }

                    if (
                        normalizedSelectionNameLower &&
                        runnerName &&
                        runnerName.toLowerCase() === normalizedSelectionNameLower
                    ) {
                        return {
                            selectionId: runnerId,
                            selectionName: runnerName,
                        };
                    }
                }
            }
        }
    }

    if (normalizedSelectionId || normalizedSelectionName) {
        return {
            selectionId: normalizedSelectionId,
            selectionName: normalizedSelectionName,
        };
    }

    throw new Error('Winning team is required to settle Match Odds.');
}

function betMatchesWinner(bet: any, winner: { selectionId: string; selectionName: string }) {
    const betSelectionId = normalizeText(bet.selectionId);
    const betSelectionName = getBetSelectionName(bet).toLowerCase();
    const winnerSelectionId = normalizeText(winner.selectionId);
    const winnerSelectionName = normalizeText(winner.selectionName).toLowerCase();

    if (winnerSelectionId && betSelectionId === winnerSelectionId) {
        return true;
    }

    if (winnerSelectionName && betSelectionName === winnerSelectionName) {
        return true;
    }

    return false;
}

export async function settleEventMatchOddsInternal(
    eventId: string,
    winningSelectionId: string,
    winningSelectionName?: string,
    adminId = 0,
): Promise<{ success: boolean; message: string; settled: number; total: number; errors: number }> {
    try {
        const normalizedEventId = normalizeText(eventId);
        if (!normalizedEventId) {
            return { success: false, message: 'Event id is required.', settled: 0, total: 0, errors: 0 };
        }

        await connectMongo();

        const bets = await Bet.find({
            $or: [{ eventId: normalizedEventId }, { matchId: normalizedEventId }],
            status: 'PENDING',
        });

        const matchOddsBets = bets.filter((bet: any) => isMatchOddsBet(bet));
        if (matchOddsBets.length === 0) {
            return {
                success: false,
                message: 'No pending Match Odds bets found for this event.',
                settled: 0,
                total: 0,
                errors: 0,
            };
        }

        const winner = await resolveWinningSelection(
            normalizedEventId,
            winningSelectionId,
            winningSelectionName,
            matchOddsBets,
        );

        let settled = 0;
        let errors = 0;

        for (const bet of matchOddsBets) {
            try {
                const isBack = String(bet.betType || 'back').toLowerCase() !== 'lay';
                const isSelectionWinner = betMatchesWinner(bet, winner);
                const userWins = isBack ? isSelectionWinner : !isSelectionWinner;
                const status = userWins ? 'WON' : 'LOST';
                const payout = userWins ? roundCurrency(Number(bet.potentialWin || 0)) : 0;
                const settledAt = new Date();
                const winningLabel = winner.selectionName || winner.selectionId;
                const settledReason = userWins
                    ? `Manual event Match Odds settlement. Winner: ${winningLabel}. Your ${isBack ? 'Back' : 'Lay'} selection "${getBetSelectionName(bet)}" was settled as WON.`
                    : `Manual event Match Odds settlement. Winner: ${winningLabel}. Your ${isBack ? 'Back' : 'Lay'} selection "${getBetSelectionName(bet)}" was settled as LOST.`;

                await prisma.$transaction(async (tx) => {
                    const updateData: Record<string, any> = {
                        exposure: { decrement: Number(bet.stake || 0) },
                    };

                    let allocations: BetPayoutAllocation[] = [];
                    if (userWins) {
                        allocations = buildPayoutAllocations(bet, payout);
                        for (const alloc of allocations) {
                            updateData[alloc.walletField] = { increment: alloc.amount };
                        }
                    }

                    const paymentMethod = userWins
                        ? (allocations.length === 1 ? mapWalletFieldToPaymentMethod(allocations[0].walletField) : 'MULTI_WALLET')
                        : null;

                    await tx.user.update({
                        where: { id: Number(bet.userId) },
                        data: updateData,
                    });

                    await tx.transaction.create({
                        data: {
                            userId: Number(bet.userId),
                            amount: userWins ? payout : Number(bet.stake || 0),
                            type: userWins ? 'BET_WIN' : 'BET_LOSS',
                            status: 'COMPLETED',
                            paymentMethod,
                            paymentDetails: userWins ? {
                                source: 'ADMIN_MATCH_ODDS_SETTLEMENT',
                                eventId: normalizedEventId,
                                marketId: String(bet.marketId || ''),
                                selectionId: winner.selectionId || null,
                                selectionName: winner.selectionName || null,
                                walletField: allocations.length === 1 ? allocations[0].walletField : null,
                                walletLabel: allocations.length === 1
                                    ? allocations[0].walletLabel
                                    : allocations.map(a => a.walletLabel).join(' + '),
                                allocations,
                            } : undefined,
                            remarks: `${userWins ? 'Won' : 'Lost'}: ${settledReason}`,
                            adminId,
                            createdAt: settledAt,
                            updatedAt: settledAt,
                        },
                    });
                });

                bet.status = status;
                bet.settledReason = settledReason;
                bet.settledAt = settledAt;
                await bet.save();

                settled += 1;
            } catch (error) {
                console.error(`settleEventMatchOddsInternal failed for bet ${String((bet as any)?._id || '')}:`, error);
                errors += 1;
            }
        }

        if (settled === 0) {
            return {
                success: false,
                message: 'Failed to settle Match Odds bets for this event.',
                settled,
                total: matchOddsBets.length,
                errors,
            };
        }

        const message = errors > 0
            ? `Settled ${settled} of ${matchOddsBets.length} Match Odds bets. ${errors} failed.`
            : `Settled ${settled} Match Odds bets.`;

        return {
            success: true,
            message,
            settled,
            total: matchOddsBets.length,
            errors,
        };
    } catch (error: any) {
        console.error('settleEventMatchOddsInternal error:', error);
        return {
            success: false,
            message: error?.message || 'Failed to settle Match Odds event.',
            settled: 0,
            total: 0,
            errors: 0,
        };
    }
}
