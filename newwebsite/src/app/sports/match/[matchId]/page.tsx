"use client";

import {
  useEffect, useMemo, useState, useCallback, useRef, type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Activity, ArrowLeft, ChevronDown, ChevronUp,
  Clock, Flame, Play, RefreshCw, Tv, Star,
  TrendingUp, Shield, Target, BarChart3, Zap, CheckCircle,
  Pin, PinOff, Eye, EyeOff, ChevronsDown, ChevronsUp
} from "lucide-react";
import Header from "@/components/layout/Header";
import LeftSidebar from "@/components/layout/LeftSidebar";
import RightSidebar from "@/components/layout/RightSidebar";
import MaintenanceState from "@/components/maintenance/MaintenanceState";
import { useSectionMaintenance } from "@/hooks/useSectionMaintenance";
import { useBets } from "@/context/BetContext";
import { useSportsSocket } from "@/context/SportsSocketContext";
import { useAuth } from "@/context/AuthContext";
import { promotionApi, PromoTeamDeal } from "@/services/promotions";
import {
  applySocketPayloadToEvent,
  applySocketPayloadToMarketList,
  getSocketPayloadEventIds,
} from "@/lib/sportsRealtimeOdds";
import {
  getEventLiveState,
  isEventInPlay,
  isEventLive,
} from "@/lib/sportsLobbyData";
import { Lock } from "lucide-react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://zeero.bet/api").replace(/\/$/, "");

// ─── Sportradar Types ─────────────────────────────────────────────────────────
interface SrRunner {
  runnerId: string;
  runnerName: string;
  status: string;
  backPrices: { price: number; size: number }[];
  layPrices: { price: number; size: number }[];
}

interface SrMarket {
  marketId: string;
  marketName: string;
  marketType: string;
  status: string;
  runners: SrRunner[];
  limits: { minBetValue: number; maxBetValue: number; currency: string };
  category: string;
}

interface SrMarkets {
  premiumProvider: string;
  premiumBaseUrl: string;
  premiumTopic: string;
  premiumSportId: string;
  premiumCompetitionId: string;
  premiumEventId: string;
  premiumMarkets: SrMarket[];
  matchOddsProvider: string;
  matchOdds: SrMarket[];
  bookMakerProvider: string;
  bookmakers: SrMarket[];
  fancyProvider: string;
  fancyMarkets: SrMarket[];
}

