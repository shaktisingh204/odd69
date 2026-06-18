import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const SPORT_LIST = [
    { eid: 4,  name: 'Cricket' },
    { eid: 1,  name: 'Football' },
    { eid: 2,  name: 'Tennis' },
    { eid: 66, name: 'Kabaddi' },
    { eid: 10, name: 'Horse Racing' },
    { eid: 40, name: 'Politics' },
    { eid: 8,  name: 'Table Tennis' },
    { eid: 15, name: 'Basketball' },
    { eid: 6,  name: 'Boxing' },
    { eid: 18, name: 'Volleyball' },
    { eid: 22, name: 'Badminton' },
];

let redis: Redis | null = null;

function getRedis() {
    if (!redis) {
        redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            enableOfflineQueue: false,
            connectTimeout: 3000,
            lazyConnect: true,
        });
        redis.on('error', () => { /* suppress */ });
    }
    return redis;
}

function extractTeams(ev: any): string[] {
    const name: string = ev.ename || ev.event_name || '';
    // home/away stored in feed as parts of event name "A v B"
    const parts = name.split(' v ');
    if (parts.length >= 2) return [parts[0].trim(), parts[1].trim()];
    if (parts.length === 1 && parts[0]) return [parts[0].trim()];
    return [];
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').toLowerCase().trim();

    try {
        const client = getRedis();
        await client.connect().catch(() => {}); // safe if already connected

        const allEvents: any[] = [];

        await Promise.all(SPORT_LIST.map(async (sport) => {
            try {
                const raw = await client.get(`allevents:${sport.eid}`);
                if (!raw) return;
                const feedEvents: any[] = JSON.parse(raw);

                for (const e of feedEvents) {
                    const eventId = String(e?.gmid ?? e?.eid ?? e?.event_id ?? '');
                    if (!eventId) continue;

                    const inplay = !!(e?.iplay ?? e?.inplay ?? false);
                    const openDate = String(e?.stime ?? e?.open_date ?? '');

                    // Skip events that started > 5h ago and are not live
                    const startMs = openDate ? new Date(openDate).getTime() : 0;
                    const hours = startMs > 0 ? (Date.now() - startMs) / 3_600_000 : 0;
                    if (!inplay && hours > 5) continue;

                    const eventName = String(e?.ename ?? e?.event_name ?? '');
                    const competitionName = String(e?.cname ?? e?.competition_name ?? '');

                    // Client-side filter
                    if (q) {
                        const hay = `${eventName} ${competitionName}`.toLowerCase();
                        if (!hay.includes(q)) continue;
                    }

                    // Extract teams from name
                    const nameParts = eventName.split(' v ');
                    const homeTeam = nameParts.length >= 2 ? nameParts[0].trim() : eventName;
                    const awayTeam = nameParts.length >= 2 ? nameParts[1].trim() : '';

                    allEvents.push({
                        event_id: eventId,
                        event_name: eventName,
                        home_team: homeTeam,
                        away_team: awayTeam,
                        teams: [homeTeam, awayTeam].filter(Boolean),
                        competition_name: competitionName,
                        sport_name: sport.name,
                        sport_id: String(sport.eid),
                        open_date: openDate,
                        in_play: inplay,
                        match_status: inplay ? 'Live' : 'Pending',
                    });
                }
            } catch { /* skip sport on error */ }
        }));

        // Deduplicate
        const seen = new Set<string>();
        const deduped = allEvents.filter(e => {
            if (seen.has(e.event_id)) return false;
            seen.add(e.event_id);
            return true;
        });

        // Sort: live first, then by open_date
        deduped.sort((a, b) => {
            if (a.in_play && !b.in_play) return -1;
            if (!a.in_play && b.in_play) return 1;
            return new Date(a.open_date).getTime() - new Date(b.open_date).getTime();
        });

        return NextResponse.json(deduped);
    } catch (error: any) {
        console.error('[events] Redis error:', error.message);
        return NextResponse.json([], { status: 200 }); // return empty, not 500
    }
}
