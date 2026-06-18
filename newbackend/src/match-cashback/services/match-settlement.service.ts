import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BetRepository } from '../repositories/bet.repository';
import { MatchRepository } from '../repositories/match.repository';
import { MatchCashbackTransactionRepository } from '../repositories/transaction.repository';
import { WalletRepository } from '../repositories/wallet.repository';
import { MatchCashbackRefundService } from './match-cashback-refund.service';
import { SettleMatchDto } from '../dto/settle-match.dto';

@Injectable()
export class MatchSettlementService {
    private readonly logger = new Logger(MatchSettlementService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly matchRepository: MatchRepository,
        private readonly betRepository: BetRepository,
        private readonly walletRepository: WalletRepository,
        private readonly transactionRepository: MatchCashbackTransactionRepository,
        private readonly refundService: MatchCashbackRefundService,
    ) { }

    /**
     * Statuses that indicate a match was dismissed, abandoned, or otherwise
     * did not complete normally. Bets must be voided, not settled.
     */
    private static readonly DISMISSED_STATUSES = new Set([
        'ABANDONED', 'DISMISSED', 'CANCELLED', 'CANCELED', 'POSTPONED',
        'WALKOVER', 'NO_RESULT', 'VOID', 'VOIDED', 'RETIRED', 'INTERRUPTED',
    ]);

    private isDismissedStatus(value: string | undefined | null): boolean {
        const normalized = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
        return MatchSettlementService.DISMISSED_STATUSES.has(normalized);
    }

    async settleMatch(dto: SettleMatchDto) {
        const match = await this.matchRepository.ensureMatch({ matchId: dto.matchId });
        if (!match) {
            throw new NotFoundException('Match not found.');
        }

        // Guard: refuse to settle if the underlying event was dismissed/abandoned
        const eventStatus = await this.matchRepository.getEventMatchStatus(dto.matchId);
        if (this.isDismissedStatus(eventStatus)) {
            throw new BadRequestException(
                `Cannot settle match ${dto.matchId} — event status is "${eventStatus}". Use void-event to refund bets on dismissed/abandoned matches.`,
            );
        }

        let totalBets = 0;
        let wonBets = 0;
        let lostBets = 0;

        const cursor: any = this.betRepository.streamPendingByMatchId(dto.matchId);

        for await (const bet of cursor) {
            totalBets++;

            const userWins = this.didUserWinBet(bet, dto.winningTeam);
            const settledReason = this.buildSettlementReason(bet, dto.winningTeam, userWins, dto.note);
            const payoutAllocations = this.buildAllocations(bet, userWins ? bet.potentialWin : 0);
            const payoutPaymentMethod =
                payoutAllocations.length === 1
                    ? this.mapWalletFieldToPaymentMethod(payoutAllocations[0].walletField)
                    : 'MULTI_WALLET';

            await this.prisma.$transaction(async (prismaTx) => {
                const updateData: any = {
                    exposure: { decrement: bet.stake },
                };

                if (userWins) {
                    for (const allocation of payoutAllocations) {
                        updateData[allocation.walletField] = { increment: allocation.amount };
                    }
                }

                await this.walletRepository.updateWithinTransaction(prismaTx, bet.userId, updateData);

                await this.transactionRepository.createWithinTransaction(prismaTx, {
                    userId: bet.userId,
                    amount: userWins ? bet.potentialWin : bet.stake,
                    type: userWins ? 'BET_WIN' : 'BET_LOSS',
                    status: 'COMPLETED',
                    paymentMethod: userWins ? payoutPaymentMethod : null,
                    paymentDetails: {
                        source: 'MATCH_SETTLEMENT',
                        walletField:
                            userWins && payoutAllocations.length === 1
                                ? payoutAllocations[0].walletField
                                : null,
                        allocations: userWins ? payoutAllocations : [],
                        matchId: dto.matchId,
                        betId: String(bet._id),
                        winningTeam: dto.winningTeam,
                    },
                    remarks: settledReason,
                });
            });

            await this.betRepository.markSettled(
                String(bet._id),
                userWins ? 'WON' : 'LOST',
                settledReason,
            );

            if (userWins) {
                wonBets++;
            } else {
                lostBets++;
            }
        }

        await this.matchRepository.markFinished(dto.matchId, dto.winningTeam);
        const refundSummary = await this.refundService.processLossCashbackForMatch(dto.matchId);

        this.logger.log(`Settled match ${dto.matchId}. Bets: ${totalBets}, refunds: ${refundSummary.refundedBetCount}`);

        return {
            matchId: dto.matchId,
            winningTeam: dto.winningTeam,
            totalBets,
            wonBets,
            lostBets,
            refundSummary,
        };
    }

