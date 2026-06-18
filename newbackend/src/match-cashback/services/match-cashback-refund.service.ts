import { Injectable, Logger } from '@nestjs/common';
import {
    SPORTS_PROMOTION_DEFINITIONS,
    SportsPromotionType,
} from '../match-cashback.constants';
import { PrismaService } from '../../prisma.service';
import { EventsGateway } from '../../events.gateway';
import { BetRepository } from '../repositories/bet.repository';
import { MatchCashbackPromotionRepository } from '../repositories/match-cashback-promotion.repository';
import { MatchCashbackRefundRepository } from '../repositories/match-cashback-refund.repository';
import { MatchCashbackTransactionRepository } from '../repositories/transaction.repository';
import { MatchRepository } from '../repositories/match.repository';
import { WalletCreditService } from './wallet-credit.service';

@Injectable()
export class MatchCashbackRefundService {
    private readonly logger = new Logger(MatchCashbackRefundService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly matchRepository: MatchRepository,
        private readonly betRepository: BetRepository,
        private readonly promotionRepository: MatchCashbackPromotionRepository,
        private readonly refundRepository: MatchCashbackRefundRepository,
        private readonly transactionRepository: MatchCashbackTransactionRepository,
        private readonly walletCreditService: WalletCreditService,
        private readonly eventsGateway: EventsGateway,
    ) { }

    async processLossCashbackForMatch(matchId: string) {
        const promotions = await this.promotionRepository.findActivePromotionsByMatchId(matchId);
        if (!promotions.length) {
            return {
                matchId,
                promotionIds: [],
                eligibleLosingBets: 0,
                refundedBetCount: 0,
                totalRefundAmount: 0,
                skippedDuplicates: 0,
                processedPromotions: [],
            };
        }

        const match = await this.matchRepository.ensureMatch({ matchId });
        const eligibleLosingBets = await this.betRepository.countLostByMatchId(matchId);
        let refundedBetCount = 0;
        let totalRefundAmount = 0;
        let skippedDuplicates = 0;
        const processedPromotions: any[] = [];

        for (const promotion of promotions) {
            const promotionType = promotion.promotionType as SportsPromotionType;
            const definition = SPORTS_PROMOTION_DEFINITIONS[promotionType];

            if (!this.isPromotionTriggered(promotion)) {
                processedPromotions.push({
                    promotionId: promotion._id.toString(),
                    promotionType,
                    benefitType: definition.benefitType,
                    refundedBetCount: promotion.refundedBetCount || 0,
                    totalRefundAmount: promotion.totalRefundAmount || 0,
                    skipped: true,
                    reason: 'Trigger condition not met yet',
                });
                continue;
            }

            const cursor: any = this.betRepository.streamLostByMatchId(matchId);

            for await (const bet of cursor) {
                if (!this.isBetEligibleForPromotion(bet, promotion, match)) {
                    continue;
                }

                const benefitAmount = this.calculatePromotionAmount(bet, promotion);
                if (benefitAmount <= 0) {
                    continue;
                }

                const claim = await this.refundRepository.claimForProcessing({
                    betId: String(bet._id),
                    matchId: String(matchId),
                    promotionId: promotion._id.toString(),
                    userId: bet.userId,
                    refundAmount: benefitAmount,
                    benefitAmount,
                    benefitType: definition.benefitType,
                    walletType: promotion.walletType,
                    description: this.buildPromotionDescription(promotion),
                });

                if (!claim.acquired || !claim.refund) {
                    skippedDuplicates++;
                    continue;
                }

                try {
                    const transaction = await this.prisma.$transaction(async (prismaTx) => {
                        await this.walletCreditService.creditWithinTransaction(prismaTx, {
                            userId: bet.userId,
                            walletType: promotion.walletType,
                            amount: benefitAmount,
                        });

                        return this.transactionRepository.createWithinTransaction(prismaTx, {
                            userId: bet.userId,
                            amount: benefitAmount,
                            type: definition.benefitType === 'PAYOUT_AS_WIN' ? 'PROMO_PAYOUT' : 'REFUND',
                            status: 'COMPLETED',
                            paymentMethod: promotion.walletType === 'bonus_wallet' ? 'BONUS_WALLET' : 'MAIN_WALLET',
                            paymentDetails: {
                                source: promotionType,
                                benefitType: definition.benefitType,
                                walletType: promotion.walletType,
                                referenceId: String(bet._id),
                                promotionId: promotion._id.toString(),
                                matchId: String(matchId),
                                qualifyingSelections: promotion.triggerConfig?.qualifyingSelections || [],
                            },
                            remarks: this.buildPromotionDescription(promotion),
                        });
                    });

                    await this.refundRepository.markCompleted(claim.refund._id.toString(), transaction.id);
                    this.eventsGateway.emitUserWalletUpdate(bet.userId);

                    refundedBetCount++;
                    totalRefundAmount += benefitAmount;
                    this.logger.log(`Processed ${promotionType} for bet ${bet._id} user ${bet.userId} amount ${benefitAmount}`);
                } catch (error: any) {
                    await this.refundRepository.markFailed(
                        claim.refund._id.toString(),
                        error?.message || 'Unknown promotion processing error',
                    );
                    this.logger.error(`Failed to process promo for bet ${bet._id}: ${error?.message || error}`);
                }
            }

            const stats = await this.refundRepository.getCompletedStats(promotion._id.toString());
            await this.promotionRepository.setRefundStats(
                promotion._id.toString(),
                stats.refundedBetCount,
                stats.totalRefundAmount,
            );

            processedPromotions.push({
                promotionId: promotion._id.toString(),
                promotionType,
                benefitType: definition.benefitType,
                refundedBetCount: stats.refundedBetCount,
                totalRefundAmount: stats.totalRefundAmount,
            });
        }

        return {
            matchId,
            promotionIds: processedPromotions.map((promotion) => promotion.promotionId),
            eligibleLosingBets,
            refundedBetCount,
            totalRefundAmount,
            skippedDuplicates,
            processedPromotions,
        };
    }

