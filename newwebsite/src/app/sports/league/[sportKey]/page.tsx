'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, Search, Radio, Clock, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import LiveEventCard from '@/components/sports/LiveEventCard';
import type { LiveEvent } from '@/components/sports/types';
import { getEventLiveState, isEventLive, isEventInPlay } from '@/lib/sportsLobbyData';
import { useSportsSocket } from '@/context/SportsSocketContext';
import { applySocketPayloadToEvent, getSocketPayloadEventIds } from '@/lib/sportsRealtimeOdds';
import { sportsApi } from '@/services/sports';
import { resolveTeamAvatar } from '@/components/sports/teamIconHelpers';

// ─── Sportradar types ─────────────────────────────────────────────────────────
interface SrRunner {
  runnerId: string;
  runnerName: string;
  status: string;
  backPrices: { price: number; size: number }[];
  layPrices:  { price: number; size: number }[];
}
interface SrMarket {
  marketId: string;
  marketName: string;
  status: string;
  runners: SrRunner[];
  category?: string;
}
interface SrEvent {
  eventId: string;
  eventName: string;
  sportId: string;
  sportName: string;
  competitionId: string;
  competitionName: string;
  openDate: number;
  status: string;   // UPCOMING | LIVE | IN_PLAY | CLOSED
  catId?: string;
  homeScore: number;
  awayScore: number;
  winnerBlocked: boolean;
  country?: string;
  markets: {
    matchOdds: SrMarket[];
    premiumMarkets: SrMarket[];
    bookmakers: any[];
    fancyMarkets: any[];
  };
}

// ─── Sport meta ───────────────────────────────────────────────────────────────
const SPORT_META: Record<string, { emoji: string; label: string }> = {
  'sr:sport:1':   { emoji: '⚽', label: 'Soccer' },
  'sr:sport:21':  { emoji: '🏏', label: 'Cricket' },
  'sr:sport:2':   { emoji: '🏀', label: 'Basketball' },
  'sr:sport:5':   { emoji: '🎾', label: 'Tennis' },
  'sr:sport:16':  { emoji: '🏈', label: 'American Football' },
  'sr:sport:3':   { emoji: '⚾', label: 'Baseball' },
  'sr:sport:4':   { emoji: '🏒', label: 'Ice Hockey' },
  'sr:sport:117': { emoji: '🥊', label: 'MMA' },
  'sr:sport:12':  { emoji: '🏉', label: 'Rugby' },
  'sr:sport:20':  { emoji: '🏓', label: 'Table Tennis' },
  'sr:sport:31':  { emoji: '🏸', label: 'Badminton' },
  'sr:sport:23':  { emoji: '🏐', label: 'Volleyball' },
  'sr:sport:19':  { emoji: '🎱', label: 'Snooker' },
  'sr:sport:22':  { emoji: '🎯', label: 'Darts' },
  'sr:sport:29':  { emoji: '⚽', label: 'Futsal' },
  'sr:sport:138': { emoji: '🤸', label: 'Kabaddi' },
};
const DEFAULT_META = { emoji: '🏟️', label: 'Sports' };
const getMeta = (id: string) => SPORT_META[id] ?? DEFAULT_META;

// ─── Backend ──────────────────────────────────────────────────────────────────
const BACKEND = (process.env.NEXT_PUBLIC_API_URL ?? 'https://zeero.bet/api').replace(/\/$/, '');

async function fetchUpcomingPage(sportId: string, pageNo: number): Promise<{ data: SrEvent[]; pages: number; total: number }> {
  try {
    const res = await fetch(
      `${BACKEND}/sports/sportradar/upcoming?sportId=${encodeURIComponent(sportId)}&pageNo=${pageNo}`,
      { cache: 'no-store' },
    );
    const body = await res.json();
    return {
      data:  Array.isArray(body.data) ? body.data : [],
      pages: body.pages ?? 1,
      total: body.total ?? 0,
    };
  } catch { return { data: [], pages: 1, total: 0 }; }
}

