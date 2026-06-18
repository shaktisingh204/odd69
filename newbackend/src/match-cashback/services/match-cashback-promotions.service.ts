import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
    SPORTS_PROMOTION_DEFINITIONS,
    SPORTS_PROMOTION_TYPES,
    SportsPromotionType,
} from '../match-cashback.constants';
import { CreateMatchCashbackPromotionDto } from '../dto/create-match-cashback-promotion.dto';
import { UpdateMatchCashbackPromotionDto } from '../dto/update-match-cashback-promotion.dto';
import { MatchRepository } from '../repositories/match.repository';
import { MatchCashbackPromotionRepository } from '../repositories/match-cashback-promotion.repository';

@Injectable()
export class MatchCashbackPromotionsService {
    constructor(
        private readonly matchRepository: MatchRepository,
        private readonly promotionRepository: MatchCashbackPromotionRepository,
    ) { }

    async create(dto: CreateMatchCashbackPromotionDto) {
        const promotionType = this.resolvePromotionType(dto.promotionType);
        const matchDate = dto.matchDate ? new Date(dto.matchDate) : undefined;
        const match = await this.matchRepository.ensureMatch({
            matchId: dto.matchId,
            teamA: dto.teamA,
            teamB: dto.teamB,
            matchDate,
        });

        if (!match) {
            throw new NotFoundException('Match not found. Provide a valid matchId or include teamA, teamB, and matchDate.');
        }

        if (dto.isActive !== false) {
            const activePromotion = await this.promotionRepository.findActiveByMatchId(dto.matchId, promotionType);
            if (activePromotion) {
                throw new ConflictException('An active promotion of this type already exists for this match.');
            }
        }

        const eventName = dto.eventName || `${match.teamA} vs ${match.teamB}`;
        const triggerConfig = this.buildTriggerConfig(
            promotionType,
            dto.triggerConfig,
            null,
            dto.teams?.length ? dto.teams : [match.teamA, match.teamB].filter(Boolean),
        );

        const promotion = await this.promotionRepository.create({
            matchId: dto.matchId,
            promotionType,
            benefitType: this.getPromotionDefinition(promotionType).benefitType,
            eventName,
            matchDate: match.matchDate,
            sportId: dto.sportId,
            teams: dto.teams?.length ? dto.teams : [match.teamA, match.teamB].filter(Boolean),
            refundPercentage: dto.refundPercentage,
            walletType: dto.walletType,
            maxRefundAmount: dto.maxRefundAmount,
            isActive: dto.isActive ?? true,
            showOnPromotionsPage: dto.showOnPromotionsPage ?? true,
            cardTitle: dto.cardTitle || this.buildDefaultCardTitle(promotionType, eventName, dto.refundPercentage, triggerConfig),
            cardDescription: dto.cardDescription || this.buildDefaultCardDescription(
                promotionType,
                eventName,
                dto.refundPercentage,
                dto.walletType,
                triggerConfig,
            ),
            cardGradient: dto.cardGradient,
            cardBgImage: dto.cardBgImage,
            cardBadge: dto.cardBadge || this.getPromotionDefinition(promotionType).defaultBadge,
            order: dto.order ?? 0,
            triggerConfig,
        });

        return this.serializePromotion(promotion, match);
    }

    async findAll() {
        const promotions = await this.promotionRepository.findAll();
        const matches = await this.matchRepository.findManyByMatchIds(
            promotions.map((promotion) => promotion.matchId),
        );
        const matchesById = new Map(matches.map((match) => [match.matchId, match]));

        return promotions.map((promotion) => this.serializePromotion(
            promotion,
            matchesById.get(promotion.matchId) || null,
        ));
    }

    async findActivePublic() {
        const promotions = await this.promotionRepository.findActivePublic();
        const matches = await this.matchRepository.findManyByMatchIds(
            promotions.map((promotion) => promotion.matchId),
        );
        const matchesById = new Map(matches.map((match) => [match.matchId, match]));

        return promotions.map((promotion) => this.serializePromotion(
            promotion,
            matchesById.get(promotion.matchId) || null,
        ));
    }

