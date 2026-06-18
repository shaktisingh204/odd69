import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PromoTeam, PromoTeamDocument } from './schemas/promo-team.schema';

@Injectable()
export class PromoTeamService {
    private readonly logger = new Logger(PromoTeamService.name);

    constructor(
        @InjectModel(PromoTeam.name) private promoTeamModel: Model<PromoTeamDocument>,
    ) { }

    async create(dto: Partial<PromoTeam>): Promise<PromoTeam> {
        const doc = new this.promoTeamModel(dto);
        return doc.save();
    }

    async findAll(): Promise<PromoTeam[]> {
        return this.promoTeamModel.find().sort({ createdAt: -1 }).exec();
    }

    async findOne(id: string): Promise<PromoTeam> {
        return this.promoTeamModel.findById(id).exec();
    }

    async update(id: string, dto: Partial<PromoTeam>): Promise<PromoTeam> {
        return this.promoTeamModel
            .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
            .exec();
    }

    async remove(id: string): Promise<PromoTeam> {
        return this.promoTeamModel.findByIdAndDelete(id).exec();
    }

    /**
     * Find an active, not-yet-refunded PromoTeam config for a given event.
     * Called by SettlementService after each MATCH_ODDS market is settled.
     */
    async findActiveForEvent(eventId: string): Promise<PromoTeamDocument | null> {
        return this.promoTeamModel.findOne({
            eventId: String(eventId),
            isActive: true,
            refundIssued: false,
        }).exec();
    }

    /**
     * Mark refund as issued with stats — called by SettlementService
     */
    async markRefundIssued(id: string, betCount: number, totalAmount: number): Promise<void> {
        await this.promoTeamModel.findByIdAndUpdate(id, {
            refundIssued: true,
            refundIssuedAt: new Date(),
            refundedBetCount: betCount,
            totalRefundedAmount: totalAmount,
        });
        this.logger.log(`✅ PromoTeam ${id} marked as refund issued (${betCount} bets, ₹${totalAmount})`);
    }

    /** Public: active configs not yet refunded, shown on website promotions page */
    async findForPromotionsPage(): Promise<PromoTeam[]> {
        const now = new Date();
        return this.promoTeamModel
            .find({
                isActive: true,
                refundIssued: false,
                showOnPromotionsPage: true,
                // Only show matches that haven't started yet (or have no date set)
                $or: [
                    { matchDate: { $gte: now } },
                    { matchDate: { $exists: false } },
                    { matchDate: null },
                ],
            })
            .select('eventId eventName matchDate teams teamName refundPercentage walletTarget cardTitle cardDescription cardGradient cardBgImage cardBadge order')
            .sort({ matchDate: 1, order: 1 })
            .exec();
    }

    /** Legacy: active configs for display (minimal fields) */
    async findActivePublic(): Promise<PromoTeam[]> {
        return this.findForPromotionsPage();
    }
}