async function fetchInplay(sportId: string): Promise<SrEvent[]> {
  try {
    const res = await fetch(`${BACKEND}/sports/sportradar/inplay`, { cache: 'no-store' });
    const body = await res.json();
    const all: SrEvent[] = Array.isArray(body.data) ? body.data : [];
    return all.filter((e) => e.sportId === sportId);
  } catch { return []; }
}

// ─── Converter ────────────────────────────────────────────────────────────────
function srToLive(ev: SrEvent, teamIcons: Record<string, string> = {}): LiveEvent {
  const liveState = getEventLiveState(ev);
  const isInPlay = liveState === 'IN_PLAY';
  const isLive = liveState === 'LIVE' || isInPlay;
  const market  = ev.markets?.matchOdds?.[0] ?? ev.markets?.premiumMarkets?.[0];
  const runners = market?.runners ?? [];

  const vsSplit  = ev.eventName.split(/ vs\.? /i);
  const homeName = vsSplit[0]?.trim() || runners[0]?.runnerName || 'Home';
  const awayName = vsSplit[1]?.trim() || runners[runners.length - 1]?.runnerName || 'Away';

  const hasScore  = isLive && (ev.homeScore > 0 || ev.awayScore > 0);
  const homeScore = hasScore ? String(ev.homeScore) : '';
  const awayScore = hasScore ? String(ev.awayScore) : '';

  const dt      = new Date(ev.openDate);
  const today   = new Date();
  const isToday = dt.toDateString() === today.toDateString();
  const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = isToday ? 'Today' : dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const status  = ev.status === 'CLOSED' ? 'Finished' : isInPlay ? 'IN PLAY' : isLive ? 'LIVE' : `${dateStr} ${timeStr}`;

  const odds: { label: string; value: string }[] = [];
  runners.forEach((r, i) => {
    const price = r.backPrices?.[0]?.price;
    if (!price) return;
    let label = r.runnerName;
    if (r.runnerName.toLowerCase() === 'draw') label = 'X';
    else if (runners.length === 3 && i === 0) label = '1';
    else if (runners.length === 3 && i === 2) label = '2';
    else if (runners.length === 2 && i === 0) label = '1';
    else if (runners.length === 2 && i === 1) label = '2';
    odds.push({ label, value: price.toFixed(2) });
  });

  const totalMarkets =
    (ev.markets?.matchOdds?.length ?? 0) +
    (ev.markets?.premiumMarkets?.length ?? 0) +
    (ev.markets?.bookmakers?.length ?? 0) +
    (ev.markets?.fancyMarkets?.length ?? 0);

  const homeAvatar = resolveTeamAvatar(homeName, teamIcons, ev.country);
  const awayAvatar = resolveTeamAvatar(awayName, teamIcons, ev.country);

  return {
    matchId:     ev.eventId,
    competition: ev.competitionName,
    sport:       getMeta(ev.sportId).label,
    isInPlay,
    isLive,
    status,
    hasTv:       false,
    teams: [
      { name: homeName, detail: homeScore, pill: homeScore, ...homeAvatar },
      { name: awayName, detail: awayScore, pill: awayScore, ...awayAvatar },
    ],
    odds,
    extra: totalMarkets > 1 ? `+${totalMarkets - 1}` : '',
  };
}