    async update(id: string, dto: UpdateMatchCashbackPromotionDto) {
        const existing = await this.promotionRepository.findById(id);
        if (!existing) {
            throw new NotFoundException('Promotion not found.');
        }

        const nextType = this.resolvePromotionType(dto.promotionType || existing.promotionType);
        const nextMatchId = dto.matchId || existing.matchId;

        if ((dto.isActive ?? existing.isActive) === true) {
            const activePromotion = await this.promotionRepository.findActiveByMatchId(nextMatchId, nextType);
            if (activePromotion && String(activePromotion._id) !== id) {
                throw new ConflictException('Another active promotion of this type already exists for this match.');
            }
        }

        const match = await this.matchRepository.ensureMatch({
            matchId: nextMatchId,
            teamA: dto.teamA,
            teamB: dto.teamB,
            matchDate: dto.matchDate ? new Date(dto.matchDate) : undefined,
        });

        const teams = dto.teams?.length
            ? dto.teams
            : (existing.teams?.length ? existing.teams : (match ? [match.teamA, match.teamB].filter(Boolean) : []));

        const triggerConfig = this.buildTriggerConfig(
            nextType,
            dto.triggerConfig,
            existing.triggerConfig || null,
            teams,
        );

        const updated = await this.promotionRepository.update(id, {
            matchId: nextMatchId,
            promotionType: nextType,
            benefitType: this.getPromotionDefinition(nextType).benefitType,
            eventName: dto.eventName || existing.eventName || (match ? `${match.teamA} vs ${match.teamB}` : undefined),
            matchDate: match?.matchDate || existing.matchDate,
            sportId: dto.sportId ?? existing.sportId,
            teams,
            refundPercentage: dto.refundPercentage ?? existing.refundPercentage,
            walletType: dto.walletType ?? existing.walletType,
            maxRefundAmount: dto.maxRefundAmount ?? existing.maxRefundAmount,
            isActive: dto.isActive ?? existing.isActive,
            showOnPromotionsPage: dto.showOnPromotionsPage ?? existing.showOnPromotionsPage,
            cardTitle: dto.cardTitle ?? existing.cardTitle,
            cardDescription: dto.cardDescription ?? existing.cardDescription,
            cardGradient: dto.cardGradient ?? existing.cardGradient,
            cardBgImage: dto.cardBgImage ?? existing.cardBgImage,
            cardBadge: dto.cardBadge ?? existing.cardBadge ?? this.getPromotionDefinition(nextType).defaultBadge,
            order: dto.order ?? existing.order ?? 0,
            triggerConfig,
        });

        return this.serializePromotion(updated, match);
    }

    async toggle(id: string, isActive: boolean) {
        return this.update(id, { isActive });
    }

    async setTriggerState(id: string, params: {
        isTriggered: boolean;
        oversWindow?: number;
        leadThreshold?: number;
        minuteThreshold?: number;
        periodLabel?: string;
        qualifyingSelections?: string[];
        scoreSnapshot?: string;
        triggerNote?: string;
    }) {
        const existing = await this.promotionRepository.findById(id);
        if (!existing) {
            throw new NotFoundException('Promotion not found.');
        }

        const match = await this.matchRepository.findByMatchId(existing.matchId);
        const teams = existing.teams?.length ? existing.teams : (match ? [match.teamA, match.teamB].filter(Boolean) : []);

        const nextTriggerConfig = this.buildTriggerConfig(
            this.resolvePromotionType(existing.promotionType),
            {
                ...existing.triggerConfig,
                ...params,
                isTriggered: params.isTriggered,
            },
            existing.triggerConfig || null,
            teams,
        );

        const definition = this.getPromotionDefinition(existing.promotionType as SportsPromotionType);
        if (
            params.isTriggered &&
            definition.selectionMode === 'TRIGGER_SELECTION_ONLY' &&
            (!nextTriggerConfig?.qualifyingSelections || nextTriggerConfig.qualifyingSelections.length === 0)
        ) {
            throw new BadRequestException('Please choose the qualifying team/selection before marking this promotion as triggered.');
        }

        const updated = await this.promotionRepository.updateTriggerState(id, nextTriggerConfig);
        return this.serializePromotion(updated, match);
    }

