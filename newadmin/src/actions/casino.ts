'use server'

import connectMongo from '@/lib/mongo';
import {
    CasinoCategory, CasinoProvider, CasinoGame,
    HomeCasinoGame, TopCasinoGame, CasinoSectionGame, CasinoSectionConfig
} from '@/models/MongoModels';
import { revalidatePath } from 'next/cache';

// ─── Casino Categories ────────────────────────────────────────────────────────

export async function getCasinoCategories() {
    try {
        await connectMongo();
        const categories = await CasinoCategory.find().sort({ priority: -1, name: 1 }).lean();
        return { success: true, data: JSON.parse(JSON.stringify(categories)) };
    } catch { return { success: false, error: 'Failed to fetch categories' }; }
}

export async function createCasinoCategory(data: {
    name: string; icon?: string; pageType?: 'casino' | 'live'; priority?: number;
}) {
    try {
        await connectMongo();
        const slug = data.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const category = await CasinoCategory.create({ ...data, slug, icon: data.icon || 'Gamepad2', pageType: data.pageType || 'casino' });
        revalidatePath('/dashboard/casino/categories');
        return { success: true, data: JSON.parse(JSON.stringify(category)) };
    } catch (e: any) {
        if (e.code === 11000) return { success: false, error: 'A category with this name already exists.' };
        return { success: false, error: 'Failed to create category' };
    }
}

export async function updateCasinoCategory(id: string, data: {
    name?: string; icon?: string; pageType?: 'casino' | 'live'; priority?: number; isActive?: boolean;
}) {
    try {
        await connectMongo();
        if (data.name) {
            (data as any).slug = data.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        }
        const category = await CasinoCategory.findByIdAndUpdate(id, data, { returnDocument: 'after' }).lean();
        revalidatePath('/dashboard/casino/categories');
        return { success: true, data: JSON.parse(JSON.stringify(category)) };
    } catch { return { success: false, error: 'Failed to update category' }; }
}

export async function deleteCasinoCategory(id: string) {
    try {
        await connectMongo();
        await CasinoCategory.findByIdAndDelete(id);
        revalidatePath('/dashboard/casino/categories');
        return { success: true };
    } catch { return { success: false, error: 'Failed to delete category' }; }
}

// ─── Casino Providers ─────────────────────────────────────────────────────────

export async function getCasinoProviders() {
    try {
        await connectMongo();
        const providers = await CasinoProvider.find().sort({ priority: -1 }).lean();
        return { success: true, data: JSON.parse(JSON.stringify(providers)) };
    } catch { return { success: false, error: 'Failed to fetch providers' }; }
}

export async function createCasinoProvider(data: any) {
    try {
        await connectMongo();
        const provider = await CasinoProvider.create(data);
        revalidatePath('/dashboard/casino/providers');
        return { success: true, data: JSON.parse(JSON.stringify(provider)) };
    } catch { return { success: false, error: 'Failed to create provider' }; }
}

export async function updateCasinoProvider(id: string, data: any) {
    try {
        await connectMongo();
        const provider = await CasinoProvider.findByIdAndUpdate(id, data, { returnDocument: 'after' }).lean();
        revalidatePath('/dashboard/casino/providers');
        return { success: true, data: JSON.parse(JSON.stringify(provider)) };
    } catch { return { success: false, error: 'Failed to update provider' }; }
}

export async function deleteCasinoProvider(id: string) {
    try {
        await connectMongo();
        await CasinoProvider.findByIdAndDelete(id);
        revalidatePath('/dashboard/casino/providers');
        return { success: true };
    } catch { return { success: false, error: 'Failed to delete provider' }; }
}

// ─── Casino Games ─────────────────────────────────────────────────────────────

