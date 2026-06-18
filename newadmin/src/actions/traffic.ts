'use server';

import connectMongo from '@/lib/mongo';
import { UserTrafficEvent } from '@/models/MongoModels';
import { prisma } from '@/lib/db';

export interface TrafficFilters {
    days?: number;         // 7 | 30 | 90
    startDate?: string;    // ISO date string (custom range)
    endDate?: string;
}

export interface SourceRow {
    source: string;
    medium: string | null;
    campaign: string | null;
    signups: number;
    ftdCount: number;
    ftdRate: string;
    revenue: number;
    userIds: number[];
}

export interface TrafficSummary {
    totalSignups: number;
    paidSignups: number;
    organicSignups: number;
    topSource: string;
    rows: SourceRow[];
    timeline: { date: string; signups: number }[];
}

// Determines whether a UTM source indicates paid traffic
function isPaid(source: string | null): boolean {
    if (!source) return false;
    const s = source.toLowerCase();
    return ['instagram', 'facebook', 'google', 'tiktok', 'twitter', 'youtube',
        'snapchat', 'pinterest', 'linkedin', 'telegram', 'whatsapp', 'ads',
        'cpc', 'paid', 'meta'].some(p => s.includes(p));
}

export async function getTrafficReport(filters: TrafficFilters = {}) {
    try {
        await connectMongo();

        // Build date range
        const days = filters.days || 30;
        const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
        endDate.setHours(23, 59, 59, 999);
        const startDate = filters.startDate
            ? new Date(filters.startDate)
            : new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);

        // Fetch all traffic events in the date range
        const events = await UserTrafficEvent.find({
            createdAt: { $gte: startDate, $lte: endDate },
        }).lean() as any[];

        if (!events.length) {
            return {
                success: true,
                data: {
                    totalSignups: 0,
                    paidSignups: 0,
                    organicSignups: 0,
                    topSource: '—',
                    rows: [],
                    timeline: [],
                } as TrafficSummary,
            };
        }

        // Collect all userIds to fetch deposit data from Postgres
        const allUserIds = [...new Set(events.map((e) => e.userId))];

        // Get FTD (first-time deposit) status + revenue from Prisma
        const deposits = await prisma.transaction.findMany({
            where: {
                userId: { in: allUserIds },
                type: 'DEPOSIT',
                status: { in: ['APPROVED', 'COMPLETED'] },
            },
            select: { userId: true, amount: true },
        });

        // Build per-user deposit map: userId → { hasFtd, totalDeposited }
        const depositMap = new Map<number, { hasFtd: boolean; total: number }>();
        for (const d of deposits) {
            const uid = d.userId;
            const existing = depositMap.get(uid) || { hasFtd: false, total: 0 };
            depositMap.set(uid, {
                hasFtd: true,
                total: existing.total + Number(d.amount),
            });
        }

        // Aggregate by source / medium / campaign
        const sourceMap = new Map<string, SourceRow>();

        for (const ev of events) {
            const source = ev.utm_source || 'organic';
            const medium = ev.utm_medium || null;
            const campaign = ev.utm_campaign || null;
            const key = `${source}|${medium || ''}|${campaign || ''}`;

            if (!sourceMap.has(key)) {
                sourceMap.set(key, { source, medium, campaign, signups: 0, ftdCount: 0, ftdRate: '0%', revenue: 0, userIds: [] });
            }
            const row = sourceMap.get(key)!;
            row.signups++;
            row.userIds.push(ev.userId);

            const dep = depositMap.get(ev.userId);
            if (dep?.hasFtd) {
                row.ftdCount++;
                row.revenue += dep.total;
            }
        }

        // Compute FTD rates
        const rows: SourceRow[] = Array.from(sourceMap.values())
            .map(row => ({
                ...row,
                ftdRate: row.signups > 0 ? `${((row.ftdCount / row.signups) * 100).toFixed(1)}%` : '0%',
                userIds: [], // strip before returning
            }))
            .sort((a, b) => b.signups - a.signups);

        // Build timeline (one entry per day)
        const timelineMap = new Map<string, number>();
        for (const ev of events) {
            const d = new Date(ev.createdAt).toISOString().split('T')[0];
            timelineMap.set(d, (timelineMap.get(d) || 0) + 1);
        }
        const timeline = Array.from(timelineMap.entries())
            .map(([date, signups]) => ({ date, signups }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const paidSignups = events.filter(e => isPaid(e.utm_source)).length;
        const topRow = rows[0];

        const summary: TrafficSummary = {
            totalSignups: events.length,
            paidSignups,
            organicSignups: events.length - paidSignups,
            topSource: topRow?.source || '—',
            rows,
            timeline,
        };

        return { success: true, data: summary };
    } catch (error: any) {
        console.error('[TrafficReport] Error:', error);
        return { success: false, error: 'Failed to fetch traffic data', data: null };
    }
}

// Lightweight summary: total signups by source for the last N days
export async function getTrafficSourceSummary(days = 7) {
    try {
        await connectMongo();
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const agg = await UserTrafficEvent.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { $ifNull: ['$utm_source', 'organic'] },
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]);

        return { success: true, data: agg.map(a => ({ source: a._id, count: a.count })) };
    } catch {
        return { success: false, data: [] };
    }
}
