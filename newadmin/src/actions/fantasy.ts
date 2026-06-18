'use server'

import connectMongo from '@/lib/mongo';
import {
    FantasyMatch, FantasyContest, FantasyTeam,
    FantasyEntry, FantasyPointsSystem,
} from '@/models/MongoModels';
import { revalidatePath } from 'next/cache';

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:9828/api').replace(/\/$/, '');

function adminHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-admin-token': process.env.ADMIN_API_TOKEN || '',
    };
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function getFantasyStats() {
    try {
        await connectMongo();
        const [
            totalMatches, upcomingMatches, liveMatches, completedMatches,
            totalContests, activeContests,
            totalEntries, pendingEntries, settledEntries,
            totalTeams,
        ] = await Promise.all([
            FantasyMatch.countDocuments(),
            FantasyMatch.countDocuments({ status: 1 }),
            FantasyMatch.countDocuments({ status: 2 }),
            FantasyMatch.countDocuments({ status: 3 }),
            FantasyContest.countDocuments(),
            FantasyContest.countDocuments({ isActive: true }),
            FantasyEntry.countDocuments(),
            FantasyEntry.countDocuments({ status: 'pending' }),
            FantasyEntry.countDocuments({ status: 'settled' }),
            FantasyTeam.countDocuments(),
        ]);

        const revenueAgg = await FantasyEntry.aggregate([
            { $group: { _id: null, gross: { $sum: '$entryFee' }, paid: { $sum: '$winnings' } } },
        ]);
        const gross = revenueAgg[0]?.gross || 0;
        const paid = revenueAgg[0]?.paid || 0;

        return {
            success: true,
            data: {
                matches: { total: totalMatches, upcoming: upcomingMatches, live: liveMatches, completed: completedMatches },
                contests: { total: totalContests, active: activeContests },
                entries: { total: totalEntries, pending: pendingEntries, settled: settledEntries },
                teams: { total: totalTeams },
                revenue: { gross, paid, net: gross - paid },
            },
        };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to load fantasy stats' };
    }
}

// ─── Matches ──────────────────────────────────────────────────────────────────

