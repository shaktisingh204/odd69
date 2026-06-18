import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import { Bet, BetDocument } from '../bets/schemas/bet.schema';

@Injectable()
export class WageringBackfillService {
    private readonly logger = new Logger(WageringBackfillService.name);
    private isRunning = false;

    constructor(
        private readonly prisma: PrismaService,
        @InjectModel(Bet.name) private readonly betModel: Model<BetDocument>,
    ) { }

    /**
     * Can also be triggered manually via the admin API endpoint.
     */
    async runBackfill(): Promise<{ usersUpdated: number; totalWagered: number }> {
        // ── Step 1: Aggregate sports bets per userId from MongoDB ─────────────
        // Exclude VOID and CASHOUT bets — those stakes were refunded.
        const sportsBetAgg = await this.betModel.aggregate([
            {
                $match: {
                    status: { $nin: ['VOID', 'CASHOUT'] },
                    stake: { $gt: 0 },
                },
            },
            {
                $group: {
                    _id: '$userId',
                    totalStake: { $sum: '$stake' },
                },
            },
        ]);

        // Build a map: userId → sportsWagered
        const sportsMap = new Map<number, number>();
        for (const row of sportsBetAgg) {
            if (row._id) sportsMap.set(Number(row._id), row.totalStake || 0);
        }

        // ── Step 2: Aggregate casino bets per userId from PostgreSQL ──────────
        // Only count type = 'BET' rows (not WIN/UPDATE/REFUND).
        const casinoRows = await this.prisma.casinoTransaction.groupBy({
            by: ['user_id'],
            where: { type: 'BET', amount: { gt: 0 } },
            _sum: { amount: true },
        });

        // Merge into a combined map: userId → totalWagered
        const combined = new Map<number, number>(sportsMap);
        for (const row of casinoRows) {
            const existing = combined.get(row.user_id) || 0;
            combined.set(row.user_id, existing + (row._sum.amount || 0));
        }

        if (combined.size === 0) {
            this.logger.log('[WageringBackfill] No bet data found — nothing to update');
            return { usersUpdated: 0, totalWagered: 0 };
        }

        // ── Step 3: Batch-update totalWagered for each user ───────────────────
        // We clamp totalWagered to min(computed, totalDeposited) so the progress
        // bar never exceeds 100% due to rounding or bonus bets.
        let usersUpdated = 0;
        let grandTotal = 0;

        // Process in chunks to avoid giant transactions
        const entries = Array.from(combined.entries());
        const CHUNK = 50;

        for (let i = 0; i < entries.length; i += CHUNK) {
            const chunk = entries.slice(i, i + CHUNK);

            await Promise.all(
                chunk.map(async ([userId, computedWagered]) => {
                    try {
                        // Fetch totalDeposited so we can clamp
                        const user = await this.prisma.user.findUnique({
                            where: { id: userId },
                            select: { totalDeposited: true },
                        }) as any;

                        if (!user) return;

                        const totalDeposited: number = user.totalDeposited || 0;
                        const clamped = totalDeposited > 0
                            ? Math.min(computedWagered, totalDeposited)
                            : computedWagered;

                        await this.prisma.user.update({
                            where: { id: userId },
                            data: { totalWagered: clamped } as any,
                        });

                        usersUpdated++;
                        grandTotal += clamped;
                    } catch (err) {
                        this.logger.warn(`[WageringBackfill] Skipped user ${userId}: ${err.message}`);
                    }
                }),
            );
        }

        this.logger.log(
            `[WageringBackfill] Updated ${usersUpdated} users | grand total wagered: ₹${grandTotal.toFixed(2)}`,
        );

        return { usersUpdated, totalWagered: grandTotal };
    }
}
