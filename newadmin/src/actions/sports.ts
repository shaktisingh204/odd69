'use server'

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import connectMongo from '@/lib/mongo';
import {
    Bet,
    TopEvent, HomeEvent,
    BetfairSport, BetfairEvent, BetfairMarket, SportLeague, SportPageSection,
} from '@/models/MongoModels';



// ═══════════════════════════════════════════════════════════════════════════════
// SPORTS — BetfairSport (betfair_sports collection)
// Source of truth for which sports Sportradar currently provides
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all sports from betfair_sports, sorted by sortOrder asc.
 * Replaces old Diamond API `Sport` model query.
 */
export async function getSports() {
    try {
        await connectMongo();
        const sports = await BetfairSport
            .find({ sportId: { $regex: /^sr:/ } })
            .sort({ sortOrder: 1, name: 1 })
            .lean();
        return { success: true, data: JSON.parse(JSON.stringify(sports)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch sports', data: [] };
    }
}

/** Toggle a sport's active (visible) state */
export async function toggleSportVisibility(sportId: string, isActive: boolean) {
    try {
        await connectMongo();
        await BetfairSport.findOneAndUpdate({ sportId }, { isActive });
        revalidatePath('/dashboard/sports');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update sport visibility' };
    }
}

/** Toggle whether sport appears as a top-nav tab */
export async function updateSportTabStatus(sportId: string, isTab: boolean) {
    try {
        await connectMongo();
        await BetfairSport.findOneAndUpdate({ sportId }, { isTab });
        revalidatePath('/dashboard/sports');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update tab status' };
    }
}

/** Set one sport as default, clears isDefault on all others */
export async function setSportDefault(sportId: string) {
    try {
        await connectMongo();
        await BetfairSport.updateMany({}, { $set: { isDefault: false } });
        await BetfairSport.findOneAndUpdate({ sportId }, { $set: { isDefault: true } });
        revalidatePath('/dashboard/sports');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to set default sport' };
    }
}

/**
 * Bulk-update sort orders for all sports at once.
 * Used by the Live Builder drag-and-drop reordering.
 * @param order Array of { sportId, sortOrder } pairs
 */
export async function bulkUpdateSportOrder(order: { sportId: string; sortOrder: number }[]) {
    try {
        await connectMongo();
        const ops = order.map(({ sportId, sortOrder }) => ({
            updateOne: {
                filter: { sportId },
                update: { $set: { sortOrder } },
            },
        }));
        await BetfairSport.bulkWrite(ops, { ordered: false });
        revalidatePath('/dashboard/sports');
        revalidatePath('/dashboard/sports/live-builder');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update sport order' };
    }
}



// ═══════════════════════════════════════════════════════════════════════════════
// EVENTS — BetfairEvent (betfair_events collection)
// Synced from Sportradar events-catalogue by SportradarService.
// Admin now also pulls live events from Redis (via backend API) so that
// matches visible on the player site always appear here too.
// ═══════════════════════════════════════════════════════════════════════════════

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:9828/api').replace(/\/$/, '');

/**
 * Fetch upcoming + inplay events from the backend Sportradar API (reads Redis).
 * Upserts any events that are missing from MongoDB so admin can manage them.
 */
async function syncRedisEventsToMongo(sportId?: string) {
    try {
        // Fetch upcoming (all sports or specific)
        const upcomingUrl = sportId && sportId !== 'ALL'
            ? `${BACKEND_URL}/sports/sportradar/upcoming?sportId=${encodeURIComponent(sportId)}`
            : `${BACKEND_URL}/sports/sportradar/upcoming`;
        const inplayUrl = `${BACKEND_URL}/sports/sportradar/inplay`;

        const [upcomingRes, inplayRes] = await Promise.all([
            fetch(upcomingUrl, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ data: [] })),
            fetch(inplayUrl, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ data: [] })),
        ]);

        const upcoming: any[] = Array.isArray(upcomingRes.data) ? upcomingRes.data : [];
        const inplay: any[] = Array.isArray(inplayRes.data) ? inplayRes.data : [];

        // Filter by sport if needed
        const allApiEvents = [...inplay, ...upcoming].filter(ev => {
            if (!ev.eventId || !String(ev.eventId).startsWith('sr:')) return false;
            if (sportId && sportId !== 'ALL' && ev.sportId !== sportId) return false;
            return true;
        });

        if (allApiEvents.length === 0) return;

        await connectMongo();

        // Upsert all events — new ones get default admin flags,
        // existing ones get status/inplay updated but admin flags preserved.
        const ops = allApiEvents.map(ev => ({
            updateOne: {
                filter: { eventId: ev.eventId },
                update: {
                    $setOnInsert: {
                        isVisible: true,
                        isPinned: false,
                    },
                    $set: {
                        eventId:         ev.eventId,
                        eventName:       ev.eventName || '',
                        sportId:         ev.sportId || '',
                        competitionId:   ev.competitionId || '',
                        competitionName: ev.competitionName || '',
                        marketStartTime: ev.openDate ? new Date(ev.openDate) : new Date(),
                        inplay:          ev.status === 'LIVE' || ev.status === 'IN_PLAY',
                        status:          ev.status || 'UPCOMING',
                        homeTeam:        ev.eventName?.split(/ vs\.? /i)?.[0]?.trim() || '',
                        awayTeam:        ev.eventName?.split(/ vs\.? /i)?.[1]?.trim() || '',
                    },
                },
                upsert: true,
            },
        }));

        // Chunk to avoid MongoDB limits
        for (let i = 0; i < ops.length; i += 500) {
            await BetfairEvent.bulkWrite(ops.slice(i, i + 500), { ordered: false });
        }
    } catch (e) {
        // Silently fail — MongoDB data still works as fallback
        console.error('[syncRedisEventsToMongo]', e);
    }
}