export async function getFantasyMatches(page = 1, limit = 50, filters: {
    search?: string;
    status?: string;
    competitionId?: string;
} = {}) {
    try {
        await connectMongo();
        const query: any = {};
        if (filters.status && filters.status !== 'ALL') query.status = Number(filters.status);
        if (filters.competitionId) query.competitionId = Number(filters.competitionId);
        if (filters.search) {
            query.$or = [
                { title: { $regex: filters.search, $options: 'i' } },
                { shortTitle: { $regex: filters.search, $options: 'i' } },
                { competitionTitle: { $regex: filters.search, $options: 'i' } },
                { venue: { $regex: filters.search, $options: 'i' } },
            ];
        }
        const [rows, total] = await Promise.all([
            FantasyMatch.find(query)
                .sort({ startDate: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            FantasyMatch.countDocuments(query),
        ]);
        return {
            success: true,
            data: JSON.parse(JSON.stringify(rows)),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to fetch matches' };
    }
}

export async function getFantasyMatch(externalMatchId: number) {
    try {
        await connectMongo();
        const match = await FantasyMatch.findOne({ externalMatchId }).lean();
        if (!match) return { success: false, error: 'Match not found' };
        return { success: true, data: JSON.parse(JSON.stringify(match)) };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to fetch match' };
    }
}

export async function triggerFantasySync() {
    try {
        const res = await fetch(`${BACKEND_URL}/fantasy/admin/sync`, {
            method: 'POST',
            headers: adminHeaders(),
            cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { success: false, error: data?.message || `HTTP ${res.status}` };
        revalidatePath('/dashboard/fantasy/matches');
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Sync failed' };
    }
}

// ─── Contests ─────────────────────────────────────────────────────────────────

export async function getFantasyContests(matchId?: number, page = 1, limit = 100) {
    try {
        await connectMongo();
        const query: any = {};
        if (matchId) query.matchId = matchId;
        const [rows, total] = await Promise.all([
            FantasyContest.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            FantasyContest.countDocuments(query),
        ]);
        return {
            success: true,
            data: JSON.parse(JSON.stringify(rows)),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to fetch contests' };
    }
}

export async function createFantasyContest(data: {
    matchId: number;
    title: string;
    type: string;
    entryFee: number;
    totalPrize: number;
    maxSpots: number;
    prizeBreakdown?: Array<{ rankFrom: number; rankTo: number; prize: number; percentOfPool?: number }>;
    icon?: string;
    accent?: string;
}) {
    try {
        await connectMongo();
        const match = await FantasyMatch.findOne({ externalMatchId: data.matchId }).lean();
        if (!match) return { success: false, error: 'Match not found for that matchId' };

        const contest = await FantasyContest.create({
            ...data,
            filledSpots: 0,
            isActive: true,
            isAutoCreated: false,
            prizeBreakdown: data.prizeBreakdown || [],
        });
        revalidatePath('/dashboard/fantasy/contests');
        return { success: true, data: JSON.parse(JSON.stringify(contest)) };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to create contest' };
    }
}

export async function updateFantasyContest(id: string, data: Partial<{
    title: string;
    type: string;
    entryFee: number;
    totalPrize: number;
    maxSpots: number;
    isActive: boolean;
    icon: string;
    accent: string;
    prizeBreakdown: Array<{ rankFrom: number; rankTo: number; prize: number; percentOfPool?: number }>;
}>) {
    try {
        await connectMongo();
        const updated = await FantasyContest.findByIdAndUpdate(id, data, { returnDocument: 'after' }).lean();
        revalidatePath('/dashboard/fantasy/contests');
        return { success: true, data: JSON.parse(JSON.stringify(updated)) };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to update contest' };
    }
}

export async function deleteFantasyContest(id: string) {
    try {
        await connectMongo();
        // Don't delete a contest that already has entries.
        const entries = await FantasyEntry.countDocuments({ contestId: id });
        if (entries > 0) return { success: false, error: `Cannot delete: ${entries} entries exist. Deactivate instead.` };
        await FantasyContest.findByIdAndDelete(id);
        revalidatePath('/dashboard/fantasy/contests');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to delete contest' };
    }
}

export async function toggleFantasyContest(id: string, isActive: boolean) {
    try {
        await connectMongo();
        await FantasyContest.findByIdAndUpdate(id, { isActive });
        revalidatePath('/dashboard/fantasy/contests');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to toggle contest' };
    }
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function getFantasyTeams(page = 1, limit = 50, filters: {
    userId?: string;
    matchId?: string;
} = {}) {
    try {
        await connectMongo();
        const query: any = {};
        if (filters.userId) query.userId = Number(filters.userId);
        if (filters.matchId) query.matchId = Number(filters.matchId);
        const [rows, total] = await Promise.all([
            FantasyTeam.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            FantasyTeam.countDocuments(query),
        ]);
        return {
            success: true,
            data: JSON.parse(JSON.stringify(rows)),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to fetch teams' };
    }
}

// ─── Entries ──────────────────────────────────────────────────────────────────

export async function getFantasyEntries(page = 1, limit = 50, filters: {
    userId?: string;
    matchId?: string;
    contestId?: string;
    status?: string;
} = {}) {
    try {
        await connectMongo();
        const query: any = {};
        if (filters.userId) query.userId = Number(filters.userId);
        if (filters.matchId) query.matchId = Number(filters.matchId);
        if (filters.contestId) query.contestId = filters.contestId;
        if (filters.status && filters.status !== 'ALL') query.status = filters.status;
        const [rows, total] = await Promise.all([
            FantasyEntry.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            FantasyEntry.countDocuments(query),
        ]);
        return {
            success: true,
            data: JSON.parse(JSON.stringify(rows)),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to fetch entries' };
    }
}

// ─── Points System ────────────────────────────────────────────────────────────

const FORMATS = ['T20', 'ODI', 'Test'] as const;

export async function getFantasyPointsSystems() {
    try {
        await connectMongo();
        const rows = await FantasyPointsSystem.find().lean();
        return { success: true, data: JSON.parse(JSON.stringify(rows)) };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to fetch points systems' };
    }
}

export async function upsertFantasyPointsSystem(data: {
    format: string;
    run?: number; boundary?: number; six?: number;
    halfCentury?: number; century?: number; duck?: number;
    wicket?: number; bowlingThreeWickets?: number; bowlingFiveWickets?: number;
    maiden?: number; economyBonusBelow6?: number; economyPenaltyAbove10?: number;
    catch_points?: number; stumping?: number; runOut?: number;
    playerOfTheMatch?: number;
    captainMultiplier?: number; viceCaptainMultiplier?: number;
    playing11Bonus?: number;
}) {
    try {
        if (!FORMATS.includes(data.format as any)) {
            return { success: false, error: `Format must be one of: ${FORMATS.join(', ')}` };
        }
        await connectMongo();
        const { format, ...rest } = data;
        const row = await FantasyPointsSystem.findOneAndUpdate(
            { format },
            { format, ...rest },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
        ).lean();
        revalidatePath('/dashboard/fantasy/points-system');
        return { success: true, data: JSON.parse(JSON.stringify(row)) };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to save points system' };
    }
}

// ─── Players (passthrough to backend, which talks to EntitySport) ─────────────

export async function searchFantasyPlayers(search: string) {
    try {
        const qs = new URLSearchParams({ search });
        const res = await fetch(`${BACKEND_URL}/fantasy/players?${qs}`, {
            method: 'GET',
            headers: adminHeaders(),
            cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { success: false, error: data?.message || `HTTP ${res.status}` };
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to search players' };
    }
}

export async function getFantasyPlayerProfile(playerId: number) {
    try {
        const res = await fetch(`${BACKEND_URL}/fantasy/players/${playerId}`, {
            method: 'GET',
            headers: adminHeaders(),
            cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { success: false, error: data?.message || `HTTP ${res.status}` };
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to fetch player' };
    }
}

// ─── Leaderboard (admin view of any contest) ──────────────────────────────────

export async function getFantasyContestLeaderboard(contestId: string, page = 1, limit = 100) {
    try {
        await connectMongo();
        const [rows, total] = await Promise.all([
            FantasyEntry.find({ contestId })
                .sort({ totalPoints: -1, rank: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            FantasyEntry.countDocuments({ contestId }),
        ]);
        return {
            success: true,
            data: JSON.parse(JSON.stringify(rows)),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to fetch leaderboard' };
    }
}