// ─── Card skeleton ────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="rounded-[28px] border border-white/[0.06] bg-bg-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3.5">
        <div className="skeleton-block skeleton-shimmer h-10 w-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton-block skeleton-shimmer h-3 w-40 rounded" />
          <div className="skeleton-block skeleton-shimmer h-2.5 w-24 rounded" />
        </div>
      </div>
      <div className="px-4 py-3.5 space-y-3">
        <div className="space-y-2.5">
          <div className="skeleton-block skeleton-shimmer h-4 w-36 rounded" />
          <div className="skeleton-block skeleton-shimmer h-4 w-28 rounded" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="skeleton-block skeleton-shimmer h-10 rounded-[18px]" />
          <div className="skeleton-block skeleton-shimmer h-10 rounded-[18px]" />
          <div className="skeleton-block skeleton-shimmer h-10 rounded-[18px]" />
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SportLeaguePage() {
  const params   = useParams<{ sportKey: string }>();
  const router   = useRouter();
  const sportId  = decodeURIComponent(params.sportKey ?? '');
  const meta     = getMeta(sportId);

  const [upcoming,  setUpcoming]  = useState<SrEvent[]>([]);
  const [inplay,    setInplay]    = useState<SrEvent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState<'all' | 'live' | 'upcoming'>('all');
  const [page,      setPage]      = useState(1);
  const [totalPages,setTotalPages]= useState(1);
  const [totalCount,setTotalCount]= useState(0);
  const [teamIcons, setTeamIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    sportsApi.getTeamIcons().then((map) => setTeamIcons(map)).catch(() => {});
  }, []);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [pageResult, liveEvents] = await Promise.all([
        fetchUpcomingPage(sportId, page),
        fetchInplay(sportId),
      ]);
      setUpcoming(pageResult.data);
      setTotalPages(pageResult.pages);
      setTotalCount(pageResult.total);
      setInplay(liveEvents);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sportId, page]);

  useEffect(() => { setLoading(true); load(); }, [sportId, page, load]);

  const { socket, connectionStatus, joinSportsLobby, leaveSportsLobby } = useSportsSocket();

  useEffect(() => {
    joinSportsLobby();
    return () => leaveSportsLobby();
  }, [joinSportsLobby, leaveSportsLobby]);

  useEffect(() => {
    const handler = (data: any) => {
      if (!data) return;
      const targetEventIds = new Set(getSocketPayloadEventIds(data));
      if (targetEventIds.size === 0) return;

      setInplay((prev) => {
        let didChange = false;
        const next = prev.map((event) => {
          if (!targetEventIds.has(event.eventId)) return event;
          const patched = applySocketPayloadToEvent(event, data, event.eventId);
          if (patched !== event) didChange = true;
          return patched;
        });
        return didChange ? next : prev;
      });

      setUpcoming((prev) => {
        let didChange = false;
        const next = prev.map((event) => {
          if (!targetEventIds.has(event.eventId)) return event;
          const patched = applySocketPayloadToEvent(event, data, event.eventId);
          if (patched !== event) didChange = true;
          return patched;
        });
        return didChange ? next : prev;
      });
    };

    socket?.on('sports-lobby-data', handler);
    return () => {
      socket?.off('sports-lobby-data', handler);
    };
  }, [socket]);

  // Poll inplay every 10s
  useEffect(() => {
    if (connectionStatus === 'connected') return;
    const t = setInterval(() => fetchInplay(sportId).then(setInplay), 10_000);
    return () => clearInterval(t);
  }, [sportId, connectionStatus]);

  const inplayIds = useMemo(() => new Set(inplay.map((e) => e.eventId)), [inplay]);

  // Merge: live events at top, then upcoming (deduped)
  const allEvents = useMemo(() => {
    const upcomingFiltered = upcoming.filter((e) => !inplayIds.has(e.eventId));
    return [...inplay, ...upcomingFiltered];
  }, [inplay, upcoming, inplayIds]);

  // Filter + search
  const displayed = useMemo(() => {
    let list = allEvents;
    if (filter === 'live')     list = list.filter((e) => isEventLive(e));
    if (filter === 'upcoming') list = list.filter((e) => !isEventLive(e) && e.status === 'UPCOMING');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.eventName.toLowerCase().includes(q) ||
        e.competitionName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allEvents, filter, search, inplayIds]);

  const cards = useMemo(
    () => displayed.map((e) => srToLive(e, teamIcons)),
    [displayed, teamIcons],
  );

  const liveCount = allEvents.filter((event) => isEventLive(event)).length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-base font-[family-name:var(--font-poppins)]">
      <Header />
      <div className="flex flex-1 overflow-hidden pt-[60px] md:pt-[64px] pb-[80px] md:pb-0 max-w-[1920px] mx-auto w-full">
        <LeftSidebar selectedSportId={sportId} />
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-bg-base">
          <div className="mx-auto max-w-[1820px] px-3 py-3 md:px-5 md:py-5 pb-[calc(var(--mobile-nav-height)+20px)] md:pb-10">

            {/* Back + title */}
            <div className="mb-5 flex items-start gap-3">
              <button type="button" onClick={() => router.back()}
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg-elevated text-text-muted transition hover:bg-bg-hover hover:text-text-primary active:scale-90">
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-2xl leading-none">{meta.emoji}</span>
                  <h1 className="font-adx-bold text-[22px] leading-tight text-text-primary md:text-[28px]">
                    {meta.label}
                  </h1>
                  {liveCount > 0 && (
                    <span className="flex items-center gap-1.5 rounded-full border border-danger/20 bg-danger-alpha-10 px-2.5 py-1 text-[11px] font-adx-bold text-danger">
                      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" /></span>
                      {liveCount} Live
                    </span>
                  )}
                  {!loading && (
                    <span className="rounded-full bg-bg-elevated px-2.5 py-1 text-[11px] text-text-muted">
                      {totalCount} total
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-[320px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled pointer-events-none" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search teams or competitions…"
                  className="w-full bg-bg-elevated text-[13px] text-text-primary pl-8 pr-3 py-2 rounded-xl border border-white/[0.04] focus:border-brand-gold/40 outline-none placeholder:text-text-disabled transition" />
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 rounded-xl bg-bg-elevated p-1">
                {(['all', 'live', 'upcoming'] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-adx-bold capitalize transition active:scale-95
                      ${filter === f
                        ? 'bg-brand-gold text-text-inverse shadow-[0_2px_8px_rgba(139,92,246,0.06)]'
                        : 'text-text-muted hover:text-text-primary'}`}>
                    {f === 'all' ? 'All' : f === 'live' ? '🔴 Live' : '📅 Upcoming'}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2">
                {!loading && (
                  <span className="rounded-full bg-bg-elevated px-3 py-1.5 text-[11px] text-text-muted">
                    {displayed.length} event{displayed.length !== 1 ? 's' : ''}
                  </span>
                )}
                <button type="button" onClick={() => load(true)} disabled={refreshing}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-elevated text-text-muted transition hover:bg-bg-hover hover:text-text-primary active:scale-90 disabled:opacity-40">
                  <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Grid */}
            {loading ? (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 12 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : cards.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.06] bg-bg-card">
                <Clock size={36} className="text-text-disabled" />
                <p className="font-adx-bold text-[16px] text-text-primary">{meta.label}</p>
                <p className="text-[13px] text-text-muted">
                  {search ? `No matches found for "${search}"` : 'No upcoming events at this time'}
                </p>
                {search && (
                  <button type="button" onClick={() => setSearch('')}
                    className="rounded-full bg-bg-elevated px-4 py-1.5 text-[12px] text-brand-gold transition hover:bg-bg-hover">
                    Clear search
                  </button>
                )}
              </div>
            ) : (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((event) => (
                  <div key={event.matchId} className="min-w-0">
                    <LiveEventCard
                      event={event}
                      variant="grid"
                      onCardClick={(id) => router.push(`/sports/match/${id}`)}
                      onOddsClick={(id) => router.push(`/sports/match/${id}`)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-elevated text-text-muted transition hover:bg-bg-hover hover:text-text-primary active:scale-90 disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <span className="rounded-xl bg-bg-elevated px-4 py-2 text-[13px] font-adx-bold text-text-primary">
                  {page} / {totalPages}
                </span>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-elevated text-text-muted transition hover:bg-bg-hover hover:text-text-primary active:scale-90 disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
