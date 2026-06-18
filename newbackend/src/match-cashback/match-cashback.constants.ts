export const MATCH_STATUSES = ['upcoming', 'live', 'finished'] as const;
export const CASHBACK_WALLET_TYPES = ['main_wallet', 'bonus_wallet'] as const;
export const REFUND_PROCESSING_STATUSES = ['PROCESSING', 'COMPLETED', 'FAILED'] as const;
export const SPORTS_PROMOTION_TYPES = [
    'MATCH_LOSS_CASHBACK',
    'FIRST_OVER_SIX_CASHBACK',
    'LEAD_MARGIN_PAYOUT',
    'LATE_LEAD_REFUND',
    'PERIOD_LEAD_PAYOUT',
] as const;
export const SPORTS_PROMOTION_BENEFIT_TYPES = ['REFUND', 'PAYOUT_AS_WIN'] as const;
export const SPORTS_PROMOTION_SELECTION_MODES = ['ALL_LOSING_BETS', 'TRIGGER_SELECTION_ONLY'] as const;
export const SPORTS_PROMOTION_TRIGGER_MODES = ['MATCH_EVENT', 'ANY_STAGE_LEAD', 'AT_MINUTE', 'AT_PERIOD_END'] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];
export type CashbackWalletType = (typeof CASHBACK_WALLET_TYPES)[number];
export type RefundProcessingStatus = (typeof REFUND_PROCESSING_STATUSES)[number];
export type SportsPromotionType = (typeof SPORTS_PROMOTION_TYPES)[number];
export type SportsPromotionBenefitType = (typeof SPORTS_PROMOTION_BENEFIT_TYPES)[number];
export type SportsPromotionSelectionMode = (typeof SPORTS_PROMOTION_SELECTION_MODES)[number];
export type SportsPromotionTriggerMode = (typeof SPORTS_PROMOTION_TRIGGER_MODES)[number];

export const SPORTS_PROMOTION_DEFINITIONS: Record<
    SportsPromotionType,
    {
        benefitType: SportsPromotionBenefitType;
        selectionMode: SportsPromotionSelectionMode;
        requiresTrigger: boolean;
        defaultBadge: string;
    }
> = {
    MATCH_LOSS_CASHBACK: {
        benefitType: 'REFUND',
        selectionMode: 'ALL_LOSING_BETS',
        requiresTrigger: false,
        defaultBadge: 'SPORTS PROMO',
    },
    FIRST_OVER_SIX_CASHBACK: {
        benefitType: 'REFUND',
        selectionMode: 'TRIGGER_SELECTION_ONLY',
        requiresTrigger: true,
        defaultBadge: 'TRIGGER PROMO',
    },
    LEAD_MARGIN_PAYOUT: {
        benefitType: 'PAYOUT_AS_WIN',
        selectionMode: 'TRIGGER_SELECTION_ONLY',
        requiresTrigger: true,
        defaultBadge: 'EARLY PAYOUT',
    },
    LATE_LEAD_REFUND: {
        benefitType: 'REFUND',
        selectionMode: 'TRIGGER_SELECTION_ONLY',
        requiresTrigger: true,
        defaultBadge: 'BAD BEAT',
    },
    PERIOD_LEAD_PAYOUT: {
        benefitType: 'PAYOUT_AS_WIN',
        selectionMode: 'TRIGGER_SELECTION_ONLY',
        requiresTrigger: true,
        defaultBadge: 'PERIOD PAYOUT',
    },
};