export async function getCasinoGames(page = 1, limit = 48, filters: {
    search?: string;
    provider?: string;
    category?: string;
    isActive?: string;
    isPopular?: string;
    isNewGame?: string;
    sortBy?: string;
} = {}) {
    try {
        await connectMongo();
        const query: any = {};
        if (filters.search) query.$or = [
            { name: { $regex: filters.search, $options: 'i' } },
            { provider: { $regex: filters.search, $options: 'i' } },
            { gameCode: { $regex: filters.search, $options: 'i' } },
        ];
        if (filters.provider && filters.provider !== 'ALL') query.provider = filters.provider;
        if (filters.category && filters.category !== 'ALL') query.category = filters.category;
        if (filters.isActive !== undefined && filters.isActive !== '') query.isActive = filters.isActive === 'true';
        if (filters.isPopular !== undefined && filters.isPopular !== '') query.isPopular = filters.isPopular === 'true';
        if (filters.isNewGame !== undefined && filters.isNewGame !== '') query.isNewGame = filters.isNewGame === 'true';

        let sortOption: any = { priority: -1, _id: -1 };
        if (filters.sortBy === 'newest') sortOption = { createdAt: -1 };
        if (filters.sortBy === 'name') sortOption = { name: 1 };
        if (filters.sortBy === 'plays') sortOption = { playCount: -1 };

        const [games, total] = await Promise.all([
            CasinoGame.find(query).sort(sortOption).skip((page - 1) * limit).limit(limit).lean(),
            CasinoGame.countDocuments(query),
        ]);
        return {
            success: true,
            data: JSON.parse(JSON.stringify(games)),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) }
        };
    } catch { return { success: false, error: 'Failed to fetch games' }; }
}

export async function getCasinoGameStats() {
    try {
        await connectMongo();
        const [total, active, popular, newGames] = await Promise.all([
            CasinoGame.countDocuments(),
            CasinoGame.countDocuments({ isActive: true }),
            CasinoGame.countDocuments({ isPopular: true }),
            CasinoGame.countDocuments({ isNewGame: true }),
        ]);
        // Count per section
        const sectionCounts = await CasinoSectionGame.aggregate([
            { $group: { _id: '$section', count: { $sum: 1 } } }
        ]);
        const bySection: Record<string, number> = {};
        sectionCounts.forEach((s: any) => { bySection[s._id] = s.count; });

        return {
            success: true, data: {
                total, active, popular, newGames,
                homeCount: bySection['home'] || 0,
                topCount: bySection['top'] || 0,
                sections: bySection,
            }
        };
    } catch { return { success: false, error: 'Failed to fetch stats' }; }
}

export async function toggleCasinoGame(id: string, isActive: boolean) {
    try {
        await connectMongo();
        await CasinoGame.findByIdAndUpdate(id, { isActive });
        revalidatePath('/dashboard/casino/games');
        return { success: true };
    } catch { return { success: false, error: 'Failed to toggle game' }; }
}

export async function toggleCasinoGamePopular(gameCode: string, isPopular: boolean) {
    try {
        await connectMongo();
        await CasinoGame.findOneAndUpdate({ gameCode }, { isPopular });
        revalidatePath('/dashboard/casino/games');
        return { success: true };
    } catch { return { success: false, error: 'Failed to toggle popular' }; }
}

export async function toggleCasinoGameNew(gameCode: string, isNewGame: boolean) {
    try {
        await connectMongo();
        await CasinoGame.findOneAndUpdate({ gameCode }, { isNewGame });
        revalidatePath('/dashboard/casino/games');
        return { success: true };
    } catch { return { success: false, error: 'Failed to toggle new status' }; }
}

export async function updateCasinoGame(id: string, data: any) {
    try {
        await connectMongo();
        await CasinoGame.findByIdAndUpdate(id, data);
        revalidatePath('/dashboard/casino/games');
        return { success: true };
    } catch { return { success: false, error: 'Failed to update game' }; }
}

// ─── Casino Section Games ─────────────────────────────────────────────────────
// Sections: 'popular' | 'new' | 'slots' | 'live' | 'table' | 'crash' | 'home' | 'top'

/**
 * Get all game codes pinned to a given section (fast lookup map).
 */