    private calculatePromotionAmount(bet: any, promotion: any) {
        const definition = SPORTS_PROMOTION_DEFINITIONS[promotion.promotionType as SportsPromotionType];
        const sourceAmount = definition.benefitType === 'PAYOUT_AS_WIN'
            ? Number(bet.potentialWin || 0)
            : Number(bet.stake || 0);

        const rawAmount = Number(((sourceAmount * Number(promotion.refundPercentage || 0)) / 100).toFixed(2));

        if (typeof promotion.maxRefundAmount === 'number') {
            return Number(Math.min(rawAmount, promotion.maxRefundAmount).toFixed(2));
        }

        return rawAmount;
    }

    private isPromotionTriggered(promotion: any) {
        const definition = SPORTS_PROMOTION_DEFINITIONS[promotion.promotionType as SportsPromotionType];
        if (!definition.requiresTrigger) {
            return true;
        }

        return promotion.triggerConfig?.isTriggered === true;
    }

    private isBetEligibleForPromotion(bet: any, promotion: any, match: any) {
        const promotionType = promotion.promotionType as SportsPromotionType;
        const definition = SPORTS_PROMOTION_DEFINITIONS[promotionType];
        const selectedTeam = this.normalizeValue(
            bet.selectedTeam || bet.selectionName || bet.selectionId || '',
        );

        if (!selectedTeam) {
            return false;
        }

        if (definition.selectionMode === 'TRIGGER_SELECTION_ONLY') {
            if (String(bet.betType || 'back').toLowerCase() === 'lay') {
                return false;
            }

            if (!this.isPreMatchBet(bet, match)) {
                return false;
            }

            const qualifyingSelections = Array.isArray(promotion.triggerConfig?.qualifyingSelections)
                ? promotion.triggerConfig.qualifyingSelections.map((selection: string) => this.normalizeValue(selection))
                : [];

            if (!qualifyingSelections.length || !qualifyingSelections.includes(selectedTeam)) {
                return false;
            }
        }

        if (promotionType === 'FIRST_OVER_SIX_CASHBACK') {
            if (!this.isPreMatchBet(bet, match)) {
                return false;
            }
            if (!this.isMatchOddsMarket(bet)) {
                return false;
            }
            if (!this.isPlacedBeforeTrigger(bet, promotion)) {
                return false;
            }
        }

        return true;
    }

    private isMatchOddsMarket(bet: any): boolean {
        const marketName = String(bet.marketName || bet.computedMarketName || '').toLowerCase();
        const gtype = String(bet.gtype || '').toLowerCase();
        const mname = String(bet.mname || '').toLowerCase();

        // Explicitly exclude fancy/session/bookmaker/khado markets
        const isFancyGtype = ['session', 'fancy', 'fancy2', 'khado', 'meter', 'oddeven', 'other fancy'].includes(gtype);
        if (isFancyGtype) return false;

        // Bookmaker (mname === 'BHAV' or gtype includes 'bookmaker')
        if (gtype.includes('bookmaker') || mname === 'bhav') return false;

        // Market name must contain 'match' and not be session/fancy
        const isMatchInName =
            marketName.includes('match odds') ||
            marketName.includes('match winner') ||
            marketName.includes('match') && !marketName.includes('session') && !marketName.includes('fancy');

        // If gtype is 'match' it's unambiguously Match Odds
        if (gtype === 'match') return true;

        return isMatchInName;
    }

    private isPreMatchBet(bet: any, match: any) {
        if (!match?.matchDate || !bet?.createdAt) {
            return false;
        }

        const betPlacedAt = new Date(bet.createdAt).getTime();
        const matchStart = new Date(match.matchDate).getTime();

        return Number.isFinite(betPlacedAt) && Number.isFinite(matchStart)
            ? betPlacedAt < matchStart
            : false;
    }

    private isPlacedBeforeTrigger(bet: any, promotion: any) {
        if (!promotion?.triggerConfig?.triggeredAt || !bet?.createdAt) {
            return false;
        }

        const betPlacedAt = new Date(bet.createdAt).getTime();
        const triggeredAt = new Date(promotion.triggerConfig.triggeredAt).getTime();

        return Number.isFinite(betPlacedAt) && Number.isFinite(triggeredAt)
            ? betPlacedAt < triggeredAt
            : false;
    }

    private buildPromotionDescription(promotion: any) {
        switch (promotion.promotionType as SportsPromotionType) {
            case 'FIRST_OVER_SIX_CASHBACK':
                return 'First over six cashback offer';
            case 'LEAD_MARGIN_PAYOUT':
                return 'Early lead payout promotion';
            case 'LATE_LEAD_REFUND':
                return 'Bad beat insurance promotion';
            case 'PERIOD_LEAD_PAYOUT':
                return 'Period lead payout promotion';
            default:
                return 'Loss cashback offer';
        }
    }

    private normalizeValue(value: string) {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }
}
