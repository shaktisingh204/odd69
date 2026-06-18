'use client';

// ─────────────────────────────────────────────────────────────
// SportsbookMainContent — The Odds API Sportsbook home page
// Route: /sportsbook
// ─────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { Globe, Search, ChevronRight, Zap, TrendingUp, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { SportInfo, SportGroup } from './types';

// ─── Sport group → emoji ────────────────────────────────────
const GROUP_ICONS: Record<string, string> = {
  'Soccer': '⚽',
  'Cricket': '🏏',
  'Basketball': '🏀',
  'Tennis': '🎾',
  'American Football': '🏈',
  'Baseball': '⚾',
  'Ice Hockey': '🏒',
  'Rugby League': '🏉',
  'Rugby Union': '🏉',
  'Mixed Martial Arts': '🥊',
  'Boxing': '🥊',
  'Golf': '⛳',
  'Aussie Rules': '🏟️',
  'Motor Sport': '🏎️',
  'Esports': '🎮',
};

const getGroupIcon = (group: string): string => GROUP_ICONS[group] ?? '🏟️';

// ─── Sport group → gradient ──────────────────────────────────
const GROUP_GRADIENT: Record<string, string> = {
  'Soccer': 'from-emerald-600/80 via-emerald-700/60 to-emerald-900/80',
  'Cricket': 'from-blue-600/80 via-blue-800/60 to-blue-900/80',
  'Basketball': 'from-orange-600/80 via-orange-700/60 to-orange-900/80',
  'Tennis': 'from-lime-600/80 via-lime-700/60 to-lime-900/80',
  'American Football': 'from-red-600/80 via-red-800/60 to-red-900/80',
  'Baseball': 'from-sky-600/80 via-sky-800/60 to-indigo-900/80',
  'Ice Hockey': 'from-cyan-600/80 via-cyan-800/60 to-slate-900/80',
  'Mixed Martial Arts': 'from-rose-600/80 via-rose-800/60 to-rose-900/80',
  'Boxing': 'from-rose-600/80 via-rose-800/60 to-rose-900/80',
  'Golf': 'from-green-600/80 via-green-800/60 to-green-900/80',
  'Rugby League': 'from-amber-600/80 via-amber-800/60 to-amber-900/80',
};

const getGroupGradient = (group: string): string =>
  GROUP_GRADIENT[group] ?? 'from-brand-gold/60 via-brown-accent/60 to-bg-card/80';

// ─── Skeleton cards ──────────────────────────────────────────
function SportCardSkeleton() {
  return (
    <div className="h-20 overflow-hidden rounded-xl border border-white/[0.06] bg-bg-card skeleton-block skeleton-shimmer" />
  );
}

