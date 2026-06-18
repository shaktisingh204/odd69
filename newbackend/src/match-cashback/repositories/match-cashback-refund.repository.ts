import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MatchCashbackRefund, MatchCashbackRefundDocument } from '../schemas/match-cashback-refund.schema';

@Injectable()
export class MatchCashbackRefundRepository {
    constructor(
        @InjectModel(MatchCashbackRefund.name)
        private readonly refundModel: Model<MatchCashbackRefundDocument>,
    ) { }

    async claimForProcessing(payload: {
        betId: string;
        matchId: string;
        promotionId: string;
        userId: number;
        refundAmount: number;
        benefitAmount: number;
        benefitType: string;
        walletType: string;
        description?: string;
    }): Promise<{ acquired: boolean; refund: MatchCashbackRefundDocument | null }> {
        const existing = await this.refundModel.findOne({
            betId: payload.betId,
            promotionId: payload.promotionId,
        }).exec();

        if (existing?.status === 'COMPLETED' || existing?.status === 'PROCESSING') {
            return { acquired: false, refund: existing };
        }

        if (existing?.status === 'FAILED') {
            const updated = await this.refundModel.findByIdAndUpdate(
                existing._id,
                {
                    $set: {
                        ...payload,
                        status: 'PROCESSING',
                        errorMessage: null,
                    },
                },
                { returnDocument: 'after' },
            ).exec();

            return { acquired: true, refund: updated };
        }

        try {
            const created = await this.refundModel.create({
                ...payload,
                status: 'PROCESSING',
            });

            return { acquired: true, refund: created };
        } catch (error: any) {
            if (error?.code === 11000) {
                const duplicate = await this.refundModel.findOne({
                    betId: payload.betId,
                    promotionId: payload.promotionId,
                }).exec();
                return { acquired: false, refund: duplicate };
            }

            throw error;
        }
    }

    async markCompleted(refundId: string, transactionId: number): Promise<void> {
        await this.refundModel.findByIdAndUpdate(refundId, {
            $set: {
                status: 'COMPLETED',
                transactionId,
                processedAt: new Date(),
                errorMessage: null,
            },
        }).exec();
    }

    async markFailed(refundId: string, errorMessage: string): Promise<void> {
        await this.refundModel.findByIdAndUpdate(refundId, {
            $set: {
                status: 'FAILED',
                errorMessage: errorMessage.slice(0, 500),
            },
        }).exec();
    }

    async getCompletedStats(promotionId: string): Promise<{ refundedBetCount: number; totalRefundAmount: number }> {
        const result = await this.refundModel.aggregate([
            {
                $match: {
                    promotionId: String(promotionId),
                    status: 'COMPLETED',
                },
            },
            {
                $group: {
                    _id: '$promotionId',
                    refundedBetCount: { $sum: 1 },
                    totalRefundAmount: {
                        $sum: {
                            $ifNull: ['$benefitAmount', '$refundAmount'],
                        },
                    },
                },
            },
        ]);

        if (!result.length) {
            return {
                refundedBetCount: 0,
                totalRefundAmount: 0,
            };
        }

        return {
            refundedBetCount: result[0].refundedBetCount || 0,
            totalRefundAmount: result[0].totalRefundAmount || 0,
        };
    }
}