/**
 * Get ALL events across all sports (live + upcoming), joined with sport info.
 * First syncs any missing events from Redis → MongoDB, then queries MongoDB.
 */
export async function getAllBetfairEvents(search?: string, sportId?: string) {
    try {
        // Sync fresh events from Redis into MongoDB first
        await syncRedisEventsToMongo(sportId);

        await connectMongo();

        const matchStage: any = { status: { $ne: 'CLOSED' }, eventId: { $regex: /^sr:/ } };
        if (sportId && sportId !== 'ALL') {
            matchStage.sportId = sportId;
        }
        if (search && search.length > 1) {
            matchStage.$or = [
                { eventName: { $regex: search, $options: 'i' } },
                { competitionName: { $regex: search, $options: 'i' } },
            ];
        }

        const events = await BetfairEvent.aggregate([
            { $match: matchStage },
            { $sort: { isPinned: -1, inplay: -1, marketStartTime: 1 } },
            { $limit: 500 },
        ]);

        return { success: true, data: JSON.parse(JSON.stringify(events)) };
    } catch (error) {
        console.error('getAllBetfairEvents error', error);
        return { success: false, error: 'Failed to fetch events', data: [] };
    }
}

/**
 * Get events for a specific sport (by Sportradar sportId like "sr:sport:21").
 * Syncs from Redis first.
 */