    async remove(id: string) {
        await this.promotionRepository.remove(id);
        return { success: true };
    }

    private serializePromotion(promotion: any, match: any) {
        const promotionType = this.resolvePromotionType(promotion.promotionType);
        const definition = this.getPromotionDefinition(promotionType);

        return {
            id: promotion._id.toString(),
            _id: promotion._id.toString(),
            matchId: promotion.matchId,
            eventId: promotion.matchId,
            eventName: promotion.eventName || (match ? `${match.teamA} vs ${match.teamB}` : null),
            matchDate: promotion.matchDate || match?.matchDate || null,
            teams: promotion.teams || (match ? [match.teamA, match.teamB].filter(Boolean) : []),
            promotionType,
            benefitType: promotion.benefitType || definition.benefitType,
            refundPercentage: promotion.refundPercentage,
            rewardPercentage: promotion.refundPercentage,
            walletType: promotion.walletType,
            walletTarget: promotion.walletType,
            maxRefundAmount: promotion.maxRefundAmount ?? null,
            isActive: promotion.isActive,
            showOnPromotionsPage: promotion.showOnPromotionsPage ?? true,
            cardTitle: promotion.cardTitle || null,
            cardDescription: promotion.cardDescription || null,
            cardGradient: promotion.cardGradient || null,
            cardBgImage: promotion.cardBgImage || null,
            cardBadge: promotion.cardBadge || null,
            order: promotion.order || 0,
            triggerConfig: promotion.triggerConfig || null,
            conditionSummary: this.buildConditionSummary(promotion),
            refundedBetCount: promotion.refundedBetCount || 0,
            totalRefundAmount: promotion.totalRefundAmount || 0,
            totalBenefitAmount: promotion.totalRefundAmount || 0,
            createdAt: promotion.createdAt,
            updatedAt: promotion.updatedAt,
            match: match ? {
                matchId: match.matchId,
                teamA: match.teamA,
                teamB: match.teamB,
                matchDate: match.matchDate,
                status: match.status,
                winningTeam: match.winningTeam || null,
            } : null,
        };
    }

    private buildConditionSummary(promotion: any) {
        const promotionType = this.resolvePromotionType(promotion.promotionType);
        const triggerConfig = promotion.triggerConfig || {};
        const qualifyingSelections = Array.isArray(triggerConfig.qualifyingSelections) ? triggerConfig.qualifyingSelections : [];
        const selectionLabel = qualifyingSelections.length > 0
            ? ` Selected team: ${qualifyingSelections.join(', ')}.`
            : '';

        switch (promotionType) {
            case 'FIRST_OVER_SIX_CASHBACK': {
                const oversWindow = triggerConfig.oversWindow || 1;
                return `If your selected pre-match Match Odds team hits a six in the first ${oversWindow} over${oversWindow > 1 ? 's' : ''} but still loses, the losing bet qualifies for cashback.${selectionLabel}`;
            }
            case 'LEAD_MARGIN_PAYOUT': {
                const leadThreshold = triggerConfig.leadThreshold || 2;
                return `If your selected team goes ${leadThreshold}+ ahead and still fails to win, the bet can be paid out as a winner.${selectionLabel}`;
            }
            case 'LATE_LEAD_REFUND': {
                const minuteThreshold = triggerConfig.minuteThreshold || 80;
                return `If your selected team is still leading at minute ${minuteThreshold} but does not win, losing bets qualify for a refund.${selectionLabel}`;
            }
            case 'PERIOD_LEAD_PAYOUT': {
                const periodLabel = triggerConfig.periodLabel || 'HALF_TIME';
                return `If your selected team is ahead at ${this.formatPeriodLabel(periodLabel)} but does not win the match, the bet can be paid out as a winner.${selectionLabel}`;
            }
            default:
                return 'Lose on this match and get cashback if the promotion is active.';
        }
    }