export async function getSectionGameCodes(section: string): Promise<string[]> {
    try {
        await connectMongo();
        const docs = await CasinoSectionGame.find({ section }, { gameCode: 1 }).lean();
        return docs.map((d: any) => d.gameCode);
    } catch { return []; }
}

/**
 * Get full pinned game list for a section (with metadata).
 */
export async function getSectionGames(section: string) {
    try {
        await connectMongo();
        const games = await CasinoSectionGame.find({ section }).sort({ order: 1 }).lean();
        return { success: true, data: JSON.parse(JSON.stringify(games)) };
    } catch { return { success: false, error: 'Failed to fetch section games' }; }
}

/**
 * Get all pinned game codes across ALL sections in one DB call.
 * Returns { section: Set<gameCode> }
 */
export async function getAllSectionGameCodes(): Promise<Record<string, string[]>> {
    try {
        await connectMongo();
        const docs = await CasinoSectionGame.find({}, { section: 1, gameCode: 1 }).lean();
        const result: Record<string, string[]> = {};
        docs.forEach((d: any) => {
            if (!result[d.section]) result[d.section] = [];
            result[d.section].push(d.gameCode);
        });
        return result;
    } catch { return {}; }
}

/**
 * Toggle a game in a section: add it if not present, remove if present.
 */
export async function toggleSectionGame(
    section: string,
    gameCode: string,
    pin: boolean,
    meta?: { name?: string; provider?: string; image?: string }
) {
    try {
        await connectMongo();
        if (pin) {
            const count = await CasinoSectionGame.countDocuments({ section });
            await CasinoSectionGame.findOneAndUpdate(
                { section, gameCode },
                { section, gameCode, ...meta, order: count },
                { upsert: true, returnDocument: 'after' }
            );
        } else {
            await CasinoSectionGame.findOneAndDelete({ section, gameCode });
        }
        revalidatePath('/dashboard/casino/games');
        return { success: true };
    } catch { return { success: false, error: 'Failed to toggle section game' }; }
}

/**
 * Remove all games from a section.
 */
export async function clearSection(section: string) {
    try {
        await connectMongo();
        await CasinoSectionGame.deleteMany({ section });
        revalidatePath('/dashboard/casino/games');
        return { success: true };
    } catch { return { success: false, error: 'Failed to clear section' }; }
}

/**
 * Re-order section games.
 */
export async function reorderSectionGames(section: string, gameCodes: string[]) {
    try {
        await connectMongo();
        const updates = gameCodes.map((code, index) =>
            CasinoSectionGame.findOneAndUpdate({ section, gameCode: code }, { order: index })
        );
        await Promise.all(updates);
        return { success: true };
    } catch { return { success: false, error: 'Failed to reorder' }; }
}

// Legacy helpers (kept for backward compat with home/top models)
export async function toggleHomeCasinoGame(gameCode: string, isHome: boolean, meta?: any) {
    return toggleSectionGame('home', gameCode, isHome, meta);
}
export async function toggleTopCasinoGame(gameCode: string, isTop: boolean, meta?: any) {
    return toggleSectionGame('top', gameCode, isTop, meta);
}
export async function getHomeCasinoGames() { return getSectionGames('home'); }
export async function getTopCasinoGames() { return getSectionGames('top'); }

export async function syncGames() { return { success: true }; }

// ─── Section Config (admin-editable row labels + custom groups) ────────────────

import path from 'path';
import fs from 'fs';

const WEBSITE_SECTIONS_PATH = path.join(process.cwd(), '..', 'newwebsite', 'data', 'casino-sections.json');

