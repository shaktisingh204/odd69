'use client';

import CategoryGrid from './CategoryGrid';
import HomeGameList from './HomeGameList';
import PromoCardSlider from './PromoCardSlider';
import RecentWinsTicker from './RecentWinsTicker';
import LiveEventCard from '@/components/sports/LiveEventCard';
import type { LiveEvent } from '@/components/sports/types';
import { resolveTeamAvatar } from '@/components/sports/teamIconHelpers';
import SkeletonGameRow from '@/components/shared/SkeletonGameRow';
import DynamicHeroSlider from '@/components/shared/DynamicHeroSlider';
import dynamic from 'next/dynamic';

// Heavy below-fold sections — code-split out of the initial bundle.
// ZeeroOriginalsSection imports ~20 lucide icons + game cards; it's a
// full section that renders well below the hero. GamePlayInterface is
// an overlay that only appears when a user clicks "play", and it
// imports the casino game launcher machinery which is ~80 KiB on its
// own. Both are loaded lazily to shrink the home page's JS entry.
const ZeeroOriginalsSection = dynamic(
    () => import('./ZeeroOriginalsSection'),
    { ssr: false },
);
const GamePlayInterface = dynamic(
    () => import('@/components/casino/GamePlayInterface'),
    { ssr: false },
);

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Flame, Star, Zap, Trophy, ArrowRight, Gift,
    ChevronRight
} from 'lucide-react';
import { sportsApi, Event } from '@/services/sports';
import { casinoService } from '@/services/casino';
import api from '@/services/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SiTelegram } from 'react-icons/si';

/** Convert home Event → LiveEvent for LiveEventCard */
function eventToLiveEvent(ev: Event, teamIcons: Record<string, string>): LiveEvent {
    const homeTeam = ev.home_team || ev.event_name?.split(' v ')[0] || ev.event_name || '';
    const awayTeam = ev.away_team || ev.event_name?.split(' v ')[1] || '';
    const isLive = ev.match_status === 'In Play' || ev.match_status === 'Live';
    const isInPlay = ev.match_status === 'In Play';
    const country = ev.competition?.country_code;
    const sportName = ev.competition?.sport?.sport_name || '';

    const homeAvatar = resolveTeamAvatar(homeTeam, teamIcons, country);
    const awayAvatar = resolveTeamAvatar(awayTeam, teamIcons, country);

    const odds: { label: string; value: string }[] = [];
    if ((ev as any).match_odds?.length) {
        (ev as any).match_odds.forEach((o: any, i: number) => {
            if (!o.back) return;
            const total = (ev as any).match_odds.length;
            let label = o.name || '';
            if (total === 3 && i === 0) label = '1';
            else if (total === 3 && i === 1) label = 'X';
            else if (total === 3 && i === 2) label = '2';
            else if (total === 2 && i === 0) label = '1';
            else if (total === 2 && i === 1) label = '2';
            odds.push({ label, value: String(o.back) });
        });
    }

    const statusStr = isLive ? (isInPlay ? 'IN PLAY' : 'LIVE') : (ev.match_status || 'Upcoming');

    return {
        matchId: ev.event_id,
        competition: (ev as any).competition_name || ev.competition?.competition_name || '',
        sport: sportName,
        isInPlay,
        isLive,
        status: statusStr,
        hasTv: false,
        teams: [
            { name: homeTeam, detail: ev.score1 || '', pill: ev.score1 || '', ...homeAvatar },
            { name: awayTeam, detail: ev.score2 || '', pill: ev.score2 || '', ...awayAvatar },
        ],
        odds,
        extra: '',
        thumbnail: (ev as any).thumbnail || undefined,
        team1Image: (ev as any).team1Image || undefined,
        team2Image: (ev as any).team2Image || undefined,
        country: country || undefined,
    };
}

import type { SliderConfig } from '@/lib/siteConfig';

interface PremiumHomeContentProps {
    selectedSportId?: string | null;
    /** SSR-fetched hero slider config — passed through to
     *  DynamicHeroSlider so it can SSR the first slide instead of
     *  showing a loading spinner until client fetch completes. */
    initialSliderConfig?: SliderConfig | null;
}