export async function getBetfairEventsBySport(sportId: string) {
    try {
        // Sync fresh events from Redis into MongoDB first
        await syncRedisEventsToMongo(sportId);

        await connectMongo();

        const events = await BetfairEvent
            .find({ sportId, status: { $ne: 'CLOSED' }, eventId: { $regex: /^sr:/ } })
            .sort({ isPinned: -1, inplay: -1, marketStartTime: 1 })
            .limit(200)
            .lean();

        return { success: true, data: JSON.parse(JSON.stringify(events)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch events for sport', data: [] };
    }
}

/** Toggle a match's visibility in the sportsbook */
export async function toggleBetfairEventVisibility(eventId: string, isVisible: boolean) {
    try {
        await connectMongo();
        await BetfairEvent.findOneAndUpdate({ eventId }, { isVisible });
        revalidatePath('/dashboard/sports/events');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to toggle event visibility' };
    }
}

/** Toggle pinned status — pinned matches are sorted to the top on the player site */
export async function toggleBetfairEventPinned(eventId: string, isPinned: boolean) {
    try {
        await connectMongo();
        await BetfairEvent.findOneAndUpdate({ eventId }, { isPinned });
        revalidatePath('/dashboard/sports/events');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to toggle pinned status' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPETITIONS — aggregated from BetfairEvent
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get distinct competitions for a sport by aggregating betfair_events.
 * Returns { competitionId, competitionName, eventCount, liveCount }.
 */
export async function getCompetitionsBySport(sportId: string) {
    try {
        await connectMongo();

        const comps = await BetfairEvent.aggregate([
            { $match: { sportId, status: { $ne: 'CLOSED' }, eventId: { $regex: /^sr:/ } } },
            {
                $group: {
                    _id: '$competitionId',
                    competitionName: { $first: '$competitionName' },
                    competitionId: { $first: '$competitionId' },
                    sportId: { $first: '$sportId' },
                    eventCount: { $sum: 1 },
                    liveCount: { $sum: { $cond: ['$inplay', 1, 0] } },
                    isVisible: { $first: '$isVisible' },
                }
            },
            { $sort: { eventCount: -1 } },
        ]);

        return { success: true, data: JSON.parse(JSON.stringify(comps)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch competitions', data: [] };
    }
}

/**
 * Get ALL competitions across all sports (for the main sports management page).
 */
export async function getAllCompetitions() {
    try {
        await connectMongo();

        const comps = await BetfairEvent.aggregate([
            { $match: { status: { $ne: 'CLOSED' }, eventId: { $regex: /^sr:/ } } },
            {
                $group: {
                    _id: '$competitionId',
                    competitionId:   { $first: '$competitionId' },
                    competitionName: { $first: '$competitionName' },
                    sportId:         { $first: '$sportId' },
                    eventCount:      { $sum: 1 },
                    liveCount:       { $sum: { $cond: ['$inplay', 1, 0] } },
                }
            },
            { $sort: { sportId: 1, eventCount: -1 } },
        ]);

        return { success: true, data: JSON.parse(JSON.stringify(comps)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch competitions', data: [] };
    }
}

/**
 * Bulk toggle isVisible for all events in a competition.
 */
export async function toggleCompetitionEvents(competitionId: string, isVisible: boolean) {
    try {
        await connectMongo();
        await BetfairEvent.updateMany({ competitionId }, { $set: { isVisible } });
        revalidatePath('/dashboard/sports');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to toggle competition visibility' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POPULAR EVENTS — TopEvent (unchanged, still used by homepage)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getTopEvents() {
    try {
        await connectMongo();
        const events = await TopEvent.find().lean();
        return { success: true, data: JSON.parse(JSON.stringify(events)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch top events', data: [] };
    }
}

/**
 * Toggle popular status. Uses eventId from BetfairEvent format (sr:match:XXXX).
 */
export async function togglePopularEvent(eventId: string, isPopular: boolean, eventName?: string) {
    try {
        await connectMongo();
        if (isPopular) {
            await TopEvent.findOneAndUpdate(
                { event_id: eventId },
                { event_id: eventId, event_name: eventName || '' },
                { upsert: true, returnDocument: 'after' }
            );
        } else {
            await TopEvent.findOneAndDelete({ event_id: eventId });
        }
        revalidatePath('/dashboard/sports/events');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to toggle popular event' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE EVENTS — HomeEvent (unchanged)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getHomeEvents() {
    try {
        await connectMongo();
        const events = await HomeEvent.find().lean();
        return { success: true, data: JSON.parse(JSON.stringify(events)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch home events', data: [] };
    }
}

export async function toggleHomeEvent(eventId: string, isHome: boolean, eventName?: string) {
    try {
        await connectMongo();
        if (isHome) {
            await HomeEvent.findOneAndUpdate(
                { event_id: eventId },
                { event_id: eventId, event_name: eventName || '' },
                { upsert: true, returnDocument: 'after' }
            );
        } else {
            await HomeEvent.findOneAndDelete({ event_id: eventId });
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to toggle home event' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPORT LEAGUES — SportLeague (sport_leagues collection)
// Admin manages imageUrl; backend seeds from Redis event cache
// ═══════════════════════════════════════════════════════════════════════════════

/** Get all sport leagues sorted by order asc */
export async function getSportLeagues() {
    try {
        await connectMongo();
        const leagues = await SportLeague
            .find()
            .sort({ order: 1, eventCount: -1 })
            .lean();
        return { success: true, data: JSON.parse(JSON.stringify(leagues)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch leagues', data: [] };
    }
}

/** Update the thumbnail/background image for an event (shown on match cards) */
export async function updateEventThumbnail(eventId: string, thumbnail: string) {
    'use server';
    try {
        await connectMongo();
        await BetfairEvent.findOneAndUpdate(
            { eventId },
            { $set: { thumbnail } }
        );
        revalidatePath('/dashboard/sports/events');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update event thumbnail' };
    }
}

/** Update the team background images for an event card ("/" split style) */
export async function updateEventTeamImages(eventId: string, team1Image: string, team2Image: string) {
    'use server';
    try {
        await connectMongo();
        await BetfairEvent.findOneAndUpdate(
            { eventId },
            { $set: { team1Image, team2Image } }
        );
        revalidatePath('/dashboard/sports/events');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update team images' };
    }
}

/** Update the image URL for a league */
export async function updateLeagueImage(competitionId: string, imageUrl: string) {
    try {
        await connectMongo();
        await SportLeague.findOneAndUpdate(
            { competitionId },
            { $set: { imageUrl } }
        );
        revalidatePath('/dashboard/sports/leagues');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update league image' };
    }
}

/** Toggle a league's visibility in the frontend slider */
export async function updateLeagueVisibility(competitionId: string, isVisible: boolean) {
    try {
        await connectMongo();
        await SportLeague.findOneAndUpdate(
            { competitionId },
            { $set: { isVisible } }
        );
        revalidatePath('/dashboard/sports/leagues');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update league visibility' };
    }
}

/**
 * Bulk reorder leagues. Accepts ordered array of competitionIds.
 * Sets order = index position.
 */
export async function updateLeagueOrder(orderedIds: string[]) {
    try {
        await connectMongo();
        const ops = orderedIds.map((competitionId, idx) => ({
            updateOne: {
                filter: { competitionId },
                update: { $set: { order: idx } },
            },
        }));
        await SportLeague.bulkWrite(ops, { ordered: false });
        revalidatePath('/dashboard/sports/leagues');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to reorder leagues' };
    }
}

/**
 * Seed sport_leagues from the Sportradar betfair_events MongoDB collection.
 * Aggregates unique (competitionId, competitionName, sportId) from all open events
 * and upserts them into the sport_leagues collection.
 */
export async function seedLeaguesFromBackend() {
    try {
        await connectMongo();

        // Aggregate distinct competitions from the Sportradar events collection
        const competitions = await BetfairEvent.aggregate([
            { $match: { status: { $ne: 'CLOSED' }, competitionId: { $exists: true, $ne: '' }, eventId: { $regex: /^sr:/ } } },
            {
                $group: {
                    _id: '$competitionId',
                    competitionId:   { $first: '$competitionId' },
                    competitionName: { $first: '$competitionName' },
                    sportId:         { $first: '$sportId' },
                    eventCount:      { $sum: 1 },
                },
            },
        ]);

        if (competitions.length === 0) {
            return { success: true, seeded: 0, message: 'No open events found in betfair_events — nothing seeded' };
        }

        // Build sportId → sportName lookup from BetfairSport (betfair_sports)
        const sportDocs = await BetfairSport.find({}, { sportId: 1, name: 1 }).lean();
        const sportNameMap: Record<string, string> = {};
        for (const s of sportDocs) sportNameMap[s.sportId] = s.name || '';

        const ops = competitions.map((comp: any) => ({
            updateOne: {
                filter: { competitionId: comp.competitionId },
                update: {
                    $setOnInsert: {
                        competitionId:   comp.competitionId,
                        order:           999,
                    },
                    $set: {
                        competitionName: comp.competitionName || '',
                        sportId:         comp.sportId || '',
                        sportName:       sportNameMap[comp.sportId] || '',
                        eventCount:      comp.eventCount,
                    },
                },
                upsert: true,
            },
        }));

        await SportLeague.bulkWrite(ops, { ordered: false });

        revalidatePath('/dashboard/sports/leagues');
        return { success: true, seeded: ops.length, message: `Seeded ${ops.length} leagues from Sportradar MongoDB events` };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to seed leagues' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BET LIMITS — SystemConfig (PostgreSQL, unchanged)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getBetLimits() {
    try {
        const config = await prisma.systemConfig.findUnique({
            where: { key: 'BET_LIMITS' }
        });
        return { success: true, data: config?.value ? JSON.parse(config.value) : {} };
    } catch (error) {
        return { success: false, error: 'Failed to fetch limits' };
    }
}

export async function updateBetLimits(limits: any) {
    try {
        await prisma.systemConfig.upsert({
            where: { key: 'BET_LIMITS' },
            update: { value: JSON.stringify(limits) },
            create: { key: 'BET_LIMITS', value: JSON.stringify(limits) }
        });
        revalidatePath('/dashboard/sports/limits');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update limits' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISK MANAGEMENT — bets aggregation (MongoDB, unchanged field names)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getMarketLiability() {
    try {
        await connectMongo();
        const liability = await Bet.aggregate([
            { $match: { status: 'PENDING' } },
            {
                $group: {
                    _id: { eventId: '$eventId', marketId: '$marketId' },
                    eventName: { $first: '$eventName' },
                    marketName: { $first: '$marketName' },
                    marketTotalStake: { $sum: '$stake' },
                    selections: {
                        $push: {
                            selectionName: '$selectionName',
                            totalStake: '$stake',
                            totalPayout: '$potentialWin',
                            betCount: 1
                        }
                    }
                }
            },
            { $unwind: '$selections' },
            {
                $group: {
                    _id: { eventId: '$_id.eventId', marketId: '$_id.marketId', selectionName: '$selections.selectionName' },
                    eventName: { $first: '$eventName' },
                    marketName: { $first: '$marketName' },
                    marketTotalStake: { $first: '$marketTotalStake' },
                    selectionTotalPayout: { $sum: '$selections.totalPayout' },
                    selectionTotalStake: { $sum: '$selections.totalStake' },
                    betCount: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: { eventId: '$_id.eventId', marketId: '$_id.marketId' },
                    eventName: { $first: '$eventName' },
                    marketName: { $first: '$marketName' },
                    marketTotalStake: { $first: '$marketTotalStake' },
                    selections: {
                        $push: {
                            selectionName: '$_id.selectionName',
                            totalStake: '$selectionTotalStake',
                            totalPayout: '$selectionTotalPayout',
                            betCount: '$betCount'
                        }
                    },
                    maxPayout: { $max: '$selectionTotalPayout' }
                }
            },
            {
                $project: {
                    eventName: 1,
                    marketName: 1,
                    marketTotalStake: 1,
                    worstCaseLiability: { $subtract: ['$maxPayout', '$marketTotalStake'] },
                    selections: 1
                }
            },
            { $sort: { worstCaseLiability: -1 } }
        ]);

        return { success: true, data: JSON.parse(JSON.stringify(liability)) };
    } catch (error) {
        console.error('Liability fetch failed:', error);
        return { success: false, error: 'Failed to fetch liability' };
    }
}

export async function getHighRiskBets() {
    try {
        await connectMongo();
        const bets = await Bet.find({
            status: 'PENDING',
            potentialWin: { $gt: 10000 }
        })
            .sort({ potentialWin: -1 })
            .limit(20)
            .lean();

        return { success: true, data: JSON.parse(JSON.stringify(bets)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch high risk bets' };
    }
}

export async function getHighRiskUsers() {
    try {
        const users = await prisma.user.findMany({
            where: { exposure: { gt: 10000 } },
            orderBy: { exposure: 'desc' },
            take: 20
        });
        return { success: true, data: users };
    } catch (error) {
        return { success: false, error: 'Failed' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMO TEAM — events from Sportradar MongoDB (betfair_events collection)
// The backend SportradarService continuously upserts live + upcoming events.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get events for promo team assignment.
 * Reads directly from the betfair_events MongoDB collection which the backend
 * Sportradar sync service keeps up-to-date in real time.
 * Only returns OPEN events (CLOSED / COMPLETED excluded),
 * sorted live-first then by marketStartTime asc.
 */
export async function getPromoTeamEvents(search = '') {
    try {
        // Pull newly created matches from Redis into Mongo so the promo
        // dialog sees them without waiting for the events page to run first.
        await syncRedisEventsToMongo();

        await connectMongo();

        const matchStage: any = {
            status: { $ne: 'CLOSED' },
            eventId: { $regex: /^sr:/ },
        };

        if (search && search.trim().length >= 2) {
            const q = search.trim();
            matchStage.$or = [
                { eventName:       { $regex: q, $options: 'i' } },
                { competitionName: { $regex: q, $options: 'i' } },
                { homeTeam:        { $regex: q, $options: 'i' } },
                { awayTeam:        { $regex: q, $options: 'i' } },
            ];
        }

        const events = await BetfairEvent
            .find(matchStage)
            .sort({ inplay: -1, marketStartTime: 1 })
            .limit(500)
            .lean();

        const data = events.map((e: any) => {
            const homeTeam = e.homeTeam || e.eventName?.split(' vs. ')?.[0]?.trim() || '';
            const awayTeam = e.awayTeam || e.eventName?.split(' vs. ')?.[1]?.trim() || '';
            return {
                event_id:         e.eventId,
                event_name:       e.eventName,
                home_team:        homeTeam,
                away_team:        awayTeam,
                teams:            [homeTeam, awayTeam].filter(Boolean),
                competition_name: e.competitionName || '',
                competition_id:   e.competitionId   || '',
                sport_id:         e.sportId          || '',
                open_date:        e.marketStartTime  || '',
                in_play:          !!e.inplay,
                match_status:     e.inplay ? 'Live' : 'Upcoming',
                status:           e.status  || 'OPEN',
            };
        });

        return { success: true, data };
    } catch (error: any) {
        console.error('getPromoTeamEvents (MongoDB) failed:', error);
        return { success: false, data: [], error: error.message || 'Failed to fetch events' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPORT LIMITS — per-sport min/max bet (stored in BetfairSport)
// ═══════════════════════════════════════════════════════════════════════════════

export async function updateSportLimits(sportId: string, minBet: number, maxBet: number) {
    try {
        await connectMongo();
        await BetfairSport.findOneAndUpdate(
            { sportId },
            { $set: { minBet, maxBet } }
        );
        revalidatePath('/dashboard/sports/limits');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to update sport limits' };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPORTS PAGE LAYOUT — SportPageSection (sport_page_sections collection)
// Configures which sections appear on /sports and in what order
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_SECTIONS = [
    { sectionId: 'hero',           label: 'Hero Banner / Slider',  icon: '🎬', sortOrder: 1, isLocked: true,  isVisible: true },
    { sectionId: 'sport_badges',   label: 'All Sports Rail',        icon: '🏟️', sortOrder: 2, isLocked: false, isVisible: true },
    { sectionId: 'leagues',        label: 'Featured Leagues',       icon: '🏆', sortOrder: 3, isLocked: false, isVisible: true },
    { sectionId: 'pinned_matches', label: 'Pinned Matches',         icon: '⭐', sortOrder: 4, isLocked: false, isVisible: true },
    { sectionId: 'top_matches',    label: 'Top Matches',            icon: '🔥', sortOrder: 5, isLocked: false, isVisible: true },
    { sectionId: 'sport_groups',   label: 'Sport Event Groups',     icon: '📋', sortOrder: 6, isLocked: false, isVisible: true },
];

/** Fetch all sports page sections, sorted by sortOrder. Seeds defaults if empty. */
export async function getSportPageSections() {
    try {
        await connectMongo();
        let sections = await SportPageSection.find({}).sort({ sortOrder: 1 }).lean();

        // Seed defaults on first run
        if (sections.length === 0) {
            await SportPageSection.insertMany(DEFAULT_SECTIONS);
            sections = await SportPageSection.find({}).sort({ sortOrder: 1 }).lean();
        }

        return { success: true, data: JSON.parse(JSON.stringify(sections)) };
    } catch (error) {
        return { success: false, error: 'Failed to fetch page sections', data: [] };
    }
}

/** Bulk update sort orders for all sections */
export async function bulkUpdateSectionOrder(order: { sectionId: string; sortOrder: number }[]) {
    try {
        await connectMongo();
        const ops = order.map(({ sectionId, sortOrder }) => ({
            updateOne: {
                filter: { sectionId },
                update: { $set: { sortOrder } },
                upsert: false,
            },
        }));
        await SportPageSection.bulkWrite(ops, { ordered: false });
        revalidatePath('/dashboard/sports/live-builder');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to save section order' };
    }
}

/** Toggle visibility of a single section */
export async function toggleSectionVisibility(sectionId: string, isVisible: boolean) {
    try {
        await connectMongo();
        await SportPageSection.findOneAndUpdate({ sectionId }, { isVisible });
        revalidatePath('/dashboard/sports/live-builder');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to toggle section visibility' };
    }
}

/** Fetch the full page layout config as a simple ordered array for the frontend */
export async function getSportsPageLayout() {
    try {
        await connectMongo();
        let sections = await SportPageSection.find({}).sort({ sortOrder: 1 }).lean();
        if (sections.length === 0) {
            await SportPageSection.insertMany(DEFAULT_SECTIONS);
            sections = await SportPageSection.find({}).sort({ sortOrder: 1 }).lean();
        }
        return JSON.parse(JSON.stringify(sections));
    } catch {
        return DEFAULT_SECTIONS;
    }
}

