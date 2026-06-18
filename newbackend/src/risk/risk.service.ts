import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bet } from '../bets/schemas/bet.schema';

@Injectable()
export class RiskService {
    constructor(@InjectModel(Bet.name) private betModel: Model<Bet>) { }

    async getLiveExposure() {
        // Aggregate bets by Event and Market
        const exposure = await this.betModel.aggregate([
            { $match: { status: 'PENDING' } }, // Only active bets
            {
                $group: {
                    _id: { eventId: "$eventId", marketId: "$marketId", selectionId: "$selectionId" },
                    eventName: { $first: "$eventName" },
                    marketName: { $first: "$marketName" },
                    selectionName: { $first: "$selectionName" },
                    totalStake: { $sum: "$stake" },
                    totalPayout: { $sum: "$potentialWin" },
                    betCount: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: { eventId: "$_id.eventId", marketId: "$_id.marketId" },
                    eventName: { $first: "$eventName" },
                    marketName: { $first: "$marketName" },
                    selections: {
                        $push: {
                            selectionId: "$_id.selectionId",
                            selectionName: "$selectionName",
                            totalStake: "$totalStake",
                            totalPayout: "$totalPayout",
                            betCount: "$betCount"
                        }
                    },
                    marketTotalStake: { $sum: "$totalStake" }
                }
            },
            { $sort: { marketTotalStake: -1 } } // Sort by most active markets
        ]);

        // Calculate Liability for each market
        // Liability = Max(Payout for outcome X) - Total Stake on Market (simplified)
        // Actually, if Outcome X wins, we pay X backers and keep stake from Y and Z backers.
        // Net Result for House = (Stake X + Stake Y + Stake Z) - (Payout X)
        // If Net Result is negative, it's a liability.

        return exposure.map(market => {
            const worstCase = market.selections.reduce((max, sel) => {
                // If this selection wins:
                // House pays: sel.totalPayout
                // House keeps: market.marketTotalStake (which includes sel.totalStake, careful with gross vs net)
                // Payout usually includes stake returned. 
                // So Net Loss = TotalPayout - TotalStake.
                const netExposure = sel.totalPayout - market.marketTotalStake;
                return Math.max(max, netExposure);
            }, -Infinity);

            return {
                ...market,
                worstCaseLiability: worstCase > 0 ? worstCase : 0 // Only show if house loses money
            };
        });
    }

    async getBetTicker() {
        return this.betModel.find({}).sort({ createdAt: -1 }).limit(20);
    }

    async evaluateUserRisk(userId: number) {
        const riskScore = 0;
        const flags = [];

        // 1. Check Win Rate (Last 50 bets)
        const bets = await this.betModel.find({ userId, status: { $in: ['WON', 'LOST'] } }).sort({ createdAt: -1 }).limit(50);
        if (bets.length > 10) {
            const wins = bets.filter(b => b.status === 'WON').length;
            const winRate = (wins / bets.length) * 100;
            if (winRate > 60) flags.push(`High Win Rate: ${winRate.toFixed(1)}%`);
        }

        // 2. Rapid Betting (Velocity) - Simple check for 10 bets in last minute
        const oneMinuteAgo = new Date(Date.now() - 60000);
        const recentBets = await this.betModel.countDocuments({
            userId,
            createdAt: { $gte: oneMinuteAgo }
        });
        if (recentBets > 10) flags.push(`High Velocity: ${recentBets} bets/min`);

        return {
            riskScore: flags.length * 25,
            flags,
            verdict: flags.length > 0 ? 'HIGH_RISK' : 'SAFE'
        };
    }
}
