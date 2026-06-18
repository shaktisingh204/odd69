'use server'

import connectMongo from '@/lib/mongo';
import {
    FantasyConfig, FantasyPromocode, FantasyContestTemplate,
    FantasyStreak, FantasyStreakReward, FantasyPowerup,
    FantasyPlayerCreditOverride, FantasyNotification, FantasyActivityLog,
    FantasyBonusRule, FantasyReferral, FantasyContest, FantasyEntry, FantasyMatch,
} from '@/models/MongoModels';
import { revalidatePath } from 'next/cache';

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:9828/api').replace(/\/$/, '');
const adminHeaders = () => ({
    'Content-Type': 'application/json',
    'x-admin-token': process.env.ADMIN_API_TOKEN || '',
});

async function call(path: string, opts: { method?: string; body?: any } = {}) {
    const res = await fetch(`${BACKEND_URL}${path}`, {
        method: opts.method || 'GET',
        headers: adminHeaders(),
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data?.message || `HTTP ${res.status}` };
    return { success: true, data };
}

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getFantasyConfig() {
    try {
        await connectMongo();
        const cfg = await FantasyConfig.findOneAndUpdate(
            { key: 'singleton' },
            { $setOnInsert: { key: 'singleton' } },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
        ).lean();
        return { success: true, data: JSON.parse(JSON.stringify(cfg)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

export async function updateFantasyConfig(patch: any) {
    try {
        await connectMongo();
        const cfg = await FantasyConfig.findOneAndUpdate(
            { key: 'singleton' }, { $set: patch }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
        ).lean();
        revalidatePath('/dashboard/fantasy/config');
        return { success: true, data: JSON.parse(JSON.stringify(cfg)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

// ─── Promocodes ───────────────────────────────────────────────────────────────

export async function getPromocodes() {
    try {
        await connectMongo();
        const rows = await FantasyPromocode.find().sort({ createdAt: -1 }).lean();
        return { success: true, data: JSON.parse(JSON.stringify(rows)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

export async function createPromocode(dto: any) {
    try {
        await connectMongo();
        dto.code = String(dto.code || '').toUpperCase().trim();
        if (!dto.code) return { success: false, error: 'Code required' };
        const p = await FantasyPromocode.create(dto);
        revalidatePath('/dashboard/fantasy/promocodes');
        return { success: true, data: JSON.parse(JSON.stringify(p)) };
    } catch (e: any) {
        if (e?.code === 11000) return { success: false, error: 'Code already exists' };
        return { success: false, error: e?.message || 'Failed' };
    }
}

export async function updatePromocode(id: string, patch: any) {
    try {
        await connectMongo();
        if (patch.code) patch.code = String(patch.code).toUpperCase().trim();
        const r = await FantasyPromocode.findByIdAndUpdate(id, patch, { returnDocument: 'after' }).lean();
        revalidatePath('/dashboard/fantasy/promocodes');
        return { success: true, data: JSON.parse(JSON.stringify(r)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

export async function deletePromocode(id: string) {
    try {
        await connectMongo();
        await FantasyPromocode.findByIdAndDelete(id);
        revalidatePath('/dashboard/fantasy/promocodes');
        return { success: true };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getContestTemplates() {
    try {
        await connectMongo();
        const rows = await FantasyContestTemplate.find().sort({ createdAt: -1 }).lean();
        return { success: true, data: JSON.parse(JSON.stringify(rows)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

export async function createContestTemplate(dto: any) {
    try {
        await connectMongo();
        const t = await FantasyContestTemplate.create(dto);
        revalidatePath('/dashboard/fantasy/templates');
        return { success: true, data: JSON.parse(JSON.stringify(t)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

export async function updateContestTemplate(id: string, patch: any) {
    try {
        await connectMongo();
        const t = await FantasyContestTemplate.findByIdAndUpdate(id, patch, { returnDocument: 'after' }).lean();
        revalidatePath('/dashboard/fantasy/templates');
        return { success: true, data: JSON.parse(JSON.stringify(t)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

export async function deleteContestTemplate(id: string) {
    try {
        await connectMongo();
        await FantasyContestTemplate.findByIdAndDelete(id);
        revalidatePath('/dashboard/fantasy/templates');
        return { success: true };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

export async function attachTemplatesToMatch(matchId: number, templateIds: string[]) {
    return call('/fantasy/admin/templates/attach', { method: 'POST', body: { matchId, templateIds } });
}

// ─── Bonus Rules ──────────────────────────────────────────────────────────────

export async function getBonusRules() {
    try {
        await connectMongo();
        const rows = await FantasyBonusRule.find().lean();
        return { success: true, data: JSON.parse(JSON.stringify(rows)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

export async function upsertBonusRule(dto: any) {
    try {
        await connectMongo();
        const r = await FantasyBonusRule.findOneAndUpdate(
            { trigger: dto.trigger }, { $set: dto }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
        ).lean();
        revalidatePath('/dashboard/fantasy/bonus-rules');
        return { success: true, data: JSON.parse(JSON.stringify(r)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

// ─── Streak schedule ──────────────────────────────────────────────────────────

export async function getStreakSchedule() {
    try {
        await connectMongo();
        const r = await FantasyStreakReward.findOneAndUpdate(
            { key: 'default' }, { $setOnInsert: { key: 'default', schedule: [
                { day: 1, amount: 5, type: 'bonus' },
                { day: 2, amount: 10, type: 'bonus' },
                { day: 3, amount: 15, type: 'bonus' },
                { day: 4, amount: 20, type: 'bonus' },
                { day: 5, amount: 30, type: 'bonus' },
                { day: 6, amount: 50, type: 'bonus' },
                { day: 7, amount: 100, type: 'bonus' },
            ] } },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
        ).lean();
        return { success: true, data: JSON.parse(JSON.stringify(r)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

export async function updateStreakSchedule(schedule: any[]) {
    try {
        await connectMongo();
        const r = await FantasyStreakReward.findOneAndUpdate(
            { key: 'default' }, { $set: { schedule } }, { upsert: true, returnDocument: 'after' },
        ).lean();
        revalidatePath('/dashboard/fantasy/streaks');
        return { success: true, data: JSON.parse(JSON.stringify(r)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

export async function getStreakLeaders() {
    try {
        await connectMongo();
        const rows = await FantasyStreak.find().sort({ currentStreak: -1 }).limit(100).lean();
        return { success: true, data: JSON.parse(JSON.stringify(rows)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

// ─── Season leaderboard ───────────────────────────────────────────────────────

export async function getSeasonLeaderboard(page = 1, limit = 50) {
    try {
        await connectMongo();
        const rows = await FantasyEntry.aggregate([
            { $match: { status: 'settled' } },
            { $group: {
                _id: '$userId',
                totalPoints: { $sum: '$totalPoints' },
                totalWinnings: { $sum: '$winnings' },
                totalEntries: { $sum: 1 },
                wins: { $sum: { $cond: [{ $gt: ['$winnings', 0] }, 1, 0] } },
            } },
            { $sort: { totalPoints: -1, totalWinnings: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
        ]);
        const total = (await FantasyEntry.distinct('userId', { status: 'settled' })).length;
        return {
            success: true,
            data: rows.map((r, i) => ({ ...r, userId: r._id, rank: (page - 1) * limit + i + 1 })),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

// ─── Activity log ─────────────────────────────────────────────────────────────

export async function getActivityLog(page = 1, limit = 100, action?: string) {
    try {
        await connectMongo();
        const q: any = {};
        if (action) q.action = action;
        const [rows, total] = await Promise.all([
            FantasyActivityLog.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            FantasyActivityLog.countDocuments(q),
        ]);
        return {
            success: true,
            data: JSON.parse(JSON.stringify(rows)),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

// ─── Player credit overrides ──────────────────────────────────────────────────

export async function getCreditOverrides(matchId?: number) {
    try {
        await connectMongo();
        const q: any = {};
        if (matchId) q.matchId = matchId;
        const rows = await FantasyPlayerCreditOverride.find(q).sort({ updatedAt: -1 }).lean();
        return { success: true, data: JSON.parse(JSON.stringify(rows)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

export async function setCreditOverride(matchId: number, playerId: number, newCredit: number, reason: string) {
    return call('/fantasy/admin/credit-overrides', { method: 'POST', body: { matchId, playerId, newCredit, reason } });
}

export async function setManualPoints(matchId: number, playerId: number, points: number, reason: string) {
    return call('/fantasy/admin/manual-points', { method: 'POST', body: { matchId, playerId, points, reason } });
}

// ─── Notifications (admin broadcast + list) ───────────────────────────────────

export async function getAdminNotifications(page = 1, limit = 100) {
    try {
        await connectMongo();
        const [rows, total] = await Promise.all([
            FantasyNotification.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            FantasyNotification.countDocuments(),
        ]);
        return {
            success: true,
            data: JSON.parse(JSON.stringify(rows)),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

export async function broadcastNotification(dto: any) {
    return call('/fantasy/admin/notifications/broadcast', { method: 'POST', body: dto });
}

// ─── Private contests (read-only view) ───────────────────────────────────────

export async function getPrivateContests(page = 1, limit = 50) {
    try {
        await connectMongo();
        const [rows, total] = await Promise.all([
            FantasyContest.find({ isPrivate: true }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            FantasyContest.countDocuments({ isPrivate: true }),
        ]);
        return {
            success: true,
            data: JSON.parse(JSON.stringify(rows)),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

// ─── Contest lifecycle (settle / refund / cancel / duplicate) ─────────────────

export async function settleContest(contestId: string, note?: string) {
    return call('/fantasy/admin/contests/settle', { method: 'POST', body: { contestId, note } });
}

export async function refundContest(contestId: string, reason?: string) {
    return call('/fantasy/admin/contests/refund', { method: 'POST', body: { contestId, reason } });
}

export async function cancelContest(contestId: string, reason: string, refundUsers = true) {
    return call('/fantasy/admin/contests/cancel', { method: 'POST', body: { contestId, reason, cancelContest: refundUsers } });
}

export async function duplicateContest(contestId: string) {
    return call('/fantasy/admin/contests/duplicate', { method: 'POST', body: { contestId } });
}

// ─── Match lifecycle ──────────────────────────────────────────────────────────

export async function disableMatch(matchId: number, reason: string) {
    return call(`/fantasy/admin/matches/${matchId}/disable`, { method: 'POST', body: { reason } });
}

export async function enableMatch(matchId: number) {
    return call(`/fantasy/admin/matches/${matchId}/enable`, { method: 'POST' });
}

// ─── Powerups grant ───────────────────────────────────────────────────────────

export async function grantPowerup(userId: number, type: string, count: number) {
    return call('/fantasy/admin/powerups/grant', { method: 'POST', body: { userId, type, count, source: 'admin' } });
}

export async function getPowerupsFor(userId: number) {
    try {
        await connectMongo();
        const rows = await FantasyPowerup.find({ userId }).lean();
        return { success: true, data: JSON.parse(JSON.stringify(rows)) };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

// ─── Referrals ────────────────────────────────────────────────────────────────

export async function getReferrals(page = 1, limit = 50) {
    try {
        await connectMongo();
        const [rows, total] = await Promise.all([
            FantasyReferral.find().sort({ totalEarned: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            FantasyReferral.countDocuments(),
        ]);
        return {
            success: true,
            data: JSON.parse(JSON.stringify(rows)),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    } catch (e: any) { return { success: false, error: e?.message || 'Failed' }; }
}

// CSV export (returns URL-style download helper)
export async function exportEntriesCsvUrl(matchId?: number, contestId?: string) {
    const qs = new URLSearchParams();
    if (matchId)   qs.set('matchId', String(matchId));
    if (contestId) qs.set('contestId', contestId);
    // Forward through backend (auth via x-admin-token header stripped by browser)
    // so admin downloads via a proxy route instead. Return a backend URL for server-side fetch.
    const res = await fetch(`${BACKEND_URL}/fantasy/admin/export/entries?${qs}`, {
        method: 'GET', headers: adminHeaders(), cache: 'no-store',
    });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
    const csv = await res.text();
    return { success: true, csv };
}