const DEFAULT_SECTIONS = [
    // Casino lobby
    { section: 'popular',  label: 'Hot Games',     icon: 'Flame',      pageType: 'casino', order: 0  },
    { section: 'slots',    label: 'Slots',          icon: 'Dice5',      pageType: 'casino', order: 1  },
    { section: 'new',      label: 'New Arrivals',   icon: 'Sparkles',   pageType: 'casino', order: 2  },
    { section: 'trending', label: 'Trending Now',   icon: 'TrendingUp', pageType: 'casino', order: 3  },
    { section: 'table',    label: 'Table Games',    icon: 'Coffee',     pageType: 'casino', order: 4  },
    { section: 'crash',    label: 'Crash Games',    icon: 'Zap',        pageType: 'casino', order: 5  },
    { section: 'fishing',  label: 'Fishing',        icon: 'Fish',       pageType: 'casino', order: 6  },
    { section: 'arcade',   label: 'Arcade',         icon: 'Gamepad2',   pageType: 'casino', order: 7  },
    { section: 'virtual',  label: 'Virtual Sports', icon: 'Trophy',     pageType: 'casino', order: 8  },
    { section: 'exclusive',label: 'Exclusive',      icon: 'Star',       pageType: 'casino', order: 9  },
    { section: 'top',      label: 'Top Picks',      icon: 'Crown',      pageType: 'casino', order: 10 },
    // Live Casino
    { section: 'live',     label: 'Popular Live',   icon: 'PlayCircle', pageType: 'live',   order: 0  },
    { section: 'roulette', label: 'Live Roulette',  icon: 'Circle',     pageType: 'live',   order: 1  },
    { section: 'blackjack',label: 'Live Blackjack', icon: 'Layers',     pageType: 'live',   order: 2  },
    { section: 'baccarat', label: 'Live Baccarat',  icon: 'Coffee',     pageType: 'live',   order: 3  },
    { section: 'shows',    label: 'Game Shows',     icon: 'Tv',         pageType: 'live',   order: 4  },
    { section: 'poker',    label: 'Live Poker',     icon: 'Gamepad2',   pageType: 'live',   order: 5  },
];