    private didUserWinBet(bet: any, winningTeam: string): boolean {
        const isBackBet = String(bet.betType || 'back').toLowerCase() !== 'lay';
        const selectedTeam = this.normalizeValue(
            bet.selectedTeam || bet.selectionName || bet.selectionId || '',
        );
        const normalizedWinner = this.normalizeValue(winningTeam);
        const isSelectionWinner = selectedTeam === normalizedWinner;

        return isBackBet ? isSelectionWinner : !isSelectionWinner;
    }

    private roundCurrency(value: number): number {
        return parseFloat(Number(value || 0).toFixed(2));
    }

    private getPrimaryWalletField(walletType: string | null | undefined): 'balance' | 'sportsBonus' | 'cryptoBalance' {
        return walletType === 'crypto' ? 'cryptoBalance' : 'balance';
    }

    private getBetOriginalStake(bet: any): number {
        return this.roundCurrency(bet?.originalStake ?? bet?.stake ?? 0);
    }

    private getBetBonusStakeAmount(bet: any): number {
        const storedBonusStake = this.roundCurrency(Number(bet?.bonusStakeAmount ?? 0));
        if (storedBonusStake > 0) {
            return storedBonusStake;
        }

        const betSource = String(bet?.betSource || '');
        return betSource.includes('sportsBonus') ? this.getBetOriginalStake(bet) : 0;
    }

    private buildAllocations(
        bet: any,
        amount: number,
    ): Array<{ walletField: 'balance' | 'sportsBonus' | 'cryptoBalance'; amount: number }> {
        const payoutAmount = this.roundCurrency(amount);
        if (payoutAmount <= 0) {
            return [];
        }

        const primaryWalletField = this.getPrimaryWalletField(bet?.walletType);
        const originalStake = this.getBetOriginalStake(bet);
        const bonusStakeAmount = Math.min(originalStake, this.getBetBonusStakeAmount(bet));
        const walletStakeAmount = this.roundCurrency(Math.max(0, originalStake - bonusStakeAmount));

        if (bonusStakeAmount <= 0 || originalStake <= 0) {
            return [{ walletField: primaryWalletField, amount: payoutAmount }];
        }

        if (walletStakeAmount <= 0) {
            return [{ walletField: 'sportsBonus', amount: payoutAmount }];
        }

        const bonusPayout = this.roundCurrency((payoutAmount * bonusStakeAmount) / originalStake);
        const walletPayout = this.roundCurrency(payoutAmount - bonusPayout);

        const allocations: Array<{
            walletField: 'balance' | 'sportsBonus' | 'cryptoBalance';
            amount: number;
        }> = [
            { walletField: 'sportsBonus', amount: bonusPayout },
            { walletField: primaryWalletField, amount: walletPayout },
        ];

        return allocations.filter((allocation) => allocation.amount > 0);
    }

    private mapWalletFieldToPaymentMethod(walletField: 'balance' | 'sportsBonus' | 'cryptoBalance') {
        if (walletField === 'sportsBonus') {
            return 'BONUS_WALLET';
        }

        if (walletField === 'cryptoBalance') {
            return 'CRYPTO_WALLET';
        }

        return 'MAIN_WALLET';
    }

    private buildSettlementReason(bet: any, winningTeam: string, userWins: boolean, note?: string) {
        const selectedTeam = bet.selectedTeam || bet.selectionName || bet.selectionId;
        const baseReason = `Match settled. Winner: ${winningTeam}. Selection: ${selectedTeam}. Result: ${userWins ? 'WON' : 'LOST'}.`;

        if (!note) {
            return baseReason;
        }

        return `${baseReason} Note: ${note}`;
    }

    private normalizeValue(value: string) {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }
}