    private buildDefaultCardTitle(
        promotionType: SportsPromotionType,
        eventName: string,
        rewardPercentage: number,
        triggerConfig: any,
    ) {
        switch (promotionType) {
            case 'FIRST_OVER_SIX_CASHBACK': {
                const window = triggerConfig?.oversWindow || 1;
                return `${eventName} — ${rewardPercentage}% back if your pre-match team hits a 6 in first ${window} over${window > 1 ? 's' : ''}`;
            }
            case 'LEAD_MARGIN_PAYOUT': {
                const leadThreshold = triggerConfig?.leadThreshold || 2;
                return `${eventName} — Paid as winner if your team leads by ${leadThreshold}+`;
            }
            case 'LATE_LEAD_REFUND': {
                const minuteThreshold = triggerConfig?.minuteThreshold || 80;
                return `${eventName} — Refund if your team leads at ${minuteThreshold}' and still misses the win`;
            }
            case 'PERIOD_LEAD_PAYOUT': {
                const periodLabel = this.formatPeriodLabel(triggerConfig?.periodLabel || 'HALF_TIME');
                return `${eventName} — Paid as winner if your team leads at ${periodLabel}`;
            }
            default:
                return `${eventName} — Get ${rewardPercentage}% Back on Any Loss`;
        }
    }

    private buildDefaultCardDescription(
        promotionType: SportsPromotionType,
        eventName: string,
        rewardPercentage: number,
        walletType: string,
        triggerConfig: any,
    ) {
        const walletLabel = walletType === 'bonus_wallet' ? 'bonus wallet' : 'main wallet';

        switch (promotionType) {
            case 'FIRST_OVER_SIX_CASHBACK': {
                const window = triggerConfig?.oversWindow || 1;
                return `Place a pre-match Match Odds bet on ${eventName}. If your selected team hits a six in the first ${window} over${window > 1 ? 's' : ''} but still loses, get ${rewardPercentage}% refunded to the ${walletLabel}.`;
            }
            case 'LEAD_MARGIN_PAYOUT': {
                const leadThreshold = triggerConfig?.leadThreshold || 2;
                return `Back a team in ${eventName}. If it goes ${leadThreshold}+ ahead but still fails to win, the bet can still be credited like a winner to the ${walletLabel}.`;
            }
            case 'LATE_LEAD_REFUND': {
                const minuteThreshold = triggerConfig?.minuteThreshold || 80;
                return `Back a team in ${eventName}. If it is still leading at minute ${minuteThreshold} but does not win, losing bets are refunded to the ${walletLabel}.`;
            }
            case 'PERIOD_LEAD_PAYOUT': {
                const periodLabel = this.formatPeriodLabel(triggerConfig?.periodLabel || 'HALF_TIME');
                return `Back a team in ${eventName}. If it leads at ${periodLabel} but does not go on to win, the bet can still be credited like a winner to the ${walletLabel}.`;
            }
            default:
                return `Bet on ${eventName}. If your bet loses, get ${rewardPercentage}% of your stake refunded to the ${walletLabel}.`;
        }
    }

