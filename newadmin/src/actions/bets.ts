'use server'

import connectMongo from '@/lib/mongo';
import { Bet } from '@/models/MongoModels';
import { prisma } from '@/lib/db';

// ─── Sports Bets ───────────────────────────────────────────────────────────────

export interface SportsBetFilters {
    status?: string;
    search?: string;
    userId?: string;
}

export async function getSportsBets(page = 1, limit = 50, filters: SportsBetFilters = {}) {
    try {
        await connectMongo();

        const match: any = {};
        if (filters.status && filters.status !== 'ALL') {
            match.status = filters.status;
        }
        if (filters.userId) {
            const uid = parseInt(filters.userId);
            if (!isNaN(uid)) match.userId = uid;
        }
        if (filters.search) {
            match.$or = [
                { eventName: { $regex: filters.search, $options: 'i' } },
                { marketName: { $regex: filters.search, $options: 'i' } },
                { selectionName: { $regex: filters.search, $options: 'i' } },
            ];
        }

        const skip = (page - 1) * limit;
        const [bets, total] = await Promise.all([
            Bet.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Bet.countDocuments(match),
        ]);

        return {
            success: true,
            data: JSON.parse(JSON.stringify(bets)),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    } catch (error) {
        console.error('getSportsBets error:', error);
        return { success: false, data: [], pagination: { page, limit, total: 0, pages: 0 } };
    }
}

export async function getSportsBetStats() {
    try {
        await connectMongo();
        const [total, pending, won, lost, cancelled, agg] = await Promise.all([
            Bet.countDocuments(),
            Bet.countDocuments({ status: 'PENDING' }),
            Bet.countDocuments({ status: 'WON' }),
            Bet.countDocuments({ status: 'LOST' }),
            Bet.countDocuments({ status: 'CANCELLED' }),
            Bet.aggregate([
                { $group: { _id: null, totalStake: { $sum: '$stake' }, totalPayout: { $sum: '$potentialWin' } } },
            ]),
        ]);
        return {
            success: true,
            data: {
                total, pending, won, lost, cancelled,
                totalStake: agg[0]?.totalStake || 0,
                totalPayout: agg[0]?.totalPayout || 0,
            },
        };
    } catch (error) {
        return { success: false, data: null };
    }
}

// ─── Casino Bets ───────────────────────────────────────────────────────────────
// Casino bets are stored in PostgreSQL (CasinoTransaction) via the Prisma client.
// Each row is one transaction: a BET debit or a WIN credit.
// We read directly from PostgreSQL and map to the shape the admin page expects.

export interface CasinoBetFilters {
    status?: string;   // kept for API compat – not stored per-row, ignored
    search?: string;
    userId?: string;
    provider?: string;
}

export async function getCasinoBets(page = 1, limit = 50, filters: CasinoBetFilters = {}) {
    try {
        const where: any = {
            amount: { gt: 0 },
        };

        // Type/status filter: BET or WIN
        if (filters.status && filters.status !== 'ALL' && (filters.status === 'BET' || filters.status === 'WIN')) {
            where.type = filters.status;
        } else {
            // Exclude zero-activity UPDATE rows
            where.NOT = { type: 'UPDATE' };
        }

        if (filters.provider && filters.provider !== 'ALL') {
            where.provider = { contains: filters.provider, mode: 'insensitive' };
        }
        if (filters.userId) {
            const uid = parseInt(filters.userId);
            if (!isNaN(uid)) where.user_id = uid;
        }
        if (filters.search) {
            where.OR = [
                { game_code: { contains: filters.search, mode: 'insensitive' } },
                { game_name: { contains: filters.search, mode: 'insensitive' } },
                { username: { contains: filters.search, mode: 'insensitive' } },
                { txn_id: { contains: filters.search, mode: 'insensitive' } },
                { provider: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        const skip = (page - 1) * limit;
        const [rows, total] = await Promise.all([
            prisma.casinoTransaction.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip,
                take: limit,
            }),
            prisma.casinoTransaction.count({ where }),
        ]);

        // Map PostgreSQL CasinoTransaction → shape the admin page expects
        const data = rows.map((t: any) => ({
            _id: String(t.id),
            id: t.id,
            userId: t.user_id,
            username: t.username,
            gameCode: t.game_code,
            gameName: t.game_name || t.game_code,
            provider: t.provider,
            roundId: t.round_id || t.txn_id,
            txnId: t.txn_id,
            type: t.type,
            walletType: t.wallet_type,
            betAmount: t.type === 'BET' ? Number(t.amount) : 0,
            winAmount: t.type === 'WIN' ? Number(t.amount) : 0,
            amount: Number(t.amount),
            status: 'COMPLETED',
            currency: t.wallet_type === 'crypto' ? 'USD' : 'INR',
            createdAt: t.timestamp.toISOString(),
        }));

        return {
            success: true,
            data,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    } catch (error) {
        console.error('getCasinoBets error:', error);
        return { success: false, data: [], pagination: { page, limit, total: 0, pages: 0 } };
    }
}

export async function getCasinoBetStats() {
    try {
        const [total, betAgg, winAgg] = await Promise.all([
            prisma.casinoTransaction.count({
                where: { amount: { gt: 0 }, NOT: { type: 'UPDATE' } },
            }),
            prisma.casinoTransaction.aggregate({
                where: { type: 'BET', amount: { gt: 0 } },
                _sum: { amount: true },
            }),
            prisma.casinoTransaction.aggregate({
                where: { type: 'WIN', amount: { gt: 0 } },
                _sum: { amount: true },
            }),
        ]);

        const totalBet = betAgg._sum.amount ?? 0;
        const totalWin = winAgg._sum.amount ?? 0;
        const houseEdge = totalBet - totalWin;

        return {
            success: true,
            data: {
                total,
                pending: 0,
                completed: total,
                cancelled: 0,
                totalBet,
                totalWin,
                houseEdge,
            },
        };
    } catch (error) {
        console.error('getCasinoBetStats error:', error);
        return { success: false, data: null };
    }
}

export async function getCasinoBetProviders() {
    try {
        const rows = await prisma.casinoTransaction.findMany({
            where: { amount: { gt: 0 }, NOT: { type: 'UPDATE' } },
            select: { provider: true },
            distinct: ['provider'],
        });
        const providers = rows.map((r: any) => r.provider).filter(Boolean);
        return { success: true, data: providers };
    } catch (error) {
        console.error('getCasinoBetProviders error:', error);
        return { success: false, data: [] };
    }
}