/** Sync all configs to the website's JSON file so getCasinoSections/getLiveSections picks them up. */
async function syncToWebsite(configs: any[]) {
    try {
        const dir = path.dirname(WEBSITE_SECTIONS_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(WEBSITE_SECTIONS_PATH, JSON.stringify(configs, null, 2), 'utf-8');
    } catch { /* non-fatal */ }
}

export async function getSectionConfigs() {
    try {
        await connectMongo();
        const fromDb = await CasinoSectionConfig.find().sort({ order: 1 }).lean() as any[];
        const dbMap: Record<string, any> = {};
        fromDb.forEach((c: any) => { dbMap[c.section] = c; });

        const merged = DEFAULT_SECTIONS.map((def: any, idx: number) => ({
            section:  def.section,
            label:    dbMap[def.section]?.label    ?? def.label,
            icon:     dbMap[def.section]?.icon     ?? def.icon ?? 'Gamepad2',
            pageType: dbMap[def.section]?.pageType ?? def.pageType,
            isVisible:dbMap[def.section]?.isVisible ?? true,
            isCustom: false,
            order:    dbMap[def.section]?.order    ?? idx,
        }));

        // Also include custom (admin-created) groups not in defaults
        const customGroups = fromDb.filter((c: any) => c.isCustom).map((c: any) => ({
            section:  c.section,
            label:    c.label,
            icon:     c.icon ?? 'Gamepad2',
            pageType: c.pageType ?? 'casino',
            isVisible:c.isVisible,
            isCustom: true,
            order:    c.order,
        }));

        return { success: true, data: [...merged, ...customGroups] };
    } catch { return { success: false, error: 'Failed to fetch configs' }; }
}

export async function upsertSectionConfig(section: string, label: string, isVisible: boolean, order: number) {
    try {
        await connectMongo();
        await CasinoSectionConfig.findOneAndUpdate(
            { section },
            { label, isVisible, order },
            { upsert: true, returnDocument: 'after' }
        );
        revalidatePath('/dashboard/casino/sections');
        return { success: true };
    } catch { return { success: false, error: 'Failed to save config' }; }
}

export async function updateSectionConfigs(configs: { section: string; label: string; icon?: string; pageType?: string; isVisible: boolean; isCustom?: boolean; order: number }[]) {
    try {
        await connectMongo();
        await Promise.all(configs.map((c, i) =>
            CasinoSectionConfig.findOneAndUpdate(
                { section: c.section },
                { label: c.label, icon: c.icon ?? 'Gamepad2', pageType: c.pageType ?? 'casino', isVisible: c.isVisible, isCustom: c.isCustom ?? false, order: c.order ?? i },
                { upsert: true }
            )
        ));
        await syncToWebsite(configs.map(c => ({ ...c, isCustom: c.isCustom ?? false, icon: c.icon ?? 'Gamepad2' })));
        revalidatePath('/dashboard/casino/sections');
        return { success: true };
    } catch { return { success: false, error: 'Failed to update configs' }; }
}

export async function createSectionConfig(section: string, label: string, pageType: 'casino' | 'live', icon = 'Gamepad2') {
    try {
        await connectMongo();
        const slug = section.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const existing = await CasinoSectionConfig.findOne({ section: slug });
        if (existing) return { success: false, error: 'A group with this key already exists.' };
        const count = await CasinoSectionConfig.countDocuments({ pageType });
        await CasinoSectionConfig.create({ section: slug, label, icon, pageType, isVisible: true, isCustom: true, order: count });
        revalidatePath('/dashboard/casino/sections');
        return { success: true, section: slug };
    } catch { return { success: false, error: 'Failed to create group' }; }
}

export async function deleteSectionConfig(section: string) {
    try {
        await connectMongo();
        // Only allow deleting custom groups
        const doc = await CasinoSectionConfig.findOne({ section });
        if (!doc?.isCustom) return { success: false, error: 'Cannot delete a built-in section.' };
        await CasinoSectionConfig.deleteOne({ section });
        revalidatePath('/dashboard/casino/sections');
        return { success: true };
    } catch { return { success: false, error: 'Failed to delete group' }; }
}

// ─── HUIDU Direct Query (admin) ───────────────────────────────────────────────
// Calls the NestJS backend, which proxies to HUIDU's /game/transaction/list
// using the agency AES key. Used for live audit / reconciliation against the
// local CasinoTransaction mirror.

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:9828/api').replace(/\/$/, '');

function adminHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-admin-token': process.env.ADMIN_API_TOKEN || '',
    };
}

export interface HuiduTxRecord {
    agency_uid: string;
    member_account: string;
    bet_amount: string;
    win_amount: string;
    currency_code: string;
    serial_number: string;
    game_round: string;
    game_uid: string;
    timestamp: string;
    wallet_type?: 'main' | 'crypto' | 'fiatbonus' | 'cryptobonus' | 'unknown';
}

/**
 * Fetch transactions from HUIDU directly for a single UTC day.
 * HUIDU enforces same-day from/to and a 60-day window.
 */
