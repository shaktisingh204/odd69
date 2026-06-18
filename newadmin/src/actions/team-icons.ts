'use server'

import connectMongo from '@/lib/mongo';
import { TeamIcon } from '@/models/MongoModels';
import { uploadToCloudflare } from '@/actions/upload';
import { revalidatePath } from 'next/cache';

// ─── Get all team icons ──────────────────────────────────────────────────────

export async function getTeamIcons() {
    try {
        await connectMongo();
        const icons = await TeamIcon.find().sort({ display_name: 1 }).lean();
        return { success: true, data: JSON.parse(JSON.stringify(icons)) };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to fetch team icons' };
    }
}

// ─── Upload team icon to Cloudflare & save/update in DB ──────────────────────

export async function uploadTeamIcon(formData: FormData) {
    try {
        const teamName = (formData.get('teamName') as string)?.trim();
        const sportId  = (formData.get('sportId')  as string)?.trim() || '';
        const file     = formData.get('file') as File | null;

        if (!teamName) return { success: false, error: 'Team name is required' };
        if (!file)     return { success: false, error: 'No file provided' };

        // Upload to Cloudflare Images under "team-icons" folder
        const cfForm = new FormData();
        cfForm.append('file', file);
        cfForm.append('folder', 'team-icons');

        const uploadResult = await uploadToCloudflare(cfForm);
        if (!uploadResult.success || !uploadResult.url) {
            return { success: false, error: uploadResult.error || 'Cloudflare upload failed' };
        }

        // Upsert into MongoDB
        await connectMongo();
        const normalised = teamName.toLowerCase();
        await TeamIcon.findOneAndUpdate(
            { team_name: normalised },
            {
                team_name: normalised,
                display_name: teamName,
                icon_url: uploadResult.url,
                sport_id: sportId,
            },
            { upsert: true, returnDocument: 'after' },
        );

        revalidatePath('/dashboard/sports/team-icons');
        return { success: true, url: uploadResult.url };
    } catch (error: any) {
        return { success: false, error: error.message || 'Upload failed' };
    }
}

// ─── Delete a team icon ──────────────────────────────────────────────────────

export async function deleteTeamIcon(id: string) {
    try {
        await connectMongo();
        await TeamIcon.findByIdAndDelete(id);
        revalidatePath('/dashboard/sports/team-icons');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Delete failed' };
    }
}

// ─── Get unique team names from live/upcoming Sportradar events in Redis ─────

import Redis from 'ioredis';

// Sportradar Redis caches populated by the backend SportradarService.
// Reads from the merged inplay + upcoming feeds so every currently-visible
// team on the website is available for icon assignment.
const SR_CACHE_KEYS = [
    'sportradar:inplay:all',
    'sportradar:upcoming:all',
];

let _redis: Redis | null = null;
function getRedis() {
    if (!_redis) {
        _redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: Number(process.env.REDIS_DB) || 0,
            enableOfflineQueue: false,
            connectTimeout: 3000,
            lazyConnect: true,
        });
        _redis.on('error', () => {});
    }
    return _redis;
}

function parseTeamsFromEventName(eventName: string): string[] {
    // Sportradar uses "Team A vs. Team B"; also handle legacy " v " and " @ ".
    const separators = [/ vs\.? /i, / v /i, / @ /i, / - /];
    for (const sep of separators) {
        const parts = eventName.split(sep);
        if (parts.length >= 2) return parts.map((p) => p.trim()).filter(Boolean);
    }
    return [eventName.trim()].filter(Boolean);
}

export async function getUniqueTeamNames() {
    try {
        const client = getRedis();
        await client.connect().catch(() => {});

        const teamSet = new Set<string>();

        await Promise.all(SR_CACHE_KEYS.map(async (key) => {
            try {
                const raw = await client.get(key);
                if (!raw) return;
                const events: any[] = JSON.parse(raw);
                for (const e of events) {
                    const eventName = String(e?.eventName ?? e?.ename ?? e?.event_name ?? '').trim();
                    if (!eventName) continue;
                    for (const team of parseTeamsFromEventName(eventName)) {
                        if (team) teamSet.add(team);
                    }
                }
            } catch { /* skip this cache key */ }
        }));

        // Fallback: scan per-sport event caches if the merged "all" keys are empty
        if (teamSet.size === 0) {
            try {
                const sportIdKeys = await client.keys('sportradar:events:sr:sport:*');
                await Promise.all(sportIdKeys.slice(0, 20).map(async (k) => {
                    const raw = await client.get(k);
                    if (!raw) return;
                    const events: any[] = JSON.parse(raw);
                    for (const e of events) {
                        const eventName = String(e?.eventName ?? '').trim();
                        if (!eventName) continue;
                        for (const team of parseTeamsFromEventName(eventName)) {
                            if (team) teamSet.add(team);
                        }
                    }
                }));
            } catch { /* ignore */ }
        }

        return { success: true, data: Array.from(teamSet).sort() };
    } catch (error: any) {
        return { success: false, error: error.message, data: [] };
    }
}
