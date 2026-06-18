import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { CASHBACK_WALLET_TYPES, SPORTS_PROMOTION_BENEFIT_TYPES, SPORTS_PROMOTION_TYPES } from '../match-cashback.constants';

export type MatchCashbackPromotionDocument = MatchCashbackPromotion & Document;

@Schema({ timestamps: true, collection: 'match_cashback_promotions' })
export class MatchCashbackPromotion {
    @Prop({ required: true, index: true })
    matchId: string;

    @Prop({ required: true, enum: SPORTS_PROMOTION_TYPES, default: 'MATCH_LOSS_CASHBACK' })
    promotionType: string;

    @Prop()
    eventName?: string;

    @Prop()
    matchDate?: Date;

    @Prop()
    sportId?: string;

    @Prop({ type: [String], default: [] })
    teams: string[];

    @Prop({ required: true, min: 0, max: 100 })
    refundPercentage: number;

    @Prop({ required: true, enum: SPORTS_PROMOTION_BENEFIT_TYPES, default: 'REFUND' })
    benefitType: string;

    @Prop({ required: true, enum: CASHBACK_WALLET_TYPES })
    walletType: string;

    @Prop({ min: 0 })
    maxRefundAmount?: number;

    @Prop({ default: true, index: true })
    isActive: boolean;

    @Prop({ default: true })
    showOnPromotionsPage: boolean;

    @Prop()
    cardTitle?: string;

    @Prop()
    cardDescription?: string;

    @Prop({ default: 'linear-gradient(135deg, rgba(16,185,129,0.7), rgba(6,78,59,0.3))' })
    cardGradient?: string;

    @Prop()
    cardBgImage?: string;

    @Prop({ default: 'SPORTS PROMO' })
    cardBadge?: string;

    @Prop({ default: 0 })
    order: number;

    @Prop({
        type: Object,
        default: null,
    })
    triggerConfig?: {
        eventType?: string;
        triggerMode?: string;
        oversWindow?: number;
        leadThreshold?: number;
        minuteThreshold?: number;
        periodLabel?: string;
        qualifyingSelections?: string[];
        scoreSnapshot?: string;
        triggerNote?: string;
        isTriggered?: boolean;
        triggeredAt?: Date;
    } | null;

    @Prop({ default: 0 })
    refundedBetCount: number;

    @Prop({ default: 0 })
    totalRefundAmount: number;

    @Prop()
    lastSettledAt?: Date;
}

export const MatchCashbackPromotionSchema = SchemaFactory.createForClass(MatchCashbackPromotion);
MatchCashbackPromotionSchema.index(
    { matchId: 1, promotionType: 1, isActive: 1 },
    { unique: true, partialFilterExpression: { isActive: true } },
);
MatchCashbackPromotionSchema.index({ showOnPromotionsPage: 1, isActive: 1, matchDate: 1, order: 1 });
