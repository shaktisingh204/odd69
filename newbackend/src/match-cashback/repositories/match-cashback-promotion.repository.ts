import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MatchCashbackPromotion, MatchCashbackPromotionDocument } from '../schemas/match-cashback-promotion.schema';

@Injectable()
export class MatchCashbackPromotionRepository {
    constructor(
        @InjectModel(MatchCashbackPromotion.name)
        private readonly promotionModel: Model<MatchCashbackPromotionDocument>,
    ) { }

    async create(data: Partial<MatchCashbackPromotion>): Promise<MatchCashbackPromotionDocument> {
        return this.promotionModel.create(data);
    }

    async findAll(): Promise<MatchCashbackPromotionDocument[]> {
        return this.promotionModel.find().sort({ createdAt: -1 }).exec();
    }

    async findById(id: string): Promise<MatchCashbackPromotionDocument | null> {
        return this.promotionModel.findById(id).exec();
    }

    async findActiveByMatchId(matchId: string, promotionType?: string): Promise<MatchCashbackPromotionDocument | null> {
        return this.promotionModel.findOne({
            matchId: String(matchId),
            ...(promotionType ? { promotionType } : {}),
            isActive: true,
        }).exec();
    }

    async findActivePromotionsByMatchId(matchId: string): Promise<MatchCashbackPromotionDocument[]> {
        return this.promotionModel.find({
            matchId: String(matchId),
            isActive: true,
        }).sort({ order: 1, createdAt: -1 }).exec();
    }

    async findActivePublic(): Promise<MatchCashbackPromotionDocument[]> {
        const now = new Date();

        return this.promotionModel.find({
            isActive: true,
            showOnPromotionsPage: true,
            $or: [
                { matchDate: { $gte: now } },
                { matchDate: { $exists: false } },
                { matchDate: null },
            ],
        }).sort({ matchDate: 1, order: 1, createdAt: -1 }).exec();
    }

    async update(id: string, data: Partial<MatchCashbackPromotion>): Promise<MatchCashbackPromotionDocument | null> {
        return this.promotionModel.findByIdAndUpdate(
            id,
            { $set: data },
            { returnDocument: 'after' },
        ).exec();
    }

    async remove(id: string): Promise<void> {
        await this.promotionModel.findByIdAndDelete(id).exec();
    }

    async updateTriggerState(id: string, triggerConfig: any): Promise<MatchCashbackPromotionDocument | null> {
        return this.promotionModel.findByIdAndUpdate(
            id,
            { $set: { triggerConfig } },
            { returnDocument: 'after' },
        ).exec();
    }

    async setRefundStats(
        promotionId: string,
        refundedBetCount: number,
        totalRefundAmount: number,
    ): Promise<void> {
        await this.promotionModel.findByIdAndUpdate(promotionId, {
            $set: {
                refundedBetCount,
                totalRefundAmount,
                lastSettledAt: new Date(),
            },
        }).exec();
    }
}
