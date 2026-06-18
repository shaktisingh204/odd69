'use server'

import connectMongo from '@/lib/mongo';
import { prisma } from '@/lib/db';
import { Bet } from '@/models/MongoModels';

type BetWalletField = 'balance' | 'cryptoBalance' | 'sportsBonus';

function roundCurrency(value: number) {
    return Number(Number(value || 0).toFixed(2));
}

function normalizeText(value: unknown) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
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

    if (bonusStake <= 0 || originalStake <= 0) {
        return [{ walletField: primaryWalletField, walletLabel: getWalletFieldLabel(primaryWalletField), amount: payout }];
    }

    if (walletStake <= 0) {
        return [{ walletField: 'sportsBonus', walletLabel: getWalletFieldLabel('sportsBonus'), amount: payout }];
    }

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

export async function internalSportradarSettlement(eventId: string, adminId = 0, targetMarketId?: string) {
    // Use the same self-hosted Sportradar API hosts as the backend
    const hosts = [
        (process.env.SPORTRADAR_HOST_PRIMARY   ?? 'http://62.72.41.209:8087').replace(/\/$/, ''),
        (process.env.SPORTRADAR_HOST_SECONDARY ?? 'http://local.turnkeyxgaming.com:8087').replace(/\/$/, ''),
    ];
    const apiKey = process.env.SPORTRADAR_API_KEY || '67f1a9c2d4e8b1a3c9f05673';
    const apiPath = '/api/v1/sportsradar';

    // Resolve sportId from pending bets (fallback to cricket)
    await connectMongo();
    let sportId = 'sr:sport:21';
    const sampleBet = await Bet.findOne({
        status: 'PENDING',
        $or: [{ eventId }, { matchId: eventId }, { srEventId: eventId }],
        srSportId: { $exists: true, $ne: '' },
    }).lean() as any;
    if (sampleBet?.srSportId) sportId = sampleBet.srSportId;

    let result: any = null;
    for (const host of hosts) {
        try {
            const url = `${host}${apiPath}/market-result?sportId=${sportId}&eventId=${eventId}`;
            const response = await fetch(url, {
                headers: { 'x-betnex-key': apiKey },
                signal: AbortSignal.timeout(10000),
            });
            const data = await response.json();
            if (data?.success) { result = data; break; }
        } catch { /* try next host */ }
    }

    if (!result?.success || !result?.event?.markets?.matchOdds) {
        return { success: false, message: `No settled markets found for event ${eventId}. Ensure the event has concluded and results are published.`, marketsProcessed: 0, betsSettled: 0, errors: [] };
    }

    const matchOdds = result.event.markets.matchOdds;
    const settledMarkets = matchOdds
        .filter((m: any) => m.marketStatus === 'SETTLED' || m.marketStatus === 'VOIDED')
        .map((m: any) => ({
            marketId: m.marketId,
            marketName: m.marketName,
            marketStatus: m.marketStatus,
            runners: (m.runners ?? []).map((r: any) => ({
                runnerId: String(r.runnerId),
                runnerName: r.runnerName,
                result: r.result ?? '',
            })),
        }));

    const marketsToProcess = targetMarketId
      ? settledMarkets.filter((m: any) => m.marketId === targetMarketId)
      : settledMarkets;

    if (!marketsToProcess.length) {
        return { success: false, message: targetMarketId ? `Market ${targetMarketId} is not settled yet.` : `No settled markets found for event ${eventId}.`, marketsProcessed: 0, betsSettled: 0, errors: [] };
    }

    let totalSettled = 0;
    const errors: string[] = [];

    for (const market of marketsToProcess) {
        const pendingBets = await Bet.find({
            status: 'PENDING',
            $and: [
                {
                    $or: [
                        { eventId },
                        { matchId: eventId },
                        { srEventId: eventId },
                    ],
                },
                {
                    $or: [
                        { marketId: market.marketId },
                        { srMarketFullId: market.marketId },
                    ],
                },
            ],
        });
        if (!pendingBets.length) continue;

        // ── VOIDED market: refund stake and void bets ───────────────────────
        if (market.marketStatus === 'VOIDED') {
            for (const bet of pendingBets) {
                try {
                    const stake = roundCurrency(Number(bet.stake || 0));
                    const refundAllocations = buildPayoutAllocations(bet, stake);
                    const walletUpdate: Record<string, any> = {};
                    if (stake > 0) walletUpdate.exposure = { decrement: stake };
                    for (const alloc of refundAllocations) {
                        walletUpdate[alloc.walletField] = { increment: alloc.amount };
                    }

                    await prisma.$transaction(async (tx) => {
                        if (Object.keys(walletUpdate).length > 0) {
                            await tx.user.update({
                                where: { id: Number(bet.userId) },
                                data: walletUpdate,
                            });
                        }
                        if (stake > 0) {
                            await tx.transaction.create({
                                data: {
                                    userId: Number(bet.userId),
                                    amount: stake,
                                    type: 'REFUND',
                                    status: 'COMPLETED',
                                    paymentMethod: refundAllocations.length === 1
                                        ? mapWalletFieldToPaymentMethod(refundAllocations[0].walletField)
                                        : 'MULTI_WALLET',
                                    paymentDetails: {
                                        source: 'SPORTS_SETTLEMENT',
                                        reason: 'Market voided by provider',
                                        eventId,
                                        marketId: market.marketId,
                                        betId: String((bet as any)._id),
                                    },
                                    remarks: `Voided: ${bet.eventName} — ${market.marketName} (market dismissed)`,
                                    adminId,
                                    createdAt: new Date(),
                                    updatedAt: new Date(),
                                },
                            });
                        }
                    });

                    bet.status = 'VOID';
                    bet.settledReason = `Market voided by provider. Market: ${normalizeText(market.marketName)}. Stake refunded.`;
                    bet.settledAt = new Date();
                    await bet.save();
                    totalSettled += 1;
                } catch (error: any) {
                    console.error(`Failed to void bet ${String((bet as any)?._id || '')}:`, error);
                    errors.push(`Bet ${String((bet as any)._id)}: ${error.message}`);
                }
            }
            continue;
        }

        // ── SETTLED market: find winner and settle bets ─────────────────────
        const winnerRunner = market.runners.find((r: any) => r.result?.toLowerCase() === 'won');
        if (!winnerRunner) continue;

        for (const bet of pendingBets) {
            try {
                const betSelectionId = String((bet as any).srRunnerId || bet.selectionId || '');
                const betSelectionName = normalizeText(
                    (bet as any).srRunnerName ||
                    bet.selectionName ||
                    (bet as any).selectedTeam ||
                    betSelectionId,
                );
                const marketName = normalizeText(market.marketName || (bet as any).srMarketName || bet.marketName || market.marketId);
                const winnerName = normalizeText(winnerRunner.runnerName || winnerRunner.runnerId);
                const isSelectionWinner = betSelectionId === String(winnerRunner.runnerId);
                const userWins = isSelectionWinner;
                const settledReason = `Official result settlement. Market: ${marketName}. Winner: ${winnerName}. Your selection "${betSelectionName}" was settled as ${userWins ? 'WON' : 'LOST'}.`;

                const payout = userWins ? roundCurrency(Number(bet.potentialWin || 0)) : 0;
                const status = userWins ? 'WON' : 'LOST';

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

                    if (userWins) {
                        await tx.transaction.create({
                            data: {
                                userId: Number(bet.userId),
                                amount: payout,
                                type: 'BET_WIN',
                                status: 'COMPLETED',
                                paymentMethod,
                                paymentDetails: {
                                    source: 'SPORTS_SETTLEMENT',
                                    eventId,
                                    marketId: String(bet.marketId || ''),
                                    selectionId: winnerRunner.runnerId,
                                    selectionName: winnerName,
                                    walletField: allocations.length === 1 ? allocations[0].walletField : null,
                                    walletLabel: allocations.length === 1
                                        ? allocations[0].walletLabel
                                        : allocations.map(a => a.walletLabel).join(' + '),
                                    allocations,
                                    betId: String((bet as any)._id),
                                },
                                remarks: `Won Bet on ${bet.eventName} (${bet.selectionName})`,
                                adminId,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            },
                        });
                    }
                });

                bet.status = status;
                (bet as any).marketName = marketName || bet.marketName;
                (bet as any).srMarketName = marketName || (bet as any).srMarketName;
                bet.selectionName = betSelectionName || bet.selectionName;
                (bet as any).selectedTeam = betSelectionName || (bet as any).selectedTeam;
                (bet as any).srRunnerName = betSelectionName || (bet as any).srRunnerName;
                bet.settledReason = settledReason;
                bet.settledAt = new Date();
                await bet.save();

                totalSettled += 1;
            } catch (error: any) {
                console.error(`Failed to settle bet ${String((bet as any)?._id || '')}:`, error);
                errors.push(`Bet ${String((bet as any)._id)}: ${error.message}`);
            }
        }
    }

    return {
        success: true,
        message: `Settled ${totalSettled} bet(s) across ${marketsToProcess.length} market(s) for event ${eventId}.`,
        marketsProcessed: marketsToProcess.length,
        betsSettled: totalSettled,
        errors,
    };
}
