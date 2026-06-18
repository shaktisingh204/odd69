import api from './api';

export interface BonusPromotion {
    _id: string;
    code: string;
    title: string;
    description?: string;
    imageUrl?: string;
    type: 'CASINO' | 'SPORTS';
    applicableTo: 'CASINO' | 'SPORTS' | 'BOTH';
    currency: 'CRYPTO' | 'INR' | 'BOTH';
    amount: number;
    percentage: number;
    minDeposit: number;
    minDepositFiat?: number;
    minDepositCrypto?: number;
    maxBonus: number;
    wageringRequirement: number;
    depositWagerMultiplier: number;
    expiryDays: number;
    usageLimit: number;
    usageCount: number;
    isActive: boolean;
    forFirstDepositOnly: boolean;
    showOnSignup: boolean;
    validFrom?: string;
    validUntil?: string;
}

export interface PromoTeamDeal {
    _id: string;
    eventId: string;
    eventName: string;
    matchDate?: string;
    teams?: string[];
    teamName?: string;
    promotionType?: 'MATCH_LOSS_CASHBACK' | 'FIRST_OVER_SIX_CASHBACK' | 'LEAD_MARGIN_PAYOUT' | 'LATE_LEAD_REFUND' | 'PERIOD_LEAD_PAYOUT';
    benefitType?: 'REFUND' | 'PAYOUT_AS_WIN';
    refundPercentage: number;
    walletTarget: string;
    walletType?: string;
    cardTitle?: string;
    cardDescription?: string;
    cardGradient?: string;
    cardBgImage?: string;
    cardBadge?: string;
    conditionSummary?: string;
    order?: number;
    createdAt?: string;
    triggerConfig?: {
        oversWindow?: number;
        leadThreshold?: number;
        minuteThreshold?: number;
        periodLabel?: string;
        qualifyingSelections?: string[];
        scoreSnapshot?: string;
        triggerNote?: string;
        isTriggered?: boolean;
    } | null;
}

export interface Promotion {
    _id: string;
    title: string;
    subtitle?: string;
    description?: string;
    termsAndConditions?: string;
    category?: string;
    promoCode?: string;
    minDeposit?: number;
    bonusPercentage?: number;
    maxBonus?: number;
    wageringMultiplier?: number;
    validityDays?: number;
    currency?: string;
    targetAudience?: string;
    claimLimit?: number;
    claimCount?: number;
    startDate?: string;
    expiryDate?: string;
    buttonText?: string;
    buttonLink?: string;
    bgImage?: string;
    charImage?: string;
    gradient?: string;
    badgeLabel?: string;
    isActive: boolean;
    isFeatured?: boolean;
    order: number;
}

export const promotionApi = {
    getAll: async (): Promise<Promotion[]> => {
        try {
            const response = await api.get('/promotions?active=true');
            return response.data;
        } catch (error) {
            console.error('Error fetching promotions:', error);
            return [];
        }
    },
    getByCategory: async (category: string): Promise<Promotion[]> => {
        try {
            const response = await api.get(`/promotions?active=true&category=${category}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching promotions by category:', error);
            return [];
        }
    },
    getBonusConditions: async (): Promise<BonusPromotion[]> => {
        try {
            const response = await api.get('/bonus/promotions');
            return response.data;
        } catch (error) {
            console.error('Error fetching bonus conditions:', error);
            return [];
        }
    },
    getPromoTeamDeals: async (): Promise<PromoTeamDeal[]> => {
        try {
            const [legacyResponse, cashbackResponse] = await Promise.allSettled([
                api.get('/promo-team/active'),
                api.get('/match-cashback/promotions/active'),
            ]);

            const legacyDeals = legacyResponse.status === 'fulfilled' && Array.isArray(legacyResponse.value.data)
                ? legacyResponse.value.data.map((deal: any) => ({
                    ...deal,
                    _id: deal._id || deal.id,
                    eventId: deal.eventId,
                    eventName: deal.eventName,
                    promotionType: 'MATCH_LOSS_CASHBACK' as const,
                    benefitType: 'REFUND' as const,
                    walletTarget: deal.walletTarget || 'fiat',
                    walletType: deal.walletTarget || 'fiat',
                    order: Number(deal.order || 0),
                    createdAt: deal.createdAt,
                    triggerConfig: null,
                }))
                : [];

            const cashbackDeals = cashbackResponse.status === 'fulfilled' && Array.isArray(cashbackResponse.value.data)
                ? cashbackResponse.value.data.map((deal: any) => ({
                    _id: deal._id || deal.id,
                    eventId: deal.eventId || deal.matchId,
                    eventName: deal.eventName,
                    matchDate: deal.matchDate,
                    teams: deal.teams || [],
                    teamName: deal.teamName,
                    promotionType: deal.promotionType,
                    benefitType: deal.benefitType || 'REFUND',
                    refundPercentage: deal.refundPercentage,
                    walletTarget: deal.walletType || 'main_wallet',
                    walletType: deal.walletType || 'main_wallet',
                    cardTitle: deal.cardTitle,
                    cardDescription: deal.cardDescription,
                    cardGradient: deal.cardGradient,
                    cardBgImage: deal.cardBgImage,
                    cardBadge: deal.cardBadge,
                    conditionSummary: deal.conditionSummary,
                    order: Number(deal.order || 0),
                    createdAt: deal.createdAt,
                    triggerConfig: deal.triggerConfig || null,
                }))
                : [];

            const deduped = new Map<string, PromoTeamDeal>();

            [...legacyDeals, ...cashbackDeals].forEach((deal) => {
                const walletKey = deal.walletTarget === 'fiat' ? 'main_wallet' : deal.walletTarget;
                const key = [
                    deal.eventId,
                    deal.promotionType || 'MATCH_LOSS_CASHBACK',
                    walletKey,
                    deal.refundPercentage,
                ].join(':');

                const existing = deduped.get(key);
                const isCurrentDealFromCashbackApi = deal.walletTarget === 'main_wallet' || deal.walletTarget === 'bonus_wallet';

                if (!existing || isCurrentDealFromCashbackApi) {
                    deduped.set(key, deal);
                }
            });

            return Array.from(deduped.values()).sort((a, b) => {
                const orderDiff = Number(a.order || 0) - Number(b.order || 0);
                if (orderDiff !== 0) return orderDiff;

                const aTime = a.matchDate ? new Date(a.matchDate).getTime() : 0;
                const bTime = b.matchDate ? new Date(b.matchDate).getTime() : 0;
                if (aTime !== bTime) return aTime - bTime;

                const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                if (aCreated !== bCreated) return bCreated - aCreated;

                return 0;
            });
        } catch (error) {
            console.error('Error fetching promo team deals:', error);
            return [];
        }
    },
};
