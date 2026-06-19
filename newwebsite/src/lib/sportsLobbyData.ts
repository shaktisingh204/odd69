export interface SrRunner {
  runnerId: string;
  runnerName: string;
  status: string;
  backPrices: { price: number; size: number }[];
  layPrices: { price: number; size: number }[];
}

export interface SrMarket {
  marketId: string;
  marketName: string;
  marketType: string;
  status: string;
  runners: SrRunner[];
  category?: string;
  limits: { minBetValue: number; maxBetValue: number; currency: string };
}

export interface SrEvent {
  eventId: string;
  eventName: string;
  sportId: string;
  sportName: string;
  competitionId: string;
  competitionName: string;
  openDate: number;
  status: string;
  eventStatus?: string;
  catId: string;
  catName: string;
  homeScore: number;
  awayScore: number;
  country: string;
  venue: string;
  winnerBlocked: boolean;
  isFavourite: boolean;
  premiumEnabled: boolean;
  thumbnail: string;
  team1Image: string;
  team2Image: string;
  markets: {
    matchOdds: SrMarket[];
    bookmakers: any[];
    fancyMarkets: any[];
    premiumMarkets: any[];
    premiumTopic: string;
    premiumBaseUrl: string;
    matchOddsBaseUrl: string;
  };
}

export interface SportCount {
  sportId: string;
  sportName: string;
  upcoming: number;
  inplay: number;
  total: number;
}

export interface ActiveSportConfig {
  sport_id: string;
  sport_name: string;
  isVisible: boolean;
  tab: boolean;
  isdefault: boolean;
  sortOrder: number;
}

export interface SportsLobbyInitialData {
  inplayEvents: SrEvent[];
  upcomingBySport: Record<string, SrEvent[]>;
  eventCounts: SportCount[];
  totalEvents: number;
  totalLive: number;
  activeSports: ActiveSportConfig[]; // Detailed UI layout info from DB
}

export type SportsEventLiveState = 'UPCOMING' | 'LIVE' | 'IN_PLAY' | 'CLOSED';

// Removed hardcoded SPORT_ORDER; it is now strictly fetched dynamically from admin config
export const SPORT_ORDER: string[] = [];

const BACKEND = (process.env.NEXT_PUBLIC_API_URL ?? 'https://odd69.com/api').replace(/\/$/, '');

function normalizeLiveState(value: string | undefined | null) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

const CLOSED_EVENT_STATES = new Set([
  'CLOSED',
  'COMPLETED',
  'ENDED',
  'FINISHED',
  'ABANDONED',
  'SETTLED',
]);

export function getEventLiveState(
  event: Pick<SrEvent, 'status' | 'eventStatus'> | null | undefined,
): SportsEventLiveState {
  const status = normalizeLiveState(event?.status);
  const eventStatus = normalizeLiveState(event?.eventStatus);

  if (CLOSED_EVENT_STATES.has(status) || CLOSED_EVENT_STATES.has(eventStatus)) {
    return 'CLOSED';
  }
  if (status === 'IN_PLAY' || eventStatus === 'IN_PLAY') return 'IN_PLAY';
  if (status === 'LIVE' || eventStatus === 'LIVE') return 'LIVE';
  return 'UPCOMING';
}

export function isEventLive(event: Pick<SrEvent, 'status' | 'eventStatus'> | null | undefined) {
  const liveState = getEventLiveState(event);
  return liveState === 'LIVE' || liveState === 'IN_PLAY';
}

export function isEventInPlay(event: Pick<SrEvent, 'status' | 'eventStatus'> | null | undefined) {
  return getEventLiveState(event) === 'IN_PLAY';
}

export async function fetchInplayEvents(): Promise<SrEvent[]> {
  try {
    const res = await fetch(`${BACKEND}/sports/sportradar/inplay`, { cache: 'no-store' });
    const body = await res.json();
    return Array.isArray(body.data) ? body.data : [];
  } catch {
    return [];
  }
}

export async function fetchAllPagesForSport(sportId: string): Promise<SrEvent[]> {
  try {
    const url = `${BACKEND}/sports/sportradar/upcoming?sportId=${encodeURIComponent(sportId)}&pageNo=1`;
    const res = await fetch(url, { cache: 'no-store' });
    const body = await res.json();
    if (!body.success) return [];

    const firstPage: SrEvent[] = Array.isArray(body.data) ? body.data : [];
    const totalPages: number = body.pages ?? 1;

    if (totalPages <= 1) return firstPage;

    const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const rest = await Promise.allSettled(
      pageNums.map(async (pageNo) => {
        const pageRes = await fetch(
          `${BACKEND}/sports/sportradar/upcoming?sportId=${encodeURIComponent(sportId)}&pageNo=${pageNo}`,
          { cache: 'no-store' },
        );
        const pageBody = await pageRes.json();
        return Array.isArray(pageBody.data) ? (pageBody.data as SrEvent[]) : [];
      }),
    );

    const allEvents = [...firstPage];
    rest.forEach((result) => {
      if (result.status === 'fulfilled') {
        allEvents.push(...result.value);
      }
    });
    return allEvents;
  } catch {
    return [];
  }
}

export async function fetchEventsCount(): Promise<{ sports: SportCount[]; totalEvents: number; totalLive: number }> {
  try {
    const res = await fetch(`${BACKEND}/sports/sportradar/events-count`, { cache: 'no-store' });
    const body = await res.json();
    return {
      sports: Array.isArray(body.sports) ? body.sports : [],
      totalEvents: body.totalEvents ?? 0,
      totalLive: body.totalLive ?? 0,
    };
  } catch {
    return { sports: [], totalEvents: 0, totalLive: 0 };
  }
}

export async function fetchActiveSports(): Promise<ActiveSportConfig[]> {
  try {
    const res = await fetch(`${BACKEND}/sports/sportradar/sports`, { cache: 'no-store' });
    const body = await res.json();
    return Array.isArray(body) ? body : [];
  } catch {
    return [];
  }
}

export async function fetchSportsLobbyInitialData(): Promise<SportsLobbyInitialData> {
  const activeSports = await fetchActiveSports();

  const [inplayEvents, counts, upcomingEntries] = await Promise.all([
    fetchInplayEvents(),
    fetchEventsCount(),
    Promise.all(
      activeSports.map(async (sport) => {
        const events = await fetchAllPagesForSport(sport.sport_id);
        return [sport.sport_id, events] as const;
      }),
    ),
  ]);

  const upcomingBySport = upcomingEntries.reduce<Record<string, SrEvent[]>>((acc, [sportId, events]) => {
    if (events.length > 0) {
      acc[sportId] = events;
    }
    return acc;
  }, {});

  return {
    inplayEvents,
    upcomingBySport,
    eventCounts: counts.sports,
    totalEvents: counts.totalEvents,
    totalLive: counts.totalLive,
    activeSports,
  };
}