// ─── Featured sport quick-link card ─────────────────────────
function FeaturedSportCard({ sport, onClick }: { sport: SportInfo; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative min-w-[140px] shrink-0 snap-start overflow-hidden rounded-xl border border-white/[0.07] shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all duration-200 hover:border-brand-gold/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] active:scale-[0.97]"
      style={{ height: 90 }}
    >
      {/* Background gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${getGroupGradient(sport.group)}`}
      />
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1 px-2">
        <span className="text-2xl leading-none drop-shadow-md">
          {getGroupIcon(sport.group)}
        </span>
        <span className="text-[11px] font-adx-bold text-white drop-shadow-sm text-center leading-tight line-clamp-2">
          {sport.title}
        </span>
      </div>
    </button>
  );
}

// ─── Sport group card ────────────────────────────────────────
function SportGroupCard({ group, onClick }: { group: SportGroup; onClick: (sport: SportInfo) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-bg-card shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
      {/* Group header */}
      <div className={`flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r ${getGroupGradient(group.group)}`}>
        <span className="text-xl">{getGroupIcon(group.group)}</span>
        <span className="font-adx-bold text-[14px] text-white">{group.group}</span>
        <span className="ml-auto text-[10px] text-white/60">
          {group.sports.length} competition{group.sports.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Sports in this group */}
      <div className="divide-y divide-white/[0.04]">
        {group.sports.map((sport) => (
          <button
            key={sport.key}
            type="button"
            onClick={() => onClick(sport)}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg-elevated active:bg-bg-hover group"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-[13px] group-hover:bg-brand-gold/15 transition-colors">
              {getGroupIcon(sport.group)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-adx-bold text-text-primary truncate group-hover:text-brand-gold transition-colors">
                {sport.title}
              </p>
              {sport.description && (
                <p className="text-[10px] text-text-muted truncate">{sport.description}</p>
              )}
            </div>
            <ChevronRight size={13} className="shrink-0 text-text-disabled group-hover:text-brand-gold transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────
export default function SportsbookMainContent() {
  const router = useRouter();
  const [sports, setSports] = useState<SportInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetch('/api/odds-sports')
      .then(async (res) => {
        setIsDemoMode(res.headers.get('X-Demo-Mode') === 'true');
        return res.json();
      })
      .then((data: SportInfo[]) => setSports(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredSports = useMemo(() => {
    if (!search.trim()) return sports;
    const q = search.toLowerCase();
    return sports.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.group.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [sports, search]);

  // Group sports by category
  const sportGroups = useMemo((): SportGroup[] => {
    const map = new Map<string, SportInfo[]>();
    for (const sport of filteredSports) {
      if (!map.has(sport.group)) map.set(sport.group, []);
      map.get(sport.group)!.push(sport);
    }
    return Array.from(map.entries()).map(([group, sp]) => ({ group, sports: sp }));
  }, [filteredSports]);

  // Featured sports (first 10 for the horizontal rail)
  const featuredSports = useMemo(() => {
    const priority = ['soccer_epl', 'cricket_ipl', 'basketball_nba', 'americanfootball_nfl', 'cricket_test_match', 'soccer_uefa_champs_league', 'tennis_atp_french_open', 'icehockey_nhl', 'mma_mixed_martial_arts', 'baseball_mlb'];
    const prioritized = priority.map((k) => sports.find((s) => s.key === k)).filter(Boolean) as SportInfo[];
    const rest = sports.filter((s) => !priority.includes(s.key));
    return [...prioritized, ...rest].slice(0, 12);
  }, [sports]);

  const goToSport = (sport: SportInfo) => {
    router.push(`/sportsbook/${sport.key}?title=${encodeURIComponent(sport.title)}`);
  };

  return (
    <main className="min-h-full bg-bg-base text-text-primary">
      <div className="mx-auto flex w-full max-w-[1820px] flex-col gap-5 px-3 py-3 pb-[calc(var(--mobile-nav-height)+20px)] md:px-5 md:py-4 md:pb-8 xl:px-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold">
              <Globe size={18} />
            </div>
            <div>
              <h1 className="font-adx-bold text-[20px] leading-tight text-text-primary">Sportsbook</h1>
              <p className="text-[10px] text-text-muted">International odds from 40+ bookmakers</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen((c) => !c)}
            aria-label="Search sports"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg-elevated text-text-muted transition hover:bg-bg-hover hover:text-text-primary active:scale-90"
          >
            <Search size={18} />
          </button>
        </div>

        {/* ── Search bar ── */}
        {searchOpen && (
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search sports, leagues..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-white/[0.08] bg-bg-elevated py-2.5 pl-9 pr-4 text-[13px] text-text-primary placeholder:text-text-muted outline-none focus:border-brand-gold/40 transition-colors"
            />
          </div>
        )}

        {/* ── Demo mode notice ── */}
        {isDemoMode && (
          <div className="flex items-center gap-3 rounded-xl border border-brand-gold/20 bg-brand-gold/8 px-4 py-3">
            <Zap size={15} className="text-brand-gold shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-adx-bold text-brand-gold">Demo Mode — Sample Sports Listed</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                Add <code className="bg-bg-elevated px-1 rounded text-brand-gold">THE_ODDS_API_KEY</code> to <code className="bg-bg-elevated px-1 rounded text-brand-gold">.env.local</code> for live data from 40+ bookmakers.
              </p>
            </div>
          </div>
        )}

        {/* ── Hero banner ── */}
        <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#1a0f2e_0%,#0d1a2a_40%,#1a2a0d_100%)] border border-white/[0.06] px-5 py-6 shadow-[0_20px_48px_rgba(0,0,0,0.5)]">
          {/* Decoration orbs */}
          <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-brand-gold/8 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-success-alpha-10 blur-3xl pointer-events-none" />

          <div className="relative z-10 grid gap-4 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.06] px-2.5 py-1">
                <Activity size={10} className="text-success-bright" />
                <span className="text-[10px] font-adx-bold text-white/80">Live Odds Aggregator</span>
              </div>
              <h2 className="font-adx-bold text-[24px] leading-tight text-white md:text-[32px]">
                Compare odds from<br />
                <span className="text-brand-gold">40+ bookmakers</span>
              </h2>
              <p className="mt-2 text-[13px] text-white/60 max-w-sm">
                Always get the best price. We show you real-time odds from Betfair, Bet365, William Hill, DraftKings, and more.
              </p>
            </div>

            <div className="hidden lg:flex flex-col items-end justify-center gap-3">
              {[
                { label: 'Betfair', odds: '2.60', best: true },
                { label: 'Bet365', odds: '2.55', best: false },
                { label: 'William Hill', odds: '2.62', best: true },
              ].map(({ label, odds, best }) => (
                <div key={label} className={`flex items-center gap-3 rounded-xl border px-4 py-2 ${best ? 'border-brand-gold/40 bg-brand-gold/10' : 'border-white/[0.06] bg-white/[0.04]'}`}>
                  <span className="text-[11px] font-adx-bold text-white/70 w-24 text-right">{label}</span>
                  <span className={`text-[14px] font-adx-bold ${best ? 'text-brand-gold' : 'text-white/60'}`}>{odds}</span>
                  {best && <span className="text-[8px] font-adx-bold bg-brand-gold text-text-inverse px-1.5 py-0.5 rounded">BEST</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Featured sports rail ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-elevated">
              <TrendingUp size={14} className="text-brand-gold" />
            </div>
            <h2 className="font-adx-bold text-[16px] text-text-primary">Popular Sports</h2>
          </div>

          {loading ? (
            <div className="flex gap-3 overflow-x-auto py-1 scrollbar-none snap-x snap-mandatory">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="min-w-[140px] shrink-0 snap-start h-[90px] rounded-xl bg-bg-card skeleton-block skeleton-shimmer" />
              ))}
            </div>
          ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 py-1 scrollbar-none snap-x snap-mandatory">
              {featuredSports.map((sport) => (
                <FeaturedSportCard
                  key={sport.key}
                  sport={sport}
                  onClick={() => goToSport(sport)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── All sports by group ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-elevated">
              <Globe size={14} className="text-brand-gold" />
            </div>
            <h2 className="font-adx-bold text-[16px] text-text-primary">All Sports</h2>
            {!loading && (
              <span className="ml-1 rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-adx-bold text-text-muted">
                {sports.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SportCardSkeleton key={i} />
              ))}
            </div>
          ) : sportGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Search size={28} className="text-text-disabled" />
              <p className="text-text-muted text-sm">No sports matching &ldquo;{search}&rdquo;</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sportGroups.map((group) => (
                <SportGroupCard
                  key={group.group}
                  group={group}
                  onClick={goToSport}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
