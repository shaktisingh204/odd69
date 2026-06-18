"use client";

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from "@/components/layout/Header";
import { sportsApi, Event } from '@/services/sports';
import {
    ChevronLeft, Activity, Shield, Zap, Clock,
    ChevronDown, ChevronUp, Lock
} from 'lucide-react';
import { useBets } from '@/context/BetContext';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import RightSidebar from '@/components/layout/RightSidebar';
import LeftSidebar from '@/components/layout/LeftSidebar';
import GamesRail from '@/components/layout/GamesRail';
import OneClickBetControls from '@/components/sports/OneClickBetControls';
import { showBetErrorToast, showBetPlacedToast } from '@/utils/betToasts';
import { useEarlySixMatches } from '@/hooks/useEarlySixMatches';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SRRunner {
    runnerId: string;
    runnerName: string;
    status: string;
    backPrices: Array<{ price: number; size: number }>;
    layPrices: Array<{ price: number; size: number }>;
}

interface SRMarket {
    marketId: string;
    marketName: string;
    marketType: string;
    status: string;
    runners: SRRunner[];
    limits?: { minBetValue: number; maxBetValue: number; currency: string };
    category?: string;
}

interface SRMarkets {
    matchOdds?: SRMarket[];
    bookmakers?: SRMarket[];
    fancyMarkets?: SRMarket[];
    premiumMarkets?: SRMarket[];
    matchOddsBaseUrl?: string;
    premiumBaseUrl?: string;
    premiumTopic?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ms: number | string) {
    const d = new Date(typeof ms === 'string' ? Number(ms) : ms);
    if (isNaN(d.getTime())) return String(ms);
    return d.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function getInitials(name?: string) {
    if (!name) return '??';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOver(name: string) { return name.toLowerCase().startsWith('over'); }
function isUnder(name: string) { return name.toLowerCase().startsWith('under'); }

type BetFn = (p: {
    marketId: string; marketName: string; marketType?: string;
    selectionId: string; selectionName: string;
    odds: number; betType: 'back';
}) => void;

// ── Single full-width runner row (winner / coin toss / method markets) ────────
function FullWidthRow({
    runner, marketId, marketName, price, suspended, isPending, isDone, onBet,
}: {
    runner: SRRunner; marketId: string; marketName: string;
    price?: number; suspended?: boolean; isPending?: boolean; isDone?: boolean;
    onBet: BetFn;
}) {
    const hasPrice = price != null && price > 1 && !suspended && !isDone;
    return (
        <div
            className={`flex items-center justify-between px-4 py-3 border-t border-white/[0.035] transition-all group/r ${
                hasPrice ? 'bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer' : ''
            } ${runner.status !== 'Active' ? 'opacity-40' : ''}`}
            onClick={() => hasPrice && price && onBet({ marketId, marketName, selectionId: runner.runnerId, selectionName: runner.runnerName, odds: price, betType: 'back' })}
        >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-[9px] font-black text-white/35 flex-shrink-0 uppercase">
                    {runner.runnerName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('')}
                </div>
                <span className="text-[13px] font-semibold text-white break-words line-clamp-2">{runner.runnerName}</span>
            </div>
            <div className={`flex-shrink-0 ml-3 px-4 py-2 rounded-xl border font-black text-[14px] tabular-nums min-w-[64px] text-center transition-all ${
                suspended ? 'bg-white/[0.03] border-white/[0.06] text-white/20'
                    : hasPrice ? 'bg-brand-alpha-20 border-brand-gold/70 text-white shadow-[0_0_16px_rgba(91,183,255,0.45)] group-hover/r:bg-info-bright/35 group-hover/r:border-brand-gold group-hover/r:shadow-[0_0_20px_rgba(91,183,255,0.65)]'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/20'
            }`}>
                {isPending ? '...' : suspended ? '🔒' : (hasPrice ? price!.toFixed(2) : '-')}
            </div>
        </div>
    );
}

// ── Over/Under pair row (2 chips side by side on one line) ────────────────────
function OverUnderRow({
    over, under, marketId, marketName, overPrice, underPrice,
    suspended, isPendingFn, isDone, onBet,
}: {
    over: SRRunner; under: SRRunner;
    marketId: string; marketName: string;
    overPrice?: number; underPrice?: number;
    suspended?: boolean;
    isPendingFn: (sid: string) => boolean;
    isDone?: boolean;
    onBet: BetFn;
}) {
    const lineLabel = over.runnerName.replace(/^over\s*/i, '') || '';

    const chip = (runner: SRRunner, price: number | undefined, label: string, colorClass: string) => {
        const hasPrice = price != null && price > 1 && !suspended && !isDone;
        const isPending = isPendingFn(runner.runnerId);
        return (
            <div
                onClick={() => hasPrice && price && onBet({ marketId, marketName, selectionId: runner.runnerId, selectionName: runner.runnerName, odds: price, betType: 'back' })}
                className={`flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                    hasPrice
                        ? `${colorClass} cursor-pointer hover:brightness-125 active:scale-[0.98]`
                        : 'bg-white/[0.03] border-white/[0.05] opacity-50 cursor-not-allowed'
                }`}
            >
                <span className="text-[11px] font-bold text-white capitalize">{label}</span>
                <span className="text-[14px] font-black tabular-nums text-white ml-2 drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]">
                    {isPending ? '...' : suspended ? '🔒' : (price != null ? price.toFixed(2) : '-')}
                </span>
            </div>
        );
    };

    return (
        <div className="px-3 py-2 border-t border-white/[0.035] flex flex-col gap-1.5">
            {lineLabel && (
                <span className="text-[10px] font-bold text-white/25 uppercase tracking-wider px-1">{lineLabel}</span>
            )}
            <div className="flex gap-2">
                {chip(over, overPrice, 'Over', 'bg-success-alpha-20 border-success-alpha-40 shadow-[0_0_12px_rgba(34,197,94,0.30)] hover:bg-success-alpha-40 hover:border-emerald-300/70 hover:shadow-[0_0_16px_rgba(34,197,94,0.55)]')}
                {chip(under, underPrice, 'Under', 'bg-danger-alpha-25 border-danger-alpha-40 shadow-[0_0_12px_rgba(226,76,76,0.30)] hover:bg-danger-alpha-40 hover:border-rose-300/70 hover:shadow-[0_0_16px_rgba(226,76,76,0.55)]')}
            </div>
        </div>
    );
}

// ── Compact grid chip (run range etc.) ───────────────────────────────────────
function GridChip({ runner, price, suspended, isDone, isPending, onBet, marketId, marketName }: {
    runner: SRRunner; price?: number; suspended?: boolean; isDone?: boolean;
    isPending?: boolean; onBet: BetFn; marketId: string; marketName: string;
}) {
    const hasPrice = price != null && price > 1 && !suspended && !isDone;
    return (
        <div
            onClick={() => hasPrice && price && onBet({ marketId, marketName, selectionId: runner.runnerId, selectionName: runner.runnerName, odds: price, betType: 'back' })}
            className={`flex flex-col items-center gap-1 py-3 px-2.5 rounded-xl border transition-all ${
                hasPrice ? 'bg-brand-alpha-20 border-brand-gold/70 shadow-[0_0_16px_rgba(91,183,255,0.45)] cursor-pointer hover:bg-info-bright/35 hover:border-brand-gold hover:shadow-[0_0_20px_rgba(91,183,255,0.65)]' : 'bg-white/[0.03] border-white/[0.05] opacity-40 cursor-not-allowed'
            }`}
        >
            <span className="text-[10px] font-semibold text-white text-center leading-tight break-words">{runner.runnerName}</span>
            <span className="text-[13px] font-black text-white tabular-nums drop-shadow-[0_0_6px_rgba(91,183,255,0.6)]">{isPending ? '...' : price != null ? price.toFixed(2) : '-'}</span>
        </div>
    );
}

// ─── Market Accordion ─────────────────────────────────────────────────────────

function MarketAccordion({
    market,
    liveMarket,
    onBet,
    isDone,
    pending,
}: {
    market: SRMarket;
    liveMarket?: any;
    onBet: BetFn;
    isDone?: boolean;
    pending: (marketId: string, selectionId: string) => boolean;
}) {
    const [open, setOpen] = useState(true);
    const isSuspended = market.status !== 'Active' || liveMarket?.suspended;

    // Helper to get live-overlaid price for a runner
    const priceFor = (runner: SRRunner): number | undefined =>
        liveMarket?.runners?.get(runner.runnerId)?.backOdds ?? runner.backPrices?.[0]?.price;

    // Inject marketType so the betslip pricing engine uses stake × odds (decimal)
    // instead of the Indian Fancy/Session rate-based formula.
    const onBetWithType: BetFn = (p) => onBet({ ...p, marketType: market.marketType });

    // --- Determine layout -------------------------------------------------------
    // Over/under: all runners either start with "over" or "under"
    const allOverUnder = market.runners.length > 0 && market.runners.every(
        r => isOver(r.runnerName) || isUnder(r.runnerName)
    );

    // Run-range style: more than 4 runners, none match over/under pattern
    const isGrid = !allOverUnder && market.runners.length > 4;

    // Pair over/under runners by their line value
    const overUnderPairs: Array<{ over: SRRunner; under: SRRunner }> = [];
    if (allOverUnder) {
        const overRunners = market.runners.filter(r => isOver(r.runnerName));
        const underRunners = market.runners.filter(r => isUnder(r.runnerName));
        // Match by suffix value
        overRunners.forEach(o => {
            const lineVal = o.runnerName.replace(/^over\s*/i, '').trim();
            const u = underRunners.find(u => u.runnerName.replace(/^under\s*/i, '').trim() === lineVal);
            if (u) overUnderPairs.push({ over: o, under: u });
        });
    }

    return (
        <div className="bg-bg-modal rounded-2xl border border-white/[0.06] overflow-hidden mb-3">
            {/* Header */}
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex min-w-0 flex-1 items-start gap-2 pr-3 text-left">
                    <span className="text-[12px] font-bold leading-tight text-white break-words">
                        {market.marketName}
                    </span>
                    {isSuspended && (
                        <span className="flex-shrink-0 text-[9px] font-black text-white/40 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <Lock size={7} /> SUSP
                        </span>
                    )}
                    {market.limits && (
                        <span className="flex-shrink-0 text-[9px] text-white/25 font-medium ml-auto pr-2">
                            {market.limits.currency} {market.limits.minBetValue.toLocaleString()}–{market.limits.maxBetValue.toLocaleString()}
                        </span>
                    )}
                </div>
                {open
                    ? <ChevronUp size={14} className="text-white/30 flex-shrink-0" />
                    : <ChevronDown size={14} className="text-white/30 flex-shrink-0" />}
            </button>

            {open && (
                <div className="border-t border-white/[0.04]">
                    {/* ── Over/Under pairs ────────────────────────────────── */}
                    {allOverUnder && overUnderPairs.length > 0 && (
                        <div className="pb-2">
                            {overUnderPairs.map(({ over, under }) => (
                                <OverUnderRow
                                    key={over.runnerId}
                                    over={over} under={under}
                                    marketId={market.marketId} marketName={market.marketName}
                                    overPrice={priceFor(over)} underPrice={priceFor(under)}
                                    suspended={isSuspended} isDone={isDone}
                                    isPendingFn={(sid) => pending(market.marketId, sid)}
                                    onBet={onBetWithType}
                                />
                            ))}
                        </div>
                    )}

                    {/* ── Grid (run range, method, etc.) ──────────────────── */}
                    {isGrid && (
                        <div className="px-3 py-3 grid grid-cols-3 gap-2">
                            {market.runners.map(runner => (
                                <GridChip
                                    key={runner.runnerId}
                                    runner={runner}
                                    price={priceFor(runner)}
                                    suspended={isSuspended}
                                    isDone={isDone}
                                    isPending={pending(market.marketId, runner.runnerId)}
                                    onBet={onBetWithType}
                                    marketId={market.marketId}
                                    marketName={market.marketName}
                                />
                            ))}
                        </div>
                    )}

                    {/* ── Full-width rows (winner, coin toss, 2-runner, etc.) ─ */}
                    {!allOverUnder && !isGrid && market.runners.map(runner => (
                        <FullWidthRow
                            key={runner.runnerId}
                            runner={runner}
                            marketId={market.marketId} marketName={market.marketName}
                            price={priceFor(runner)}
                            suspended={isSuspended} isDone={isDone}
                            isPending={pending(market.marketId, runner.runnerId)}
                            onBet={onBetWithType}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}



// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SRMatchDetailPage() {
    const params = useParams();
    const router = useRouter();
    const matchId = params.matchId as string;

    const [match, setMatch] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [liveMarkets, setLiveMarkets] = useState<Map<string, any>>(new Map());
    const [activeTab, setActiveTab] = useState<'matchOdds' | 'bookmakers' | 'fancy' | 'premium'>('matchOdds');
    const [activeSidebarTab, setActiveSidebarTab] = useState<'live' | 'line'>('line');

    const [showTracker, setShowTracker] = useState(false);
    const [scoreUrl, setScoreUrl] = useState<string | null>(null);
    const [loadingTracker, setLoadingTracker] = useState(false);

    const { addBet, placeSingleBet, oneClickEnabled, oneClickStake, isOneClickPending } = useBets();
    const { socket, connectionStatus, joinMatchRoom, leaveMatchRoom } = useSocket();
    const previousConnectionStatusRef = useRef<string>('disconnected');
    const hasConnectedOnceRef = useRef(false);
    const { user, isAuthenticated } = useAuth();
    const earlySixIds = useEarlySixMatches();
    const hasEarlySix = earlySixIds.has(matchId);
    const sportIdRef = useRef<string | null>(null);

    const toggleTracker = async () => {
        if (!showTracker && !scoreUrl && !loadingTracker) {
            setLoadingTracker(true);
            try {
                const url = await sportsApi.getScoreUrl(String((match as any)?.sport_id || sportIdRef.current || '4'), matchId);
                if (url) setScoreUrl(url);
            } catch (e) { }
            setLoadingTracker(false);
        }
        setShowTracker(!showTracker);
    };

    // ── Fetch ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!matchId) return;
        const load = async () => {
            try {
                const data = await sportsApi.getMatchDetails(matchId);
                setMatch(data);
                sportIdRef.current = String((data as any).sport_id || '');
            } catch (e) { /* silent */ } finally { setLoading(false); }
        };
        load();

    }, [matchId, user?.id]);

    // ── Socket join/leave ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!matchId) return;
        joinMatchRoom(matchId);
        return () => { leaveMatchRoom(matchId); };
    }, [joinMatchRoom, leaveMatchRoom, matchId]);

    useEffect(() => {
        if (!socket || !matchId || connectionStatus !== 'connected') return;

        socket.emit('match-heartbeat', matchId);
        const heartbeat = window.setInterval(() => {
            socket.emit('match-heartbeat', matchId);
        }, 10_000);

        return () => {
            window.clearInterval(heartbeat);
        };
    }, [connectionStatus, matchId, socket]);

    useEffect(() => {
        const previousStatus = previousConnectionStatusRef.current;

        if (
            hasConnectedOnceRef.current &&
            matchId &&
            connectionStatus === 'connected' &&
            (previousStatus === 'reconnecting' || previousStatus === 'disconnected')
        ) {
            setLoading(true);
            sportsApi.getMatchDetails(matchId)
                .then((data) => {
                    setMatch(data);
                    sportIdRef.current = String((data as any).sport_id || '');
                })
                .catch(() => undefined)
                .finally(() => setLoading(false));
        }

        if (connectionStatus === 'connected') {
            hasConnectedOnceRef.current = true;
        }

        previousConnectionStatusRef.current = connectionStatus;
    }, [connectionStatus, matchId]);

    // ── Socket live-odds listener ─────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;
        const handle = (data: any) => {
            if (!data) return;

            // ── Handle market_status message (suspension toggle) ──────────
            if (data.messageType === 'market_status' && data.id) {
                setLiveMarkets(prev => {
                    const next = new Map(prev);
                    const mid = String(data.id);
                    const existing = next.get(mid) || { runners: new Map(), suspended: false };
                    next.set(mid, { ...existing, suspended: data.ms === 4 });
                    return next;
                });
                return;
            }

            // ── Handle odds updates (both legacy and sportradar format) ──
            const isOddsMsg =
                data.messageType === 'odds' ||
                data.messageType === 'match_odds' ||
                data.messageType === 'sportradar_odds';
            if (!isOddsMsg || !Array.isArray(data.data)) return;

            // For sportradar_odds, only process if eventId matches this match
            if (data.messageType === 'sportradar_odds' && data.eventId !== matchId) return;

            setLiveMarkets(prev => {
                const next = new Map(prev);
                const getM = (mid: string) => {
                    if (!next.has(mid)) next.set(mid, { runners: new Map(), suspended: false });
                    return next.get(mid)!;
                };

                data.data.forEach((u: any) => {
                    const mid = String(u.bmi || u.mid || '');
                    if (!mid) return;
                    const m = getM(mid);

                    // Update suspension status from ms field
                    if (u.ms !== undefined) m.suspended = u.ms === 4;

                    if (Array.isArray(u.rt)) {
                        u.rt.forEach((r: any) => {
                            const rid = String(r.ri ?? '');
                            if (!rid) return;
                            const ex = m.runners.get(rid) || {};
                            if (r.ib) m.runners.set(rid, { ...ex, backOdds: r.rt, backSize: r.bv });
                            else m.runners.set(rid, { ...ex, layOdds: r.rt, laySize: r.bv });
                        });
                    }

                    // Also handle SR-native runners array for full refresh
                    if (Array.isArray(u.runners)) {
                        u.runners.forEach((r: any) => {
                            const rid = String(r.runnerId ?? '');
                            if (!rid) return;
                            const backPrice = r.backPrices?.[0]?.price;
                            const layPrice = r.layPrices?.[0]?.price;
                            const ex = m.runners.get(rid) || {};
                            m.runners.set(rid, {
                                ...ex,
                                ...(backPrice != null ? { backOdds: backPrice, backSize: r.backPrices[0]?.size } : {}),
                                ...(layPrice != null ? { layOdds: layPrice, laySize: r.layPrices[0]?.size } : {}),
                            });
                        });
                    }
                });
                return next;
            });
        };
        socket.on('socket-data', handle);
        return () => { socket.off('socket-data', handle); };
    }, [socket, matchId]);

    // ── Bet handler ───────────────────────────────────────────────────────────
    const handleBet = async (p: {
        marketId: string; marketName: string; marketType?: string;
        selectionId: string; selectionName: string;
        odds: number; betType: 'back';
    }) => {
        if (!match) return;
        const bet = {
            eventId: match.event_id,
            eventName: match.event_name,
            provider: 'sportradar',
            srSportId: String((match as any)?.sport_id || sportIdRef.current || ''),
            srMarketFullId: p.marketId,
            srRunnerId: p.selectionId,
            srRunnerName: p.selectionName,
            srMarketName: p.marketName,
            ...p,
        };
        if (!oneClickEnabled) { addBet(bet); return; }
        try {
            await placeSingleBet(bet);
            showBetPlacedToast({ selectionName: p.selectionName, stake: oneClickStake });
        } catch (e: any) {
            if (e?.message !== 'Login required') showBetErrorToast(e);
        }
    };

    // ─── Derived state ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex bg-bg-zeero min-h-screen">
                <div className="flex-1 pt-[84px] flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-success-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <RightSidebar />
            </div>
        );
    }

    if (!match) {
        return (
            <div className="flex bg-bg-zeero min-h-screen">
                <div className="flex-1 pt-[84px] flex flex-col items-center justify-center gap-4">
                    <Shield size={48} className="text-white/20" />
                    <h2 className="text-lg font-bold text-white">Match Not Found</h2>
                    <button onClick={() => router.back()} className="px-4 py-2 bg-white/[0.04] text-white rounded-xl">Go Back</button>
                </div>
                <RightSidebar />
            </div>
        );
    }

    // Build SR markets from stored event data
    const rawMarkets: SRMarkets = (match as any).sr_markets || {};
    const matchOddsMarkets = rawMarkets.matchOdds || [];
    const bookmakersMarkets = rawMarkets.bookmakers || [];
    const fancyMarketsMarkets = rawMarkets.fancyMarkets || [];
    const premiumMarketsMarkets = rawMarkets.premiumMarkets || [];

    // Fallback: convert normalised markets to SR market shape
    const normalizedToSR = (match.markets || []).map((m: any) => ({
        marketId: m.market_id,
        marketName: m.market_name,
        marketType: m.gtype || 'MATCH_ODDS',
        status: m.is_active ? 'Active' : 'Suspended',
        runners: (m.runners_data || []).map((r: any, i: number) => ({
            runnerId: String(r.sid ?? r.id ?? i),
            runnerName: r.nat || r.name || `Runner ${i + 1}`,
            status: 'Active',
            backPrices: r.odds?.filter((o: any) => o.otype === 'back').map((o: any) => ({ price: o.odds, size: o.size ?? 0 })) || [],
            layPrices: r.odds?.filter((o: any) => o.otype === 'lay').map((o: any) => ({ price: o.odds, size: o.size ?? 0 })) || [],
        })),
    } as SRMarket));

    const activeMatchOdds = matchOddsMarkets.length > 0 ? matchOddsMarkets : normalizedToSR;

    const isLive =
        match.match_status === 'Live' || match.match_status === 'In Play' ||
        (match as any).in_play || (match as any).status === 'IN_PLAY';
    const isVirtual = (match as any).catId === 'SR VIRTUAL';
    const isCompleted = match.match_status === 'Completed';

    const homeTeam = match.home_team || match.event_name?.split(' vs. ')[0]?.trim() || '';
    const awayTeam = match.away_team || match.event_name?.split(' vs. ')[1]?.trim() || '';
    const compName = (match as any).competition_name || match.competition?.competition_name || '';
    const homeScore = (match as any).homeScore ?? match.score1;
    const awayScore = (match as any).awayScore ?? match.score2;

    const TABS = [
        { key: 'matchOdds', label: 'Match Odds', count: activeMatchOdds.length },
        { key: 'bookmakers', label: 'Bookmakers', count: bookmakersMarkets.length },
        { key: 'fancy', label: 'Fancy', count: fancyMarketsMarkets.length },
        { key: 'premium', label: 'Premium', count: premiumMarketsMarkets.length },
    ].filter(t => t.count > 0);

    const marketsForTab: SRMarket[] =
        activeTab === 'matchOdds' ? activeMatchOdds
        : activeTab === 'bookmakers' ? bookmakersMarkets
        : activeTab === 'fancy' ? fancyMarketsMarkets
        : premiumMarketsMarkets;

    return (
        <div className="h-screen overflow-hidden bg-bg-zeero text-white flex flex-col">
            <Header />
            <div className="flex flex-1 overflow-hidden">
                <LeftSidebar
                    selectedSportId={String((match as any).sport_id || '')}
                    onSelectSport={() => router.push('/sports')}
                    activeTab={activeSidebarTab}
                    onTabChange={setActiveSidebarTab}
                />

                <main className="flex-1 pt-[60px] md:pt-[64px] md:pt-[84px] pb-24 xl:mr-[64px] overflow-y-auto overflow-x-hidden">
                    {/* ── Hero Card ─────────────────────────────────────────── */}
                    <div className="md:mx-4 md:mt-4 mb-3">
                        <div className={`relative overflow-hidden rounded-none md:rounded-2xl border ${
                            isLive ? 'border-success-primary/20 bg-gradient-to-b from-success-soft to-bg-zeero'
                            : isVirtual ? 'border-accent-purple/20 bg-gradient-to-b from-accent-purple-soft to-bg-zeero'
                            : 'border-white/[0.06] bg-bg-modal'
                        }`}>

                            {/* Live glow layer */}
                            {isLive && <div className="absolute inset-0 bg-success-primary/5 pointer-events-none" />}
                            {isVirtual && <div className="absolute inset-0 bg-violet-500/[0.03] pointer-events-none" />}

                            {/* Top stripe */}
                            {isLive && <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-success-primary/70 to-transparent" />}
                            {isVirtual && <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />}

                            {/* Breadcrumb bar */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] relative z-10">
                                <button
                                    onClick={() => router.back()}
                                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-xs font-semibold"
                                >
                                    <ChevronLeft size={16} />
                                    <Shield size={10} className={isVirtual ? 'text-accent-purple/60' : 'text-success-bright/50'} />
                                    <span className="truncate max-w-[200px]">{compName}</span>
                                </button>

                                <div className="flex items-center gap-2">
                                    {hasEarlySix && (
                                        <span className="hidden md:flex items-center gap-1 bg-gradient-to-r from-accent-purple to-info-primary border border-accent-purple/30 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-lg">
                                            🎯 Early 6 Refund
                                        </span>
                                    )}
                                    {isLive && (
                                        <div className="flex items-center gap-1 bg-success-alpha-10 border border-success-primary/20 px-2.5 py-1 rounded-lg">
                                            <div className="w-1.5 h-1.5 rounded-full bg-success-primary animate-pulse" />
                                            <span className="text-success-bright text-[10px] font-black">LIVE</span>
                                        </div>
                                    )}
                                    {isVirtual && (
                                        <div className="flex items-center gap-1 bg-accent-purple-alpha border border-accent-purple/20 px-2.5 py-1 rounded-lg">
                                            <Zap size={9} className="text-accent-purple" />
                                            <span className="text-accent-purple text-[10px] font-black">VIRTUAL</span>
                                        </div>
                                    )}
                                    {!isLive && !isVirtual && (
                                        <div className="flex items-center gap-1.5 text-white/30 text-[10px]">
                                            <Clock size={10} />
                                            <span>{formatDate((match as any).openDate || match.open_date)}</span>
                                        </div>
                                    )}
                                    {isCompleted && (
                                        <span className="bg-white/[0.04] border border-white/[0.06] text-white/40 text-[10px] font-bold px-2 py-0.5 rounded">
                                            ENDED
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Teams Hero */}
                            <div className="px-6 py-8 flex items-center justify-between relative z-10 gap-2">
                                {/* Home */}
                                <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
                                    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 flex items-center justify-center text-xl font-black flex-shrink-0 ${
                                        isLive ? 'bg-success-alpha-10 border-success-primary/25 text-success-bright' : 'bg-white/[0.05] border-white/[0.08] text-white/50'
                                    }`}>
                                        {getInitials(homeTeam)}
                                    </div>
                                    <h2 className="text-sm md:text-base font-bold text-white text-center leading-tight truncate w-full">{homeTeam}</h2>
                                </div>

                                {/* Score / VS */}
                                <div className="flex flex-col items-center gap-2 px-1 md:px-4 flex-shrink-0">
                                    {isAuthenticated ? (
                                        (isLive || isCompleted) && (homeScore != null || awayScore != null) ? (
                                            <div className={`text-3xl md:text-5xl font-black tabular-nums tracking-widest font-mono whitespace-nowrap ${isLive ? 'text-success-bright' : 'text-white/50'}`}>
                                                {homeScore ?? 0}<span className="text-white/20 mx-1 md:mx-2">–</span>{awayScore ?? 0}
                                            </div>
                                        ) : (
                                            <span className="text-3xl md:text-4xl font-black text-white/10 tracking-widest">VS</span>
                                        )
                                    ) : (
                                        <div className="flex items-center gap-2 rounded-2xl bg-bg-zeero/80 px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.4)] border border-white/[0.04] backdrop-blur-md">
                                            <Lock size={12} className="text-white/50" />
                                            <span className="text-[12px] font-adx-bold text-text-muted select-none">Login to view score</span>
                                        </div>
                                    )}
                                    <div className={`text-[10px] font-black uppercase tracking-wider ${
                                        isLive ? 'text-success-bright' : isCompleted ? 'text-white/30' : 'text-white/20'
                                    }`}>
                                        {isCompleted ? 'Full Time' : isLive ? 'In Progress' : 'Starting Soon'}
                                    </div>
                                    {hasEarlySix && (
                                        <div className="md:hidden bg-gradient-to-r from-accent-purple to-info-primary border border-accent-purple/30 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-lg uppercase">
                                            🎯 Early 6
                                        </div>
                                    )}
                                    <button
                                        onClick={toggleTracker}
                                        className="mt-1 md:mt-2 text-[10px] font-bold uppercase tracking-wider bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                                    >
                                        <Activity size={12} className={showTracker ? 'text-success-bright' : 'text-white/40'} />
                                        {showTracker ? 'Hide Tracker' : 'Live Tracker'}
                                    </button>
                                </div>

                                {/* Away */}
                                <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
                                    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 flex items-center justify-center text-xl font-black flex-shrink-0 ${
                                        isLive ? 'bg-success-alpha-10 border-success-primary/25 text-success-bright' : 'bg-white/[0.05] border-white/[0.08] text-white/50'
                                    }`}>
                                        {getInitials(awayTeam)}
                                    </div>
                                    <h2 className="text-sm md:text-base font-bold text-white text-center leading-tight truncate w-full">{awayTeam}</h2>
                                </div>
                            </div>
                            
                            {/* Tracker Wrapper */}
                            {showTracker && (
                                <div className="w-full bg-black/40 border-t border-white/[0.05] overflow-hidden">
                                    {loadingTracker ? (
                                        <div className="flex flex-col items-center justify-center h-[280px] md:h-[350px] gap-3">
                                            <div className="w-6 h-6 border-2 border-success-primary border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Loading Scoreboard</span>
                                        </div>
                                    ) : scoreUrl ? (
                                        <iframe 
                                            src={scoreUrl}
                                            className="w-full h-[320px] md:h-[400px] border-none"
                                            title="Live Match Tracker"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-[200px] text-xs font-medium text-white/30 uppercase tracking-wider">
                                            Tracker unavailable for this match
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* One-click controls */}
                            <div className="px-4 pb-4 md:pt-4 border-t border-white/[0.02] relative z-10 pt-3">
                                <OneClickBetControls />
                            </div>
                        </div>
                    </div>

                    {/* ── Market Tabs ────────────────────────────────────────── */}
                    {TABS.length > 1 && (
                        <div className="flex gap-0 overflow-x-auto scrollbar-hide border-b border-white/[0.05] mb-0 px-4 md:px-8">
                            {TABS.map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => setActiveTab(t.key as any)}
                                    className={`py-3 px-4 text-[11px] font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition-colors ${
                                        activeTab === t.key
                                            ? 'border-success-primary text-success-bright'
                                            : 'border-transparent text-white/30 hover:text-white/60'
                                    }`}
                                >
                                    {t.label}
                                    <span className="ml-1.5 text-[9px] opacity-60">({t.count})</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Markets List ──────────────────────────────────────── */}
                    <div className="px-3 md:px-4 py-4 space-y-0">
                        {marketsForTab.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <Activity size={32} className="text-white/15" />
                                <p className="text-white/30 text-sm font-semibold">Markets not yet available</p>
                                <p className="text-white/20 text-xs">Odds will appear closer to match time</p>
                            </div>
                        ) : (
                            marketsForTab.map(market => (
                                <MarketAccordion
                                    key={market.marketId}
                                    market={market}
                                    liveMarket={liveMarkets.get(market.marketId)}
                                    onBet={handleBet}
                                    isDone={isCompleted}
                                    pending={(mid, sid) => isOneClickPending(match.event_id, mid, sid)}
                                />
                            ))
                        )}
                    </div>
                </main>

                <RightSidebar />
                <GamesRail />
            </div>
        </div>
    );
}