export async function getHuiduTransactions(params: {
    fromDate: number;
    toDate: number;
    pageNo?: number;
    pageSize?: number;
}) {
    try {
        const qs = new URLSearchParams({
            fromDate: String(params.fromDate),
            toDate: String(params.toDate),
            pageNo: String(params.pageNo ?? 1),
            pageSize: String(params.pageSize ?? 100),
        });
        const res = await fetch(`${BACKEND_URL}/admin/huidu/transactions?${qs}`, {
            method: 'GET',
            headers: adminHeaders(),
            cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok || data?.success === false) {
            return { success: false, error: data?.error || data?.msg || `HTTP ${res.status}` };
        }
        return {
            success: true,
            records: (data.records || []) as HuiduTxRecord[],
            totalCount: data.totalCount ?? 0,
            totalPage: data.totalPage ?? 0,
            currentPage: data.currentPage ?? 1,
            pageSize: data.pageSize ?? params.pageSize ?? 100,
        };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to fetch HUIDU transactions' };
    }
}

/**
 * Fetch a single user's HUIDU transactions for a single UTC day.
 * Server filters to only the records whose member_account belongs
 * to one of the user's four wallet variants.
 */
export async function getHuiduUserHistory(
    userId: number,
    params: { fromDate: number; toDate: number; pageNo?: number; pageSize?: number },
) {
    try {
        const qs = new URLSearchParams({
            fromDate: String(params.fromDate),
            toDate: String(params.toDate),
            pageNo: String(params.pageNo ?? 1),
            pageSize: String(params.pageSize ?? 5000),
        });
        const res = await fetch(
            `${BACKEND_URL}/admin/huidu/user/${userId}/history?${qs}`,
            { method: 'GET', headers: adminHeaders(), cache: 'no-store' },
        );
        const data = await res.json();
        if (!res.ok || data?.success === false) {
            return { success: false, error: data?.error || data?.msg || `HTTP ${res.status}` };
        }
        return {
            success: true,
            records: (data.records || []) as HuiduTxRecord[],
            accounts: data.accounts,
            totalMatched: data.totalMatched ?? 0,
            totalFetched: data.totalFetched ?? 0,
            totalCount: data.totalCount ?? 0,
            totalPage: data.totalPage ?? 0,
        };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to fetch HUIDU user history' };
    }
}

/**
 * Verify a single CasinoTransaction against HUIDU's live records.
 *
 * Steps:
 *   1. Look up the local row in PostgreSQL by txn_id (HUIDU `serial_number`)
 *      OR by numeric primary key.
 *   2. Pull HUIDU's same-day records for the day the local row was written
 *      (or the day the caller passed in if there's no local row).
 *   3. Locate the matching record by serial_number and compare bet/win/account.
 *   4. Return a verdict: VALID, MISMATCH, NOT_FOUND_IN_HUIDU, or NOT_FOUND_LOCAL.
 */
export interface CasinoTxVerifyResult {
    success: boolean;
    error?: string;
    verdict?: 'VALID' | 'MISMATCH' | 'NOT_FOUND_IN_HUIDU' | 'NOT_FOUND_LOCAL';
    local?: any;
    huidu?: HuiduTxRecord | null;
    diffs?: string[];
    queriedDay?: string;
}

export async function verifyCasinoTransaction(params: {
    txnId?: string;          // serial_number / round id text
    localId?: number;        // numeric pk in CasinoTransaction
    day?: string;            // YYYY-MM-DD (UTC). Optional if local row exists.
}): Promise<CasinoTxVerifyResult> {
    try {
        const { prisma } = await import('@/lib/db');

        // ── 1. Look up local row ────────────────────────────────────────────
        let local: any | null = null;
        if (params.localId && Number.isFinite(params.localId)) {
            local = await prisma.casinoTransaction.findUnique({
                where: { id: Number(params.localId) },
            });
        } else if (params.txnId) {
            local = await prisma.casinoTransaction.findFirst({
                where: { txn_id: params.txnId.trim() },
                orderBy: { timestamp: 'desc' },
            });
        }

        // ── 2. Resolve which UTC day to query HUIDU for ─────────────────────
        let dayIso: string | undefined = params.day;
        if (!dayIso && local?.timestamp) {
            dayIso = new Date(local.timestamp).toISOString().slice(0, 10);
        }
        if (!dayIso) {
            return {
                success: false,
                error: 'Cannot determine which day to query HUIDU for. Pass `day` (YYYY-MM-DD UTC) or a txnId that exists locally.',
            };
        }

        // Build same-day UTC bounds (HUIDU enforces from/to same day)
        const start = Date.UTC(
            Number(dayIso.slice(0, 4)),
            Number(dayIso.slice(5, 7)) - 1,
            Number(dayIso.slice(8, 10)),
            0, 0, 0, 0,
        );
        const end = start + 86_399_000;

        const serialToFind = params.txnId?.trim() || local?.txn_id;
        if (!serialToFind) {
            return {
                success: false,
                error: 'No txnId / serial_number to look for in HUIDU.',
            };
        }

        // ── 3. Page through HUIDU records for that day ──────────────────────
        const PAGE_SIZE = 5000;
        let pageNo = 1;
        let huiduMatch: HuiduTxRecord | null = null;
        let scanned = 0;

        while (true) {
            const res = await getHuiduTransactions({
                fromDate: start,
                toDate: end,
                pageNo,
                pageSize: PAGE_SIZE,
            });
            if (!res.success) {
                return { success: false, error: (res as any).error || 'HUIDU query failed', queriedDay: dayIso };
            }
            scanned += (res as any).records.length;
            huiduMatch = (res as any).records.find(
                (r: HuiduTxRecord) => r.serial_number === serialToFind,
            ) || null;

            if (huiduMatch) break;
            const totalPage = (res as any).totalPage || 0;
            if (pageNo >= totalPage || (res as any).records.length === 0) break;
            pageNo += 1;
            // Safety: HUIDU rate-limit, stop after 10 pages = 50k records
            if (pageNo > 10) break;
        }

        // ── 4. Build verdict ────────────────────────────────────────────────
        if (!local && !huiduMatch) {
            return {
                success: true,
                verdict: 'NOT_FOUND_LOCAL',
                error: `Not found in either local DB or HUIDU (scanned ${scanned} HUIDU records on ${dayIso}).`,
                queriedDay: dayIso,
                local: null,
                huidu: null,
            };
        }
        if (!huiduMatch) {
            return {
                success: true,
                verdict: 'NOT_FOUND_IN_HUIDU',
                local: local ? JSON.parse(JSON.stringify(local)) : null,
                huidu: null,
                queriedDay: dayIso,
                diffs: [`HUIDU has no record for serial_number=${serialToFind} on ${dayIso}`],
            };
        }
        if (!local) {
            return {
                success: true,
                verdict: 'NOT_FOUND_LOCAL',
                local: null,
                huidu: huiduMatch,
                queriedDay: dayIso,
                diffs: [`Local CasinoTransaction has no row with txn_id=${serialToFind}`],
            };
        }

        // Both exist — compare key fields
        const diffs: string[] = [];
        const localBet = local.type === 'BET' ? Number(local.amount) : 0;
        const localWin = local.type === 'WIN' ? Number(local.amount) : 0;
        const huiduBet = parseFloat(huiduMatch.bet_amount || '0');
        const huiduWin = parseFloat(huiduMatch.win_amount || '0');

        if (Math.abs(localBet - huiduBet) > 0.001) {
            diffs.push(`bet_amount: local=${localBet} ≠ huidu=${huiduBet}`);
        }
        if (Math.abs(localWin - huiduWin) > 0.001) {
            diffs.push(`win_amount: local=${localWin} ≠ huidu=${huiduWin}`);
        }
        if (local.game_code && huiduMatch.game_uid && local.game_code !== huiduMatch.game_uid) {
            diffs.push(`game_uid: local=${local.game_code} ≠ huidu=${huiduMatch.game_uid}`);
        }

        return {
            success: true,
            verdict: diffs.length === 0 ? 'VALID' : 'MISMATCH',
            local: JSON.parse(JSON.stringify(local)),
            huidu: huiduMatch,
            diffs,
            queriedDay: dayIso,
        };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Verification failed' };
    }
}

/** Returns the four HUIDU member_account variants for a given user. */
export async function getHuiduUserAccounts(userId: number) {
    try {
        const res = await fetch(
            `${BACKEND_URL}/admin/huidu/user/${userId}/accounts`,
            { method: 'GET', headers: adminHeaders(), cache: 'no-store' },
        );
        const data = await res.json();
        if (!res.ok || data?.success === false) {
            return { success: false, error: data?.error || `HTTP ${res.status}` };
        }
        return { success: true, accounts: data.accounts };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to fetch HUIDU accounts' };
    }
}
