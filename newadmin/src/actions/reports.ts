'use server'

import { prisma } from '@/lib/db';

export async function getReportsData() {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        // Fetch transactions for financial data
        const transactions = await prisma.transaction.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate
                },
                status: 'COMPLETED' // Only completed
            }
        });

        // Fetch users for player growth
        const users = await prisma.user.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: { createdAt: true }
        });

        // Aggregate by date
        const financialMap = new Map<string, { deposits: number, withdrawals: number, ggr: number }>();
        const playersMap = new Map<string, number>();

        // Init map with 0s for last 30 days
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            financialMap.set(dateStr, { deposits: 0, withdrawals: 0, ggr: 0 });
            playersMap.set(dateStr, 0);
        }

        transactions.forEach((tx: any) => {
            const dateStr = new Date(tx.createdAt).toISOString().split('T')[0];
            const entry = financialMap.get(dateStr) || { deposits: 0, withdrawals: 0, ggr: 0 };

            if (tx.type === 'DEPOSIT') {
                entry.deposits += Number(tx.amount);
            } else if (tx.type === 'WITHDRAWAL') {
                entry.withdrawals += Number(tx.amount);
            }
            // GGR Calculation: Deposits - Withdrawals (Rough estimate)
            // Or use better logic if GGR is tracked differently.
            // Assuming GGR = Deposits - Withdrawals for this context.
            entry.ggr = entry.deposits - entry.withdrawals;

            financialMap.set(dateStr, entry);
        });

        users.forEach((u: any) => {
            const dateStr = new Date(u.createdAt).toISOString().split('T')[0];
            playersMap.set(dateStr, (playersMap.get(dateStr) || 0) + 1);
        });

        const financial = Array.from(financialMap.entries()).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date));
        const players = Array.from(playersMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

        return {
            success: true,
            data: { financial, players }
        };

    } catch (error) {
        console.error("Reports error:", error);
        return { success: false, error: 'Failed to fetch reports' };
    }
}
