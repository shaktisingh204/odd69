import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { CASHBACK_WALLET_TYPES, REFUND_PROCESSING_STATUSES, SPORTS_PROMOTION_BENEFIT_TYPES } from '../match-cashback.constants';

export type MatchCashbackRefundDocument = MatchCashbackRefund & Document;

@Schema({ timestamps: true, collection: 'match_cashback_refunds' })
export class MatchCashbackRefund {
    @Prop({ required: true, index: true })
    betId: string;

    @Prop({ required: true, index: true })
    matchId: string;

    @Prop({ required: true, index: true })
    promotionId: string;

    @Prop({ required: true, index: true })
    userId: number;

    @Prop({ required: true })
    refundAmount: number;

    @Prop({ required: true })
    benefitAmount: number;

    @Prop({ required: true, enum: SPORTS_PROMOTION_BENEFIT_TYPES, default: 'REFUND' })
    benefitType: string;

    @Prop({ required: true, enum: CASHBACK_WALLET_TYPES })
    walletType: string;

    @Prop()
    description?: string;

    @Prop({ required: true, enum: REFUND_PROCESSING_STATUSES, default: 'PROCESSING' })
    status: string;

    @Prop()
    transactionId?: number;

    @Prop()
    errorMessage?: string;

    @Prop()
    processedAt?: Date;
}

export const MatchCashbackRefundSchema = SchemaFactory.createForClass(MatchCashbackRefund);
MatchCashbackRefundSchema.index({ betId: 1, promotionId: 1 }, { unique: true });
MatchCashbackRefundSchema.index({ promotionId: 1, status: 1 });
MatchCashbackRefundSchema.index({ userId: 1, processedAt: -1 });
