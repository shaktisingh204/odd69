import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bet } from '../bets/schemas/bet.schema';

@Injectable()
export class DashboardService {
    constructor(
        private prisma: PrismaService,
        @InjectModel(Bet.name) private betModel: Model<Bet>
    ) { }

    async getStats() {
        const bannedUsers = await this.prisma.user.findMany({
            where: { isBanned: true },
            select: { id: true }
        });
        const bannedUserIds = bannedUsers.map(u => u.id);

        const [
            totalUsers,
            totalDepositsAgg,
            totalWithdrawalsAgg,
            betStats
        ] = await Promise.all([
            this.prisma.user.count({ where: { isBanned: false } }),
            this.prisma.transaction.aggregate({
                _sum: { amount: true },
                where: { type: 'deposit', status: 'success', user: { isBanned: false } }
            }),
            this.prisma.transaction.aggregate({
                _sum: { amount: true },
                where: { type: 'withdrawal', status: 'success', user: { isBanned: false } }
            }),
            this.betModel.aggregate([
                { $match: { userId: { $nin: bannedUserIds } } },
                {
                    $group: {
                        _id: null,
                        totalBets: { $sum: 1 },
                        totalWagered: { $sum: '$amount' },
                        activeBets: {
                            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                        }
                    }
                }
            ])
        ]);

        const totalDeposits = totalDepositsAgg._sum.amount || 0;
        const totalWithdrawals = totalWithdrawalsAgg._sum.amount || 0;
        const ggr = totalDeposits - totalWithdrawals; // Simplified GGR for now

        // Bet stats
        const totalBets = betStats[0]?.totalBets || 0;
        const activeBets = betStats[0]?.activeBets || 0;

        return {
            users: {
                total: totalUsers,
                active: 0 // Need logic for active users (e.g., login within 24h)
            },
            financials: {
                totalDeposits,
                totalWithdrawals,
                ggr
            },
            bets: {
                total: totalBets,
                active: activeBets
            }
        };
    }

    async getAlerts() {
        const highValueWithdrawals = await this.prisma.transaction.findMany({
            where: {
                type: 'withdrawal',
                status: 'pending',
                amount: { gte: 10000 }, // Threshold for alarm
                user: { isBanned: false }
            },
            take: 5,
            include: { user: { select: { username: true } } }
        });

        const alerts = highValueWithdrawals.map(tx => ({
            id: `tx-${tx.id}`,
            type: 'critical',
            message: `High value withdrawal request: ₹${tx.amount} by ${tx.user.username}`,
            timestamp: tx.createdAt
        }));

        return alerts;
    }

    async getFinancialReport(days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Group by day using raw query (Prisma groupBy is limited with dates)
        // Or fetch all and aggregate in JS for simplicity/database compatibility
        const transactions = await this.prisma.transaction.findMany({
            where: {
                createdAt: { gte: startDate },
                status: 'success', // or 'completed' depending on schema enum/string
                user: { isBanned: false }
            },
            select: {
                amount: true,
                type: true,
                createdAt: true
            }
        });

        const report = new Map<string, { deposits: number; withdrawals: number; ggr: number }>();

        // Init all days
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const key = date.toISOString().split('T')[0];
            report.set(key, { deposits: 0, withdrawals: 0, ggr: 0 });
        }

        transactions.forEach(tx => {
            const key = tx.createdAt.toISOString().split('T')[0];
            if (report.has(key)) {
                const entry = report.get(key)!;
                if (tx.type.toLowerCase().includes('deposit')) {
                    entry.deposits += tx.amount;
                    entry.ggr += tx.amount;
                } else if (tx.type.toLowerCase().includes('withdrawal')) {
                    entry.withdrawals += tx.amount;
                    entry.ggr -= tx.amount;
                }
            }
        });

        return Array.from(report.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    async getPlayerReport(days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const users = await this.prisma.user.findMany({
            where: { createdAt: { gte: startDate }, isBanned: false },
            select: { createdAt: true }
        });

        const report = new Map<string, number>();
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const key = date.toISOString().split('T')[0];
            report.set(key, 0);
        }

        users.forEach(u => {
            const key = u.createdAt.toISOString().split('T')[0];
            if (report.has(key)) {
                report.set(key, report.get(key)! + 1);
            }
        });

        return Array.from(report.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
}