    private buildTriggerConfig(
        promotionType: SportsPromotionType,
        incomingTriggerConfig: any,
        existingTriggerConfig: any,
        teams: string[],
    ) {
        if (!this.getPromotionDefinition(promotionType).requiresTrigger) {
            return null;
        }

        const current = incomingTriggerConfig || existingTriggerConfig || {};
        const normalizedSelections = this.normalizeSelections(current.qualifyingSelections, teams);
        const isTriggered = current.isTriggered === true;

        switch (promotionType) {
            case 'FIRST_OVER_SIX_CASHBACK':
                return {
                    eventType: current.eventType || 'ANY_TEAM_HIT_SIX',
                    triggerMode: current.triggerMode || 'MATCH_EVENT',
                    oversWindow: Number(current.oversWindow || existingTriggerConfig?.oversWindow || 1),
                    isTriggered,
                    triggeredAt: isTriggered ? (existingTriggerConfig?.triggeredAt || new Date()) : null,
                    scoreSnapshot: current.scoreSnapshot || existingTriggerConfig?.scoreSnapshot || null,
                    triggerNote: current.triggerNote || existingTriggerConfig?.triggerNote || null,
                };

            case 'LEAD_MARGIN_PAYOUT':
                return {
                    eventType: current.eventType || 'TEAM_LEAD_MARGIN',
                    triggerMode: current.triggerMode || 'ANY_STAGE_LEAD',
                    leadThreshold: Number(current.leadThreshold || existingTriggerConfig?.leadThreshold || 2),
                    qualifyingSelections: normalizedSelections,
                    isTriggered,
                    triggeredAt: isTriggered ? (existingTriggerConfig?.triggeredAt || new Date()) : null,
                    scoreSnapshot: current.scoreSnapshot || existingTriggerConfig?.scoreSnapshot || null,
                    triggerNote: current.triggerNote || existingTriggerConfig?.triggerNote || null,
                };

            case 'LATE_LEAD_REFUND':
                return {
                    eventType: current.eventType || 'TEAM_LEADING_AT_MINUTE',
                    triggerMode: current.triggerMode || 'AT_MINUTE',
                    minuteThreshold: Number(current.minuteThreshold || existingTriggerConfig?.minuteThreshold || 80),
                    qualifyingSelections: normalizedSelections,
                    isTriggered,
                    triggeredAt: isTriggered ? (existingTriggerConfig?.triggeredAt || new Date()) : null,
                    scoreSnapshot: current.scoreSnapshot || existingTriggerConfig?.scoreSnapshot || null,
                    triggerNote: current.triggerNote || existingTriggerConfig?.triggerNote || null,
                };

            case 'PERIOD_LEAD_PAYOUT':
                return {
                    eventType: current.eventType || 'TEAM_LEADING_AT_PERIOD_END',
                    triggerMode: current.triggerMode || 'AT_PERIOD_END',
                    periodLabel: current.periodLabel || existingTriggerConfig?.periodLabel || 'HALF_TIME',
                    qualifyingSelections: normalizedSelections,
                    isTriggered,
                    triggeredAt: isTriggered ? (existingTriggerConfig?.triggeredAt || new Date()) : null,
                    scoreSnapshot: current.scoreSnapshot || existingTriggerConfig?.scoreSnapshot || null,
                    triggerNote: current.triggerNote || existingTriggerConfig?.triggerNote || null,
                };

            default:
                return current;
        }
    }

    private normalizeSelections(selections: string[] | undefined, teams: string[]) {
        if (!Array.isArray(selections) || selections.length === 0) {
            return [];
        }

        const uniqueSelections = [...new Set(
            selections
                .map((selection) => String(selection || '').trim())
                .filter(Boolean),
        )];

        if (!teams.length) {
            return uniqueSelections;
        }

        return uniqueSelections.filter((selection) =>
            teams.some((team) => this.normalizeValue(team) === this.normalizeValue(selection)),
        );
    }

    private resolvePromotionType(promotionType?: string): SportsPromotionType {
        if (!promotionType) {
            return 'MATCH_LOSS_CASHBACK';
        }

        if (!(SPORTS_PROMOTION_TYPES as readonly string[]).includes(promotionType)) {
            throw new BadRequestException(`Unsupported promotion type: ${promotionType}`);
        }

        return promotionType as SportsPromotionType;
    }

    private getPromotionDefinition(promotionType: SportsPromotionType) {
        return SPORTS_PROMOTION_DEFINITIONS[promotionType];
    }

    private normalizeValue(value: string) {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    private formatPeriodLabel(periodLabel: string) {
        const normalized = String(periodLabel || '').trim().toUpperCase();
        const lookup: Record<string, string> = {
            HALF_TIME: 'half-time',
            END_Q1: 'end of 1st quarter',
            END_Q2: 'half-time',
            END_Q3: 'end of 3rd quarter',
            END_P1: 'end of 1st period',
            END_P2: 'end of 2nd period',
            END_P3: 'end of 3rd period',
            END_SET_1: 'end of set 1',
            END_SET_2: 'end of set 2',
        };

        return lookup[normalized] || normalized.toLowerCase().replace(/_/g, ' ');
    }
}