interface SrEvent {
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
  markets: SrMarkets;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SPORT_EMOJI: Record<string, string> = {
  "sr:sport:1": "⚽", "sr:sport:21": "🏏", "sr:sport:2": "🏀",
  "sr:sport:5": "🎾", "sr:sport:16": "🏈", "sr:sport:4": "🏒",
  "sr:sport:117": "🥊", "sr:sport:12": "🏉", "sr:sport:20": "🏓",
  "sr:sport:31": "🏸", "sr:sport:23": "🏐", "sr:sport:19": "🎱",
  "sr:sport:22": "🎯", "sr:sport:3": "⚾", "sr:sport:29": "⚽",
};

// Category display labels + tab ordering
const CATEGORY_LABELS: Record<string, string> = {
  'Match':         '🏆 Match',
  'Head-to-Head':  '⚔️ H2H',
  'Over':          '📊 Over',
  'Innings':       '🏏 Innings',
  'Player':        '👤 Player',
  'Other':         '🔮 Other',
};
// Known categories in priority order; any unknown category falls back to "Other"
const CATEGORY_ORDER = ['Match', 'Head-to-Head', 'Over', 'Innings', 'Player', 'Other'];

// All odds chips use the same neutral dark style.
// Selected state switches to the platform's gold theme.
const ODDS_DEFAULT  = 'bg-white/[0.06] border-white/[0.10] hover:bg-white/[0.10] hover:border-white/[0.18] shadow-[0_0_8px_rgba(255,255,255,0.04)]';
const ODDS_SELECTED = 'bg-brand-gold/15 border-brand-gold/50 hover:bg-brand-gold/20 shadow-[0_0_12px_rgba(255,184,0,0.2)]';


function fmtMatchTime(ms: number) {
  const d = new Date(ms);
  const isToday = d.toDateString() === new Date().toDateString();
  return isToday
    ? "Today · " + d.toLocaleTimeString('en-US', { hour: "2-digit", minute: "2-digit", hour12: true })
    : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
      + " · " + d.toLocaleTimeString('en-US', { hour: "2-digit", minute: "2-digit", hour12: true });
}

// (isMarketPrimary replaced by category-based tabs)

function getGridCols(count: number) {
  if (count <= 2) return "grid-cols-2";
  if (count === 3) return "grid-cols-3";
  if (count === 4) return "grid-cols-2 sm:grid-cols-4";
  return "grid-cols-2 sm:grid-cols-3";
}

function getUniqueMarketsFromEvent(event: Pick<SrEvent, 'markets'> | null | undefined): SrMarket[] {
  const rawMarkets: SrMarket[] = [
    ...(event?.markets?.matchOdds ?? []),
    ...(event?.markets?.premiumMarkets ?? []),
    ...(event?.markets?.bookmakers ?? []),
    ...(event?.markets?.fancyMarkets ?? []),
  ];

  const seen = new Set<string>();
  return rawMarkets.filter((market) => {
    const key = String(market.marketId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeMarketArray(nextMarkets: SrMarket[] | undefined, prevMarkets: SrMarket[] | undefined): SrMarket[] {
  return Array.isArray(nextMarkets) && nextMarkets.length > 0
    ? nextMarkets
    : (prevMarkets ?? []);
}

function mergeSrEventSnapshot(
  prevEvent: SrEvent | null,
  nextEvent: SrEvent,
  liveScore?: { home?: number; away?: number },
): SrEvent {
  const prevMarkets = prevEvent?.markets;
  const nextMarkets = nextEvent.markets;

  return {
    ...(prevEvent ?? nextEvent),
    ...nextEvent,
    homeScore: nextEvent.homeScore ?? liveScore?.home ?? prevEvent?.homeScore ?? 0,
    awayScore: nextEvent.awayScore ?? liveScore?.away ?? prevEvent?.awayScore ?? 0,
    markets: {
      premiumProvider: nextMarkets?.premiumProvider ?? prevMarkets?.premiumProvider ?? '',
      premiumBaseUrl: nextMarkets?.premiumBaseUrl ?? prevMarkets?.premiumBaseUrl ?? '',
      premiumTopic: nextMarkets?.premiumTopic ?? prevMarkets?.premiumTopic ?? '',
      premiumSportId: nextMarkets?.premiumSportId ?? prevMarkets?.premiumSportId ?? '',
      premiumCompetitionId: nextMarkets?.premiumCompetitionId ?? prevMarkets?.premiumCompetitionId ?? '',
      premiumEventId: nextMarkets?.premiumEventId ?? prevMarkets?.premiumEventId ?? '',
      premiumMarkets: mergeMarketArray(nextMarkets?.premiumMarkets, prevMarkets?.premiumMarkets),
      matchOddsProvider: nextMarkets?.matchOddsProvider ?? prevMarkets?.matchOddsProvider ?? '',
      matchOdds: mergeMarketArray(nextMarkets?.matchOdds, prevMarkets?.matchOdds),
      bookMakerProvider: nextMarkets?.bookMakerProvider ?? prevMarkets?.bookMakerProvider ?? '',
      bookmakers: mergeMarketArray(nextMarkets?.bookmakers, prevMarkets?.bookmakers),
      fancyProvider: nextMarkets?.fancyProvider ?? prevMarkets?.fancyProvider ?? '',
      fancyMarkets: mergeMarketArray(nextMarkets?.fancyMarkets, prevMarkets?.fancyMarkets),
    },
  };
}

// ─── Odds Button (connected to bet slip) ──────────────────────────────────────
interface OddsBtnProps {
  runner: SrRunner;
  market: SrMarket;
  event: SrEvent;
  compact?: boolean;
}

function OddsBtn({ runner, market, event, compact = false }: OddsBtnProps) {
  const { addBet, removeBet, bets, oneClickEnabled, placeSingleBet, isOneClickPending } = useBets();
  const price = runner.backPrices?.[0]?.price;
  const isEventClosed = getEventLiveState(event) === 'CLOSED';
  // Check both runner-level AND market-level suspension status
  const isMarketSuspended = market.status !== 'Active';
  const isSuspended = isEventClosed || runner.status !== "Active" || isMarketSuspended || !price;

  const betId     = `${event.eventId}::${market.marketId}::${runner.runnerId}`;
  const isSelected = bets.some((b) => b.id === betId);
  const isPending  = isOneClickPending(event.eventId, market.marketId, runner.runnerId);

  const handleClick = () => {
    if (isSuspended || isPending) return;
    // Second click on a selected odds chip → deselect (remove from betslip)
    if (isSelected && !oneClickEnabled) { removeBet(betId); return; }
    const selection = {
      eventId: event.eventId,
      eventName: event.eventName,
      marketId: market.marketId,
      marketName: market.marketName,
      selectionId: runner.runnerId,
      selectionName: runner.runnerName,
      odds: price!,
      marketType: market.marketType,
      betType: "back" as const,
      provider: "sportradar",
      srSportId: event.sportId,
      srMarketFullId: market.marketId,
      srRunnerId: runner.runnerId,
      srRunnerName: runner.runnerName,
      srMarketName: market.marketName,
    };
    if (oneClickEnabled) {
      placeSingleBet(selection).catch(() => {});
    } else {
      addBet(selection);
    }
  };

  return (
    <button
      type="button"
      disabled={isSuspended || isPending}
      onClick={handleClick}
      className={`flex min-w-0 items-center justify-between gap-1.5 rounded-lg border px-3 py-2 transition-all active:scale-[0.97] disabled:cursor-not-allowed ${
        isPending
          ? 'bg-brand-gold/10 border-brand-gold/30 opacity-70'
          : isSelected
          ? ODDS_SELECTED + ' border-[1.5px]'
          : ODDS_DEFAULT + (isSuspended ? ' opacity-40' : '')
      }`}
    >
      <span className={`min-w-0 break-words text-left ${compact ? "text-[10px]" : "text-[11px]"} leading-snug text-white/50`}>
        {runner.runnerName}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <span className={`${compact ? "text-[13px]" : "text-[14px]"} font-adx-bold tabular-nums leading-none ${
          isSuspended ? 'text-white/20' : isPending ? 'text-brand-gold' : isSelected ? 'text-brand-gold' : 'text-white'
        }`}>
          {isSuspended ? "—" : price!.toFixed(2)}
        </span>
        {isPending && (
          <span className="w-3 h-3 rounded-full border-2 border-brand-gold/30 border-t-brand-gold animate-spin flex-shrink-0" />
        )}
        {!isPending && isSelected && <CheckCircle size={10} className="text-brand-gold flex-shrink-0" />}
        {!isPending && !isSelected && oneClickEnabled && !isSuspended && (
          <Zap size={9} className="text-brand-gold/40 flex-shrink-0" />
        )}
      </div>
    </button>
  );
}


// ─── Market card (accordion) ─────────────────────────────────────────────────
interface MarketCardProps {
  market: SrMarket;
  event: SrEvent;
  defaultOpen?: boolean;
  isPinned?: boolean;
  onTogglePin?: (id: string) => void;
  forceOpenKey?: number;
  forceOpenState?: boolean;
}

function MarketCard({ market, event, defaultOpen = false, isPinned, onTogglePin, forceOpenKey, forceOpenState }: MarketCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (forceOpenKey && forceOpenKey > 0) {
      setOpen(!!forceOpenState);
    }
  }, [forceOpenKey, forceOpenState]);
  const runners = market.runners;
  const isEventClosed = getEventLiveState(event) === 'CLOSED';
  const isActive = !isEventClosed && market.status === "Active";
  const cols = getGridCols(runners.length);

  return (
    <article className="overflow-hidden rounded-xl border border-brand-gold/10 bg-[#1a1714]/90 backdrop-blur-xl transition-all">
      <div
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-left transition hover:bg-brand-gold/[0.03] active:opacity-80"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 className="min-w-0 flex-1 text-[13px] font-adx-bold text-white break-words leading-snug">
            {market.marketName}
          </h2>
          {!isActive && (
            <span className="shrink-0 rounded-full bg-danger-alpha-10 px-2 py-0.5 text-[9px] font-adx-bold uppercase text-danger">
              {isEventClosed ? 'Closed' : 'Suspended'}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onTogglePin && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTogglePin(market.marketId); }}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition ${isPinned ? 'bg-brand-gold/10 text-brand-gold' : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/80'}`}
            >
              {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
            </button>
          )}
          {open
            ? <ChevronUp size={14} className="shrink-0 text-white/40" />
            : <ChevronDown size={14} className="shrink-0 text-white/40" />
          }
        </div>
      </div>

      {open && (
        <>
          <div className="relative border-t border-brand-gold/10">
            {/* Suspended overlay */}
            {!isActive && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[1px] rounded-b-xl">
                <span className="flex items-center gap-2 rounded-full bg-rose-500/15 border border-rose-500/25 px-4 py-2 text-[11px] font-adx-bold text-danger uppercase tracking-wider">
                  {isEventClosed ? 'Betting Closed' : '🔒 Suspended'}
                </span>
              </div>
            )}
            <div className={`grid ${cols} gap-1.5 p-3`}>
            {runners.map((r) => (
              <OddsBtn key={r.runnerId} runner={r} market={market} event={event} compact />
            ))}
          </div>
          </div>
          {market.limits && (
            <div className="border-t border-white/[0.05] px-4 py-2 flex items-center justify-between text-[10px] text-text-disabled">
              <span>Min: {market.limits.currency} {market.limits.minBetValue?.toLocaleString()}</span>
              <span>Max: {market.limits.currency} {market.limits.maxBetValue?.toLocaleString()}</span>
            </div>
          )}
        </>
      )}
    </article>
  );
}

// ─── Match hero scoreboard ────────────────────────────────────────────────────
function MatchHero({
  event, isLive, isInPlay, isClosed, homeName, awayName, sportEmoji, onRefresh, refreshing,
  connectionStatus, hasConnectedOnce,
}: {
  event: SrEvent; isLive: boolean; isInPlay: boolean; isClosed: boolean;
  homeName: string; awayName: string; sportEmoji: string;
  onRefresh: () => void; refreshing: boolean;
  connectionStatus: string;
  hasConnectedOnce: boolean;
}) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-gold/15 bg-[#1a1714]/95 backdrop-blur-xl shadow-[0_10px_32px_rgba(0,0,0,0.35)]">
      {/* Top bar — stacks on mobile */}
      <div className="border-b border-brand-gold/10 px-3 py-2.5 md:px-4 md:py-3 space-y-2">
        {/* Row 1: Sport icon + competition + refresh */}
        <div className="flex items-center gap-2">
          {/* Back button — desktop only */}
          <button
            type="button"
            onClick={() => router.back()}
            className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-elevated border border-white/[0.06] text-text-muted transition hover:bg-bg-hover hover:text-text-primary active:scale-90"
          >
            <ArrowLeft size={13} />
          </button>
          <div className="flex h-6 w-6 md:h-7 md:w-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-[13px] md:text-[14px]">
            {sportEmoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] md:text-[12px] font-adx-bold text-text-primary truncate">
              {event.sportName} <span className="text-text-muted font-medium">· {event.competitionName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex h-6 w-6 md:h-7 md:w-7 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-text-muted transition hover:bg-bg-hover hover:text-text-primary active:scale-90 disabled:opacity-40"
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Row 2: Status badges — wrap naturally */}
        <div className="flex flex-wrap items-center gap-1.5 pl-8 md:pl-9">
          {isInPlay && (
            <div className="flex items-center gap-1 rounded-full border border-rose-500/25 bg-danger-alpha-10 px-2 py-0.5">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-rose-500" />
              <span className="text-[10px] font-adx-bold text-danger">IN PLAY</span>
            </div>
          )}
          {!isInPlay && isLive && (
            <div className="flex items-center gap-1 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
              <span className="text-[10px] font-adx-bold text-brand-gold">LIVE</span>
            </div>
          )}
          {connectionStatus === 'connected' && (
            <div className="flex items-center gap-1 rounded-full bg-success-alpha-10 border border-success-primary/20 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success-primary" />
              <span className="text-[9px] font-adx-bold text-success-bright">LIVE ODDS</span>
            </div>
          )}
          {hasConnectedOnce && connectionStatus === 'reconnecting' && (
            <div className="flex items-center gap-1 rounded-full bg-warning-alpha-08 border border-amber-500/20 px-2 py-0.5">
              <span className="h-3 w-3 rounded-full border-[1.5px] border-amber-400/30 border-t-amber-400 animate-spin" />
              <span className="text-[9px] font-adx-bold text-warning-bright">RECONNECTING</span>
            </div>
          )}
          {hasConnectedOnce && connectionStatus === 'disconnected' && (
            <div className="flex items-center gap-1 rounded-full bg-danger-alpha-10 border border-danger/20 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              <span className="text-[9px] font-adx-bold text-danger">OFFLINE</span>
            </div>
          )}
          {isClosed && (
            <div className="flex items-center gap-1 rounded-full bg-bg-elevated px-2 py-0.5">
              <Shield size={9} className="text-text-disabled" />
              <span className="text-[10px] text-text-muted">Finished</span>
            </div>
          )}
          {!isLive && !isClosed && (
            <div className="flex items-center gap-1 rounded-full bg-bg-elevated px-2 py-0.5">
              <Clock size={9} className="text-text-disabled" />
              <span className="text-[10px] text-text-muted">{fmtMatchTime(event.openDate)}</span>
            </div>
          )}
          {event.isFavourite && <Star size={11} className="fill-brand-gold text-brand-gold" />}
        </div>
      </div>

      {/* Teams vs score — responsive */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-4 md:gap-4 md:px-5 md:py-5">
        <div className="min-w-0">
          <p className="text-[14px] font-adx-bold leading-tight text-text-primary md:text-[22px] break-words">{homeName}</p>
          <p className="mt-0.5 text-[9px] text-text-muted">Home</p>
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          {isAuthenticated ? (
            isLive || isClosed ? (
              <div className="flex items-center gap-1.5 md:gap-3 rounded-xl md:rounded-2xl bg-bg-zeero px-3 py-2 md:px-5 md:py-3 shadow-inner">
                <span className="text-[20px] md:text-[28px] font-adx-bold tabular-nums text-text-primary">{event.homeScore ?? '-'}</span>
                <span className="text-[14px] md:text-[20px] text-text-disabled">–</span>
                <span className="text-[20px] md:text-[28px] font-adx-bold tabular-nums text-text-primary">{event.awayScore ?? '-'}</span>
              </div>
            ) : (
              <span className="rounded-lg md:rounded-xl bg-bg-elevated px-3 py-1.5 md:px-4 md:py-2 text-[12px] md:text-[14px] font-adx-bold text-text-disabled">VS</span>
            )
          ) : (
            <div className="flex items-center gap-1.5 rounded-xl bg-bg-zeero/50 px-2.5 py-2 md:px-4 md:py-3 shadow-inner border border-white/[0.04] backdrop-blur-md">
              <Lock size={10} className="text-text-muted shrink-0" />
              <span className="text-[10px] md:text-[12px] font-adx-bold text-text-muted select-none whitespace-nowrap">Login</span>
            </div>
          )}
          <span className="text-[8px] md:text-[9px] uppercase tracking-widest text-text-disabled text-center">
            {isClosed ? "Full Time" : isInPlay ? "In Play" : isLive ? "Live" : fmtMatchTime(event.openDate)}
          </span>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[14px] font-adx-bold leading-tight text-text-primary md:text-[22px] break-words">{awayName}</p>
          <p className="mt-0.5 text-[9px] text-text-muted">Away</p>
        </div>
      </div>
    </div>
  );
}

// ─── Market tabs ──────────────────────────────────────────────────────────────
function MarketTabs({
  tabs, active, onChange,
}: {
  tabs: { key: string; label: string; count: number }[];
  active: string;
  onChange: (t: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
      {tabs.map(({ key, label, count }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-adx-bold transition-all active:scale-95 border ${
            active === key
              ? "bg-brand-gold text-white border-brand-gold"
              : "bg-white/[0.04] text-text-muted border-white/[0.06] hover:bg-white/[0.08] hover:text-text-primary"
          }`}
        >
          <span>{label}</span>
          {count > 0 && key !== 'All' && (
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ${
              active === key ? 'bg-black/20 text-white' : 'bg-white/[0.08] text-text-muted'
            }`}>
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── MatchPage Components ────────────────────────────────────────────────────────

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  // Next.js may return URL-encoded matchId (sr%3Amatch%3A...) — always decode
  const matchId = decodeURIComponent(params.matchId as string);

  // All matches are Sportradar-based

  const [srEvent, setSrEvent] = useState<SrEvent | null>(null);
  const [srSportId, setSrSportId] = useState("");
  const [allMarkets, setAllMarkets] = useState<SrMarket[]>([]);
  const [activeTab, setActiveTab] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [pinnedMarkets, setPinnedMarkets] = useState<Set<string>>(new Set());
  const [forceOpenKey, setForceOpenKey] = useState<number>(0);
  const [forceOpenState, setForceOpenState] = useState(false);
  const [matchPromos, setMatchPromos] = useState<PromoTeamDeal[]>([]);
  const srEventRef = useRef<SrEvent | null>(null);
  const allMarketsRef = useRef<SrMarket[]>([]);

  useEffect(() => {
    srEventRef.current = srEvent;
  }, [srEvent]);

  useEffect(() => {
    allMarketsRef.current = allMarkets;
  }, [allMarkets]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`pinned_markets_${matchId}`);
      if (saved) {
        setPinnedMarkets(new Set(JSON.parse(saved)));
      }
    } catch {}
  }, [matchId]);

  const togglePin = useCallback((mId: string) => {
    setPinnedMarkets(prev => {
      const next = new Set(prev);
      if (next.has(mId)) next.delete(mId);
      else next.add(mId);
      try {
        localStorage.setItem(`pinned_markets_${matchId}`, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, [matchId]);

  useEffect(() => {
    promotionApi.getPromoTeamDeals().then((deals) => {
      setMatchPromos(deals.filter(d => d.eventId === matchId));
    }).catch(() => {});
  }, [matchId]);

  const { blocked, loading: mlLoading, message: mlMsg } = useSectionMaintenance("sports", "Sports is under maintenance.");

  const loadMarket = useCallback(async (
    options?: { spin?: boolean; fresh?: boolean },
  ) => {
    if (options?.spin) setRefreshing(true);
    try {
      // Single call — backend resolves sportId internally from 4-layer cache fallback
      // (event cache → upcoming:all → inplay:all → per-sport pipeline → MongoDB)
      const searchParams = new URLSearchParams({
        eventId: matchId,
      });
      if (options?.fresh) {
        searchParams.set('fresh', '1');
      }
      const url = `${API_BASE}/sports/sportradar/market?${searchParams.toString()}`;
      const res = await fetch(url, { cache: 'no-store' });
      const body = await res.json();

      if (body?.success && body?.event) {
        const ev: SrEvent = body.event;
        const uniqueMarkets = getUniqueMarketsFromEvent(ev);
        srEventRef.current = ev;
        setSrEvent(ev);
        setSrSportId(ev.sportId);
        allMarketsRef.current = uniqueMarkets;
        setAllMarkets(uniqueMarkets);
      }
    } catch (e) {
      console.error('[MatchPage] error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadMarket({ fresh: true });
  }, [loadMarket]);


  // ── Socket.IO — real-time odds for SR events ──────────────────────────────
  const { socket, connectionStatus, reconnectAttempts, hasConnectedOnce, joinMatchRoom, leaveMatchRoom } = useSportsSocket();
  const previousConnectionStatusRef = useRef<string>('disconnected');
  const hasConnectedOnceRef = useRef(false);
  const lastSocketRefreshAtRef = useRef(0);

  useEffect(() => {
    if (false || !matchId) return;

    // Join the match room so backend emits targeted updates
    joinMatchRoom(matchId);

    return () => {
      leaveMatchRoom(matchId);
    };
  }, [true, joinMatchRoom, leaveMatchRoom, matchId]);

  useEffect(() => {
    if (!socket || false || !matchId || connectionStatus !== 'connected') return;

    socket.emit('match-heartbeat', matchId);
    const heartbeat = window.setInterval(() => {
      socket.emit('match-heartbeat', matchId);
    }, 10_000);

    return () => {
      window.clearInterval(heartbeat);
    };
  }, [socket, true, matchId, connectionStatus]);

  useEffect(() => {
    const previousStatus = previousConnectionStatusRef.current;

    if (
      hasConnectedOnceRef.current &&
      true &&
      matchId &&
      connectionStatus === 'connected' &&
      (previousStatus === 'reconnecting' || previousStatus === 'disconnected')
    ) {
      loadMarket({ fresh: true });
    }

    if (connectionStatus === 'connected') {
      hasConnectedOnceRef.current = true;
    }

    previousConnectionStatusRef.current = connectionStatus;
  }, [connectionStatus, true, loadMarket, matchId]);

  const handleManualRefresh = useCallback(() => {
    loadMarket({ spin: true, fresh: true });
  }, [loadMarket]);

  useEffect(() => {
    if (false || !matchId || !socket) return;

    const handleSocketData = (data: any) => {
      if (!data) return;

      const directEventId = String(data.eventId ?? '').trim();
      if (directEventId && directEventId !== matchId) {
        return;
      }

      // ── Handle full sportradar snapshot from the live odds loop ─────────
      if (data.messageType === 'sportradar_odds' && data.eventId === matchId) {
        if (data.event) {
          const liveEvent = data.event as SrEvent;
          const mergedEvent = mergeSrEventSnapshot(srEventRef.current, liveEvent, data.score);
          srEventRef.current = mergedEvent;
          setSrEvent(mergedEvent);
          if (mergedEvent.sportId) {
            setSrSportId(mergedEvent.sportId);
          }
          const uniqueMarkets = getUniqueMarketsFromEvent(mergedEvent);
          allMarketsRef.current = uniqueMarkets;
          setAllMarkets(uniqueMarkets);
          return;
        }
      }

      const targetEventIds = directEventId
        ? new Set([directEventId])
        : new Set(getSocketPayloadEventIds(data));
      const targetsCurrentMatch = targetEventIds.has(matchId);

      if (!targetsCurrentMatch) {
        return;
      }

      let didPatch = false;
      const currentEvent = srEventRef.current;
      if (currentEvent) {
        const patchedEvent = applySocketPayloadToEvent(currentEvent, data, matchId);
        if (patchedEvent !== currentEvent) {
          srEventRef.current = patchedEvent;
          setSrEvent(patchedEvent);
          const uniqueMarkets = getUniqueMarketsFromEvent(patchedEvent);
          allMarketsRef.current = uniqueMarkets;
          setAllMarkets(uniqueMarkets);
          didPatch = true;
        }
      }

      if (!didPatch) {
        const currentMarkets = allMarketsRef.current;
        const patchedMarkets = applySocketPayloadToMarketList(currentMarkets, data, matchId);
        if (patchedMarkets !== currentMarkets) {
          allMarketsRef.current = patchedMarkets;
          setAllMarkets(patchedMarkets);
          didPatch = true;
        }
      }

      if (
        !didPatch &&
        (
          data.messageType === 'odds' ||
          data.messageType === 'match_odds' ||
          data.messageType === 'bookmaker_odds' ||
          data.messageType === 'bm_odds' ||
          data.messageType === 'market_status'
        )
      ) {
        const now = Date.now();
        if (now - lastSocketRefreshAtRef.current >= 1500) {
          lastSocketRefreshAtRef.current = now;
          // loadMarket({ fresh: true });
        }
      }
    };

    socket?.on('sports-match-data', handleSocketData);

    return () => {
      socket?.off('sports-match-data', handleSocketData);
    };
  }, [socket, true, loadMarket, matchId]);

  useEffect(() => {
    if (false || !matchId) return;

    const handleOddsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{
        eventIds?: string[];
        updates?: Array<{
          eventId: string;
          marketId: string;
          selectionId: string;
          currentOdds: number;
        }>;
      }>;
      const eventIds = customEvent.detail?.eventIds ?? [];
      const updates = (customEvent.detail?.updates ?? []).filter(
        (update) => update.eventId === matchId && Number.isFinite(update.currentOdds),
      );

      if (updates.length > 0 && srEventRef.current) {
        const syntheticPayload = {
          messageType: 'odds',
          eventId: matchId,
          data: updates.map((update) => ({
            mid: update.marketId,
            eid: update.eventId,
            rt: [{
              ri: update.selectionId,
              ib: true,
              rt: update.currentOdds,
              bv: 0,
            }],
          })),
        };

        const patchedEvent = applySocketPayloadToEvent(srEventRef.current, syntheticPayload, matchId);
        if (patchedEvent !== srEventRef.current) {
          srEventRef.current = patchedEvent;
          setSrEvent(patchedEvent);
          const uniqueMarkets = getUniqueMarketsFromEvent(patchedEvent);
          allMarketsRef.current = uniqueMarkets;
          setAllMarkets(uniqueMarkets);
        }
      }

      // if (eventIds.includes(matchId)) {
      //   loadMarket({ fresh: true });
      // }
    };

    window.addEventListener('sports:odds-updated', handleOddsUpdated as EventListener);
    return () => {
      window.removeEventListener('sports:odds-updated', handleOddsUpdated as EventListener);
    };
  }, [true, loadMarket, matchId]);

  useEffect(() => {
    if (false || !srEvent || getEventLiveState(srEvent) === 'CLOSED') return;
    if (connectionStatus === 'connected') return;

    const pollMs = isEventInPlay(srEvent) ? 3_000 : isEventLive(srEvent) ? 6_000 : 12_000;
    const interval = window.setInterval(() => {
      loadMarket({ fresh: true });
    }, pollMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [true, srEvent, loadMarket, connectionStatus]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Derived ───────────────────────────────────────────────────────────────
  const isLive = isEventLive(srEvent);
  const isInPlay = isEventInPlay(srEvent);
  const isClosed = getEventLiveState(srEvent) === "CLOSED";
  const vsSplit = (srEvent?.eventName ?? "").split(/ vs\.? /i);
  const homeName = vsSplit[0]?.trim() ?? "Home";
  const awayName = vsSplit[1]?.trim() ?? "Away";
  const sportEmoji = SPORT_EMOJI[srEvent?.sportId ?? ""] ?? "🏟️";

  // Derive which categories actually have markets
  const categoryGroups = useMemo(() => {
    const groups: Record<string, SrMarket[]> = {};
    allMarkets.forEach((m) => {
      const cat = m.category?.trim() || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    });
    return groups;
  }, [allMarkets]);

  // Build tabs: All + each category that has markets (in CATEGORY_ORDER)
  const marketTabs = useMemo(() => {
    const tabs: { key: string; label: string; count: number }[] = [
      { key: 'All', label: 'All', count: allMarkets.length },
    ];
    CATEGORY_ORDER.forEach((cat) => {
      const count = categoryGroups[cat]?.length ?? 0;
      if (count > 0) {
        tabs.push({ key: cat, label: CATEGORY_LABELS[cat] ?? cat, count });
      }
    });
    // Any unlisted categories at end
    Object.keys(categoryGroups).forEach((cat) => {
      if (!CATEGORY_ORDER.includes(cat)) {
        tabs.push({ key: cat, label: cat, count: categoryGroups[cat].length });
      }
    });
    return tabs;
  }, [categoryGroups, allMarkets.length]);

  // Filter markets by selected tab and sort pinned to top
  const filteredMarkets = useMemo(() => {
    let markets = activeTab === 'All' ? allMarkets : (categoryGroups[activeTab] ?? []);
    
    // Sort pinned to Top
    return [...markets].sort((a, b) => {
      const aPinned = pinnedMarkets.has(a.marketId) ? 1 : 0;
      const bPinned = pinnedMarkets.has(b.marketId) ? 1 : 0;
      return bPinned - aPinned; // 1 goes first
    });
  }, [activeTab, allMarkets, categoryGroups, pinnedMarkets]);

  const livePrimaryMatchOdds = useMemo(() => {
    const matchOddsMarketId = srEvent?.markets?.matchOdds?.[0]?.marketId;
    if (!matchOddsMarketId) return null;
    return allMarkets.find((market) => market.marketId === matchOddsMarketId) ?? srEvent?.markets?.matchOdds?.[0] ?? null;
  }, [allMarkets, srEvent]);

  // Primary market strip should always prefer the true live-updated match odds market.
  const primaryMarket = useMemo(
    () => livePrimaryMatchOdds ?? (categoryGroups['Match']?.[0]) ?? allMarkets[0],
    [allMarkets, categoryGroups, livePrimaryMatchOdds],
  );
  const primaryMarketTitle = useMemo(() => {
    if (!primaryMarket) return 'Primary Market';
    if (livePrimaryMatchOdds && primaryMarket.marketId === livePrimaryMatchOdds.marketId) {
      return 'Match Winner (1x2)';
    }
    return primaryMarket.marketName || 'Primary Market';
  }, [livePrimaryMatchOdds, primaryMarket]);
  const hasConnectionLoss =
    hasConnectedOnce &&
    (connectionStatus === 'disconnected' || connectionStatus === 'reconnecting');

  const handleConnectionRecoveryReload = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  // ── Shell ─────────────────────────────────────────────────────────────────
  const shell = (content: ReactNode) => (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-base font-[family-name:var(--font-poppins)]">
      <Header />
      <div className="mx-auto flex w-full max-w-[1920px] flex-1 overflow-hidden pt-[60px] md:pt-[64px] pb-[80px] md:pb-0">
        <LeftSidebar
          selectedSportId={srEvent?.sportId ?? null}
          onSelectSport={(id) => router.push(id ? `/sports/league/${id}` : "/sports")}
        />
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-bg-base">{content}</div>
      </div>
      {/* Floating betslip — handled globally by layout or standard drawer here */}
    </div>
  );

  const Spinner = () => (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/[0.06] border-t-brand-gold" />
    </div>
  );

  if (mlLoading) return shell(<Spinner />);
  if (blocked) return shell(<div className="p-6"><MaintenanceState title="Sports Maintenance" message={mlMsg} backHref="/sports" backLabel="Back to Sports" /></div>);
  if (loading) return shell(<Spinner />);

  // ── No event loaded ────────────────────────────────────────────────────
  if (!srEvent) {
    return shell(
      <main className="min-h-full bg-bg-base text-text-primary">
        <div className="mx-auto max-w-[900px] px-4 py-6">
          <button type="button" onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-[13px] text-text-muted transition hover:text-text-primary">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="rounded-2xl border border-white/[0.06] bg-[#1a1714]/90 backdrop-blur-xl p-6 text-center space-y-2">
            <Flame size={32} className="mx-auto text-brand-gold" />
            <h1 className="text-[18px] font-adx-bold text-text-primary">Event not available</h1>
            <p className="text-[13px] text-text-muted">Match ID: {matchId}</p>
            <button type="button" onClick={() => router.back()}
              className="mt-2 rounded-full bg-bg-elevated px-4 py-2 text-[12px] text-text-muted transition hover:text-text-primary">
              ← Go back
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Match page render ─────────────────────────────────────────────────────
  return shell(
      <main className="min-h-full bg-bg-base text-text-primary">
        {/* ── Reconnection banner ─────────────────────────────────── */}
        {hasConnectionLoss && (
          <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500/90 px-4 py-2 text-white text-[12px] font-bold shadow-lg">
            <span className="h-3 w-3 rounded-full border-2 border-black/20 border-t-black animate-spin" />
            Connection lost — reconnecting{reconnectAttempts > 1 ? ` (attempt ${reconnectAttempts})` : ''}…
          </div>
        )}
        <div className="mx-auto max-w-[1820px] px-3 py-2 md:px-5 md:py-3 pb-[calc(var(--mobile-nav-height)+16px)] md:pb-8">
          <div className="grid items-start gap-2 grid-cols-1">

            {/* ── Left ── */}
            <div className="min-w-0 space-y-2">

              {/* Match hero */}
                <MatchHero
                  event={srEvent}
                  isLive={isLive}
                  isInPlay={isInPlay}
                  isClosed={isClosed}
                homeName={homeName}
                awayName={awayName}
                sportEmoji={sportEmoji}
                onRefresh={handleManualRefresh}
                refreshing={refreshing}
                connectionStatus={connectionStatus}
                hasConnectedOnce={hasConnectedOnce}
              />

              {hasConnectionLoss ? (
                <section className="rounded-2xl border border-amber-500/20 bg-[#1a1714]/90 backdrop-blur-xl p-6 text-center shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning-alpha-08 text-warning-bright">
                    <RefreshCw size={22} />
                  </div>
                  <h2 className="mt-4 text-[18px] font-adx-bold text-text-primary">Markets hidden while connection recovers</h2>
                  <p className="mx-auto mt-2 max-w-[540px] text-[13px] leading-6 text-text-muted">
                    Live market data is temporarily unavailable. Reload the match page to restore the latest odds and market details.
                  </p>
                  <button
                    type="button"
                    onClick={handleConnectionRecoveryReload}
                    className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-brand-gold px-5 py-2.5 text-[12px] font-adx-bold text-white transition hover:brightness-110 active:scale-[0.98]"
                  >
                    <RefreshCw size={14} />
                    Reload Match
                  </button>
                </section>
              ) : (
                <>
                  {/* 1x2 quick odds strip */}
                  {primaryMarket && (
                    <div className="overflow-hidden rounded-2xl border border-brand-gold/15 bg-[#1a1714]/90 backdrop-blur-xl px-4 py-3">
                      <div className="mb-2.5 flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-widest text-text-disabled">{primaryMarketTitle}</p>
                        <span className="text-[10px] text-text-muted">
                          Min: {primaryMarket.limits?.currency} {primaryMarket.limits?.minBetValue?.toLocaleString()}
                        </span>
                      </div>
                      <div className={`grid gap-2.5 ${getGridCols(primaryMarket.runners.length)}`}>
                        {primaryMarket.runners.map((r) => (
                          <OddsBtn key={r.runnerId} runner={r} market={primaryMarket} event={srEvent} />
                        ))}
                      </div>
                      {livePrimaryMatchOdds && primaryMarket.marketId === livePrimaryMatchOdds.marketId && matchPromos.length > 0 && (
                        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                          <Target size={12} className="text-emerald-400 flex-shrink-0" />
                          <span className="text-[11px] font-bold text-emerald-400">
                            {matchPromos[0].cardBadge || (
                              matchPromos[0].promotionType === 'FIRST_OVER_SIX_CASHBACK' ? 'EARLY 6 REFUND OFFER'
                                : matchPromos[0].promotionType === 'LEAD_MARGIN_PAYOUT' ? 'EARLY PAYOUT OFFER'
                                    : matchPromos[0].promotionType === 'LATE_LEAD_REFUND' ? 'BAD BEAT REFUND'
                                        : matchPromos[0].promotionType === 'PERIOD_LEAD_PAYOUT' ? 'PERIOD PAYOUT OFFER'
                                            : 'CASHBACK OFFER'
                            )}
                          </span>
                          <span className="text-[10px] text-emerald-300/60 hidden sm:inline">
                            — {matchPromos[0].refundPercentage}% {matchPromos[0].benefitType === 'PAYOUT_AS_WIN' ? 'winner credit' : 'refund'} on pre-match Match Odds
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Market filter tabs */}
                  <MarketTabs tabs={marketTabs} active={activeTab} onChange={setActiveTab} />

                  {/* Count + premium badge */}
                  <div className="flex items-center gap-2 pt-1">
                    <BarChart3 size={14} className="text-brand-gold" />
                    <span className="text-[13px] font-adx-bold text-text-primary">
                      {filteredMarkets.length} {activeTab === "All" ? "Total" : activeTab} Markets
                    </span>
                    {srEvent.premiumEnabled && (
                      <span className="rounded-full border border-brand-gold/20 bg-brand-gold/10 px-2 py-0.5 text-[9px] font-adx-bold uppercase text-brand-gold">
                        Premium
                      </span>
                    )}
                    {isLive && (
                      <span className="ml-auto flex items-center gap-1 rounded-full border border-success-primary/20 bg-success-alpha-10 px-2 py-0.5 text-[9px] font-adx-bold text-success-bright">
                        <TrendingUp size={9} /> Live odds
                      </span>
                    )}
                  </div>

                  {/* Markets list controls */}
                  <div className="flex items-center justify-end pb-1 pt-1 opacity-80 border-t border-white/[0.05] mt-1">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => { setForceOpenState(true); setForceOpenKey(Date.now()); }}
                        className="flex items-center gap-1 text-[11px] text-text-muted transition hover:text-white"
                      >
                        <ChevronsDown size={13} /> Expand All
                      </button>
                      <span className="text-white/10">|</span>
                      <button
                        type="button"
                        onClick={() => { setForceOpenState(false); setForceOpenKey(Date.now()); }}
                        className="flex items-center gap-1 text-[11px] text-text-muted transition hover:text-white"
                      >
                        <ChevronsUp size={13} /> Collapse All
                      </button>
                    </div>
                  </div>

                  {/* Markets list — 2-column grid on desktop */}
                  <section>
                    {filteredMarkets.length === 0 ? (
                      <div className="flex min-h-[100px] items-center justify-center rounded-2xl border border-white/[0.06] bg-[#1a1714]/90 backdrop-blur-xl">
                        <p className="text-[13px] text-text-muted">No markets available</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 items-start">
                        {filteredMarkets.map((m) => (
                          <MarketCard
                            key={`${activeTab}-${m.marketId}`}
                            market={m}
                            event={srEvent}
                            defaultOpen={true}
                            isPinned={pinnedMarkets.has(m.marketId)}
                            onTogglePin={togglePin}
                            forceOpenKey={forceOpenKey}
                            forceOpenState={forceOpenState}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}

            </div>

          </div>
        </div>
      </main>
    );
}