/** Parse CSS gradient string → 2-stop gradient for inline style */
function gradientToCss(g?: string) {
    return g || 'linear-gradient(135deg, #7c3aed, #4c1d95)';
}

export default function PremiumHomeContent({
    selectedSportId,
    initialSliderConfig,
}: PremiumHomeContentProps = {}) {
    const router = useRouter();
    const [liveEvents, setLiveEvents] = useState<Event[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [teamIcons, setTeamIcons] = useState<Record<string, string>>({});
    const [activeGame, setActiveGame] = useState<{
        id: string; name: string; provider: string; url: string;
    } | null>(null);

    const [slotGames, setSlotGames] = useState<any[]>([]);
    const [liveGames, setLiveGames] = useState<any[]>([]);
    const [newGames, setNewGames] = useState<any[]>([]);
    const [tableGames, setTableGames] = useState<any[]>([]);
    const [crashGames, setCrashGames] = useState<any[]>([]);
    const [gamesLoading, setGamesLoading] = useState(true);

    // DB-driven promotions (from /promotions/app-home)
    const [dbPromos, setDbPromos] = useState<any[]>([]);

    // Telegram from contact settings
    const [telegramLink, setTelegramLink] = useState('');

    // ── Fetch live/upcoming sports events ──────────────────────────────
    // Uses Sportradar API (Redis-backed) so events match what the sports page shows.
    useEffect(() => {
        const fetchLive = async () => {
            try {
                let data: Event[] = [];
                try {
                    const homeEvts = await sportsApi.getHomeEvents();
                    if (homeEvts && homeEvts.length > 0) {
                        const homeIds = new Set(homeEvts.map((t: any) => String(t.event_id)));

                        // Fetch from Sportradar endpoints (Redis) — same source as the sports page
                        const [inplayRes, upcomingRes] = await Promise.all([
                            api.get('/sports/sportradar/inplay').catch(() => ({ data: { data: [] } })),
                            api.get('/sports/sportradar/upcoming').catch(() => ({ data: { data: [] } })),
                        ]);
                        const inplayRaw: any[] = Array.isArray(inplayRes.data?.data) ? inplayRes.data.data : [];
                        const upcomingRaw: any[] = Array.isArray(upcomingRes.data?.data) ? upcomingRes.data.data : [];

                        // Map Sportradar format → Event format for card rendering
                        const mapSrToEvent = (ev: any): Event => {
                            const vsSplit = (ev.eventName || '').split(/ vs\.? /i);
                            const matchOdds: any[] = [];
                            const market = ev.markets?.matchOdds?.[0] ?? ev.markets?.premiumMarkets?.[0];
                            if (market?.runners) {
                                for (const r of market.runners) {
                                    const price = r.backPrices?.[0]?.price;
                                    if (price) matchOdds.push({ name: r.runnerName, back: price });
                                }
                            }
                            return {
                                event_id: ev.eventId,
                                event_name: ev.eventName || '',
                                open_date: ev.openDate ? new Date(ev.openDate).toISOString() : '',
                                match_status: ev.status === 'LIVE' || ev.status === 'IN_PLAY' ? 'In Play' : (ev.status === 'CLOSED' ? 'Completed' : 'Pending'),
                                home_team: vsSplit[0]?.trim() || '',
                                away_team: vsSplit[1]?.trim() || '',
                                score1: ev.homeScore > 0 ? String(ev.homeScore) : undefined,
                                score2: ev.awayScore > 0 ? String(ev.awayScore) : undefined,
                                markets: [],
                                match_odds: matchOdds,
                                competition_name: ev.competitionName || '',
                                competition: {
                                    competition_id: ev.competitionId || '',
                                    competition_name: ev.competitionName || '',
                                    country_code: ev.country || '',
                                    sport: {
                                        sport_id: ev.sportId || '',
                                        sport_name: ev.sportName || '',
                                    },
                                },
                                thumbnail: ev.thumbnail || '',
                                team1Image: ev.team1Image || '',
                                team2Image: ev.team2Image || '',
                            } as any;
                        };

                        const allSr = [...inplayRaw, ...upcomingRaw];
                        const deduped = [...new Map(allSr.map(e => [e.eventId, e])).values()];
                        data = deduped
                            .filter(e => homeIds.has(String(e.eventId)))
                            .map(mapSrToEvent);
                    }
                } catch {
                    // Fail silently
                }
                if (data && Array.isArray(data)) setLiveEvents(data);
            } catch (e) {
                console.error('Failed to load live events', e);
            } finally {
                setEventsLoading(false);
            }
        };

        fetchLive();
        const interval = setInterval(fetchLive, 30000);
        // Fetch team icons once
        sportsApi.getTeamIcons().then(setTeamIcons).catch(() => {});
        return () => clearInterval(interval);
    }, [selectedSportId]);

    // Convert events to LiveEvent format for the card UI
    const liveEventCards = useMemo(
        () => liveEvents.slice(0, 18).map(ev => eventToLiveEvent(ev, teamIcons)),
        [liveEvents, teamIcons],
    );

    const goToMatch = useCallback((matchId: string) => {
        router.push(`/sports/match/${matchId}`);
    }, [router]);

    // ── Fetch all game categories + DB promotions + telegram ──────────
    //
    // Every entry here renders below the fold on initial paint. Scheduling
    // them via requestIdleCallback lets the hero + category grid finish
    // painting (LCP) before the browser spends cycles parsing ~60 game
    // objects + 2 more API responses. On devices without
    // requestIdleCallback (Safari < 17) we fall back to a short
    // setTimeout so the work still runs after the current render frame.
    useEffect(() => {
        let cancelled = false;

        const fetchAll = async () => {
            if (cancelled) return;
            setGamesLoading(true);
            try {
                const [slotsRes, liveRes, newRes, tableRes, crashRes] = await Promise.all([
                    casinoService.getGames(undefined, 'slots', undefined, 1, 12),
                    casinoService.getGames(undefined, 'live', undefined, 1, 12),
                    casinoService.getGames(undefined, 'new', undefined, 1, 12),
                    casinoService.getGames(undefined, 'table', undefined, 1, 12),
                    casinoService.getGames(undefined, 'crash', undefined, 1, 12),
                ]);
                if (cancelled) return;
                if (slotsRes.games) setSlotGames(slotsRes.games);
                if (liveRes.games) setLiveGames(liveRes.games);
                if (newRes.games) setNewGames(newRes.games);
                if (tableRes.games) setTableGames(tableRes.games);
                if (crashRes.games) setCrashGames(crashRes.games);
            } catch (e) {
                console.error('Failed to load home premium games', e);
            } finally {
                if (!cancelled) setGamesLoading(false);
            }

            // Fetch DB promotions for home
            try {
                const res = await api.get('/promotions/app-home');
                if (!cancelled && Array.isArray(res.data) && res.data.length > 0) {
                    setDbPromos(res.data);
                }
            } catch { /* silently ignore */ }

            // Fetch telegram link
            try {
                const res = await api.get('/contact-settings');
                if (!cancelled && res.data?.telegramChannelLink) {
                    setTelegramLink(res.data.telegramChannelLink);
                }
            } catch { /* silently ignore */ }
        };

        // Defer until after LCP so the hero + category grid render
        // without network / parse contention from these below-fold
        // fetches. 1500 ms is a hard ceiling so we don't starve the
        // content indefinitely on a perpetually-busy main thread.
        let idleHandle: number | null = null;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        const ric = (globalThis as any).requestIdleCallback as
            | ((cb: () => void, opts?: { timeout: number }) => number)
            | undefined;
        if (typeof ric === 'function') {
            idleHandle = ric(() => { fetchAll(); }, { timeout: 1500 });
        } else {
            // Safari fallback: let the current paint frame complete,
            // then run on the next macrotask.
            timeoutHandle = setTimeout(() => { fetchAll(); }, 0);
        }

        return () => {
            cancelled = true;
            const cic = (globalThis as any).cancelIdleCallback as
                | ((handle: number) => void)
                | undefined;
            if (idleHandle !== null && typeof cic === 'function') {
                cic(idleHandle);
            }
            if (timeoutHandle !== null) clearTimeout(timeoutHandle);
        };
    }, []);


    return (
        <div className="w-full max-w-[1600px] mx-auto px-0 py-2 md:p-6">

            {/* ── FULL-SCREEN GAME OVERLAY ── */}
            {activeGame && (
                <div className="fixed inset-0 z-[500] bg-bg-base flex flex-col p-2 md:p-3">
                    <GamePlayInterface
                        game={activeGame}
                        onClose={() => setActiveGame(null)}
                        isEmbedded={false}
                        onLaunch={(g) => setActiveGame(g)}
                    />
                </div>
            )}

            {/* ── 1. HERO PROMO SLIDER — admin controlled from CMS > Sliders ──
                initialConfig is supplied SSR so the slider renders the
                first slide in the initial HTML payload. Skips the client
                fetch + loading state that was the main LCP bottleneck. */}
            <section className="mt-0 md:mt-0 px-3 md:px-0 pt-2 md:pt-3 relative z-10">
                <DynamicHeroSlider
                    page="HOME"
                    className="w-full"
                    initialConfig={initialSliderConfig}
                    onGameLaunch={(g) => setActiveGame(g)}
                    fallback={<PromoCardSlider onGameLaunch={(g) => setActiveGame(g)} />}
                />
            </section>


            {/* ── 2. RECENT BIG WINS TICKER ── */}
            <section className="mt-1">
                <RecentWinsTicker />
            </section>

            {/* ── 3. CATEGORY GRID ── */}
            <section className="px-3 md:px-0 mt-3 md:mt-4">
                <CategoryGrid />
            </section>

            {/* ── 4. DB PROMOTIONS CAROUSEL (from admin → CMS → Promotions → Show on App Home) ── */}
            {dbPromos.length > 0 && (
                <section className="px-3 md:px-0 mt-5 md:mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
                                <Gift size={16} className="text-amber-400" fill="currentColor" />
                            </div>
                            <h2 className="text-lg md:text-xl font-extrabold text-white tracking-[-0.02em]">Promotions</h2>
                            <span className="text-[9px] font-bold text-white/25 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full">{dbPromos.length}</span>
                        </div>
                        <Link href="/promotions" className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/80 transition-colors bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] px-3.5 py-1.5 rounded-full">
                            All <ArrowRight size={10} />
                        </Link>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                        {dbPromos.map(promo => (
                            <Link
                                key={promo._id}
                                href={promo.buttonLink || '/promotions'}
                                className="flex-shrink-0 relative rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.15] transition-all hover:scale-[1.02] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] group"
                                style={{ background: gradientToCss(promo.gradient), width: 280, minHeight: 160 }}
                            >
                                {promo.bgImage && (
                                    <img
                                        src={promo.bgImage}
                                        alt={promo.title}
                                        loading="lazy"
                                        decoding="async"
                                        className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-overlay"
                                    />
                                )}
                                {/* glow */}
                                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/[0.06] pointer-events-none" />
                                <div className="relative z-10 p-5 flex flex-col gap-1 max-w-[65%]">
                                    {(promo.badgeLabel || promo.category) && (
                                        <span className="self-start bg-black/30 text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md mb-1">
                                            {promo.badgeLabel || promo.category}
                                        </span>
                                    )}
                                    {promo.bonusPercentage > 0 && (
                                        <span className="text-3xl font-black text-white leading-none">+{promo.bonusPercentage}%</span>
                                    )}
                                    <p className="text-white font-black text-base leading-tight">{promo.title}</p>
                                    {promo.description && (
                                        <p className="text-white/60 text-[11px] line-clamp-2 mt-0.5">{promo.description}</p>
                                    )}
                                    <div className="mt-3 self-start inline-flex items-center gap-1.5 bg-white/[0.12] hover:bg-white/25 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors">
                                        {promo.buttonText || 'CLAIM NOW'} <ArrowRight size={10} />
                                    </div>
                                </div>
                                {promo.charImage && (
                                    <img
                                        src={promo.charImage}
                                        alt=""
                                        aria-hidden
                                        loading="lazy"
                                        decoding="async"
                                        className="absolute right-0 bottom-0 h-full max-h-36 object-contain"
                                    />
                                )}
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* ── 5. ZEERO ORIGINALS ── */}
            <section className="px-3 md:px-0 mt-6 md:mt-8">
                <ZeeroOriginalsSection />
            </section>

            {/* ── 8. NEW GAMES ── */}
            <section className="px-3 md:px-0 mt-6 md:mt-10">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500/20 to-teal-500/5 flex items-center justify-center">
                            <Zap size={16} className="text-teal-400" fill="currentColor" />
                        </div>
                        <h2 className="text-lg md:text-xl font-extrabold text-white tracking-[-0.02em]">New Games</h2>
                    </div>
                    <Link href="/casino?category=new" className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/80 transition-colors bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] px-3.5 py-1.5 rounded-full">
                        All <ArrowRight size={10} />
                    </Link>
                </div>
                <HomeGameList title="" games={newGames} viewAllHref="/casino?category=new" isLoading={gamesLoading} />
            </section>

            {/* ── LIVE SPORTS (right after first casino row) ── */}
            {!eventsLoading && liveEventCards.length > 0 && (
                <section className="mt-6 md:mt-10">
                    <div className="flex items-center justify-between mb-4 px-3 md:px-0">
                        <div className="flex items-center gap-2.5">
                            <div className="relative">
                                <span className="absolute -inset-1 rounded-full bg-red-500/15 animate-ping" />
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/25 to-red-500/5 flex items-center justify-center">
                                    <Zap size={14} fill="white" className="text-red-400" />
                                </div>
                            </div>
                            <h2 className="text-lg md:text-xl font-extrabold text-white tracking-[-0.02em]">Live Sports</h2>
                            <span className="text-[9px] font-bold text-white/25 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full">{liveEventCards.length}</span>
                        </div>
                        <Link href="/sports" className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/80 transition-colors bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] px-3.5 py-1.5 rounded-full">
                            <span>All</span> <ArrowRight size={10} />
                        </Link>
                    </div>

                    {/* Horizontal scroll slider — same LiveEventCard as sports page */}
                    <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 md:px-0 pb-2" style={{ scrollbarWidth: 'none' }}>
                        {liveEventCards.map(ev => (
                            <LiveEventCard key={ev.matchId} event={ev} onCardClick={goToMatch} onOddsClick={goToMatch} />
                        ))}
                    </div>
                </section>
            )}

            {/* ── 10. TOP SLOTS ── */}
            <section className="px-3 md:px-0 mt-6 md:mt-10">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500/20 to-rose-500/5 flex items-center justify-center">
                            <Flame size={16} className="text-rose-400" fill="currentColor" />
                        </div>
                        <h2 className="text-lg md:text-xl font-extrabold text-white tracking-[-0.02em]">Top Slots</h2>
                    </div>
                    <Link href="/casino?category=slots" className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/80 transition-colors bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] px-3.5 py-1.5 rounded-full">
                        All <ArrowRight size={10} />
                    </Link>
                </div>
                <HomeGameList title="" games={slotGames} isLoading={gamesLoading} />
            </section>

            {/* ── 12. LIVE CASINO ── */}
            <section className="px-3 md:px-0 mt-6 md:mt-10 pb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 flex items-center justify-center">
                            <Zap size={16} className="text-brand-gold" fill="currentColor" />
                        </div>
                        <h2 className="text-lg md:text-xl font-extrabold text-white tracking-[-0.02em]">Live Casino</h2>
                        <div className="flex items-center gap-1 bg-red-500/8 border border-red-500/15 rounded-full px-2 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-red-400 text-[9px] font-bold">LIVE</span>
                        </div>
                    </div>
                    <Link href="/live-dealers" className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/80 transition-colors bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] px-3.5 py-1.5 rounded-full">
                        All <ArrowRight size={10} />
                    </Link>
                </div>
                <HomeGameList title="" games={liveGames} viewAllHref="/live-dealers" isLoading={gamesLoading} />
            </section>

            {/* ── 14. TABLE GAMES ── */}
            <section className="px-3 md:px-0 mt-6 md:mt-10">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center">
                            <Star size={16} className="text-violet-400" fill="currentColor" />
                        </div>
                        <h2 className="text-lg md:text-xl font-extrabold text-white tracking-[-0.02em]">Table Games</h2>
                    </div>
                    <Link href="/casino?category=table" className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/80 transition-colors bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] px-3.5 py-1.5 rounded-full">
                        All <ArrowRight size={10} />
                    </Link>
                </div>
                <HomeGameList title="" games={tableGames} viewAllHref="/casino?category=table" isLoading={gamesLoading} />
            </section>

            {/* ── 16. CRASH GAMES ── */}
            <section className="px-3 md:px-0 mt-6 md:mt-10">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/5 flex items-center justify-center">
                            <Flame size={16} className="text-orange-400" fill="currentColor" />
                        </div>
                        <h2 className="text-lg md:text-xl font-extrabold text-white tracking-[-0.02em]">Crash Games</h2>
                    </div>
                    <Link href="/casino?category=crash" className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/80 transition-colors bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] px-3.5 py-1.5 rounded-full">
                        All <ArrowRight size={10} />
                    </Link>
                </div>
                <HomeGameList title="" games={crashGames} viewAllHref="/casino?category=crash" isLoading={gamesLoading} />
            </section>

            {/* ── BOTTOM BANNER (Deposit Bonus + Payment Methods + Crypto) ── */}
            <section className="px-3 md:px-0 mt-4 md:mt-6">
                <div className="flex flex-col md:flex-row items-center justify-between rounded-2xl border border-white/[0.06] px-5 py-4 md:px-8 md:py-5 gap-4 md:gap-6 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #1a1510 0%, #14121a 30%, #0f1016 60%, #10101c 100%)' }}>
                    {/* subtle glow accents */}
                    <div className="absolute -left-16 -top-16 w-48 h-48 rounded-full bg-brand-gold/8 blur-3xl pointer-events-none" />
                    <div className="absolute -right-16 -bottom-16 w-48 h-48 rounded-full bg-brand-gold/6 blur-3xl pointer-events-none" />

                    {/* 300% Deposit Bonus */}
                    <div className="shrink-0 relative z-10 text-center md:text-left">
                        <span className="text-xl md:text-2xl font-black italic text-brand-gold">200% </span>
                        <span className="text-xl md:text-2xl font-black text-white">Deposit Bonus</span>
                    </div>

                    {/* Payment methods */}
                    <div className="flex items-center gap-3 md:gap-4 shrink-0 relative z-10 flex-wrap justify-center">
                        <svg width="40" height="18" viewBox="0 0 40 18" fill="none"><path d="M7.7 2.4C7.2 3 6.4 3.5 5.6 3.4c-.1-.8.3-1.6.7-2.1C6.8.7 7.7.2 8.4.2c.1.8-.2 1.6-.7 2.2zm.7 1.1c-.9-.1-1.7.5-2.1.5s-1.1-.5-1.8-.5c-.9 0-1.8.5-2.3 1.4-1 1.7-.3 4.2.7 5.6.5.7 1.1 1.5 1.8 1.4.7 0 1-.5 1.8-.5s1.1.5 1.9.5c.8 0 1.3-.7 1.8-1.4.6-.8.8-1.6.8-1.6s-1.5-.6-1.5-2.3c0-1.5 1.2-2.2 1.3-2.2-.7-1.1-1.8-1.2-2.2-1.2l-.2.2zm7.2-1.6v10.2h1.5V8.7h2.2c2 0 3.4-1.4 3.4-3.4S21.3 2 19.3 2h-3.7v.9zm1.5 1.2h1.9c1.4 0 2.2.7 2.2 2.1 0 1.4-.8 2.1-2.2 2.1h-1.9V3.1zm9 9.3c1 0 1.9-.5 2.3-1.3h0v1.2h1.4V7c0-1.4-1.1-2.3-2.9-2.3-1.6 0-2.8.9-2.8 2.2h1.4c.1-.7.7-1.1 1.4-1.1.9 0 1.5.4 1.5 1.2v.5l-1.9.1c-1.8.1-2.8.8-2.8 2.1 0 1.3 1 2.1 2.4 2.1v.6zm.4-1.2c-.8 0-1.3-.4-1.3-1 0-.6.5-1 1.5-1.1l1.7-.1v.5c0 1-.8 1.7-1.9 1.7zm5 4.2c1.5 0 2.2-.6 2.8-2.3L36 4.8h-1.6l-1.7 6.4h0l-1.7-6.4H29.3l2.6 7.3-.1.5c-.3.9-.7 1.2-1.4 1.2-.1 0-.4 0-.5 0v1.2c.1 0 .5 0 .6 0l-.1-.6z" fill="white"/></svg>
                        <svg width="30" height="20" viewBox="0 0 30 20" fill="none"><circle cx="11" cy="10" r="9" fill="#EB001B"/><circle cx="19" cy="10" r="9" fill="#F79E1B"/><path d="M15 3.1a9 9 0 0 1 0 13.8 9 9 0 0 1 0-13.8z" fill="#FF5F00"/></svg>
                        <span className="text-white font-black text-sm tracking-wider">VISA</span>
                        <span className="text-white/70 text-sm font-bold">G Pay</span>
                        <span className="text-white/70 text-sm font-bold">PicPay</span>
                    </div>

                    {/* Crypto icons */}
                    <div className="flex items-center gap-1.5 shrink-0 relative z-10 flex-wrap justify-center">
                        <div className="w-7 h-7 rounded-full bg-[#f7931a] flex items-center justify-center"><span className="text-white text-xs font-black">₿</span></div>
                        <div className="w-7 h-7 rounded-full bg-[#627EEA] flex items-center justify-center"><span className="text-white text-xs font-black">Ξ</span></div>
                        <div className="w-7 h-7 rounded-full bg-[#F3BA2F] flex items-center justify-center"><span className="text-white text-xs font-black">B</span></div>
                        <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center"><span className="text-white text-xs font-black">X</span></div>
                        <div className="w-7 h-7 rounded-full bg-[#26a17b] flex items-center justify-center"><span className="text-white text-xs font-black">₮</span></div>
                        <div className="w-7 h-7 rounded-full bg-linear-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center"><span className="text-white text-xs font-black">S</span></div>
                        <div className="w-7 h-7 rounded-full bg-[#2775CA] flex items-center justify-center"><span className="text-white text-xs font-black">$</span></div>
                        <div className="w-7 h-7 rounded-full bg-[#0033AD] flex items-center justify-center"><span className="text-white text-xs font-black">A</span></div>
                        <div className="w-7 h-7 rounded-full bg-[#C2A633] flex items-center justify-center"><span className="text-white text-xs font-black">D</span></div>
                        <div className="w-7 h-7 rounded-full bg-[#375BD2] flex items-center justify-center"><span className="text-white text-xs font-black">⬡</span></div>
                        <div className="w-7 h-7 rounded-full bg-[#FF0013] flex items-center justify-center"><span className="text-white text-xs font-black">T</span></div>
                    </div>
                </div>
            </section>

            {/* ── 17. TELEGRAM JOIN CARD ── */}
            {telegramLink && (
                <section className="px-3 md:px-0 mt-5 md:mt-7 pb-16 md:pb-8">
                    <a
                        href={telegramLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-4 bg-gradient-to-r from-[#0088cc]/90 to-[#005f9e]/90 rounded-2xl px-5 py-4 border border-white/[0.08] hover:border-white/[0.15] transition-all hover:scale-[1.01] hover:shadow-[0_8px_32px_rgba(0,136,204,0.2)] group overflow-hidden relative"
                    >
                        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/[0.06] pointer-events-none" />
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-white/[0.12] flex items-center justify-center flex-shrink-0">
                                <SiTelegram size={20} className="text-white" />
                            </div>
                            <div>
                                <p className="text-white font-black text-sm">Join our Telegram</p>
                                <p className="text-white/60 text-[11px] mt-0.5">Tips, updates &amp; exclusive community bonuses</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/[0.16] hover:bg-white/30 text-white text-[11px] font-black uppercase px-4 py-2 rounded-xl transition-colors flex-shrink-0 relative z-10">
                            JOIN <ChevronRight size={12} />
                        </div>
                    </a>
                </section>
            )}

            {/* bottom spacing when no telegram card */}
            {!telegramLink && <div className="pb-16 md:pb-8" />}

        </div>
    );
}



