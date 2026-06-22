'use client';

// ─────────────────────────────────────────────────────────────
// SportsbookOddsContent — per-sport odds listing page
// Route: /sportsbook/[sport]
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, RefreshCw, SlidersHorizontal, Globe } from 'lucide-react';
import Link from 'next/link';
import OddsCompareCard from './OddsCompareCard';
import type { OddsEvent, OddsFormat, OddsMarketKey, OddsRegion } from './types';

interface SportsbookOddsContentProps {
  sportKey: string;
  sportTitle: string;
}

const MARKETS: { key: OddsMarketKey; label: string }[] = [
  { key: 'h2h', label: 'Match Winner' },
  { key: 'spreads', label: 'Handicap' },
  { key: 'totals', label: 'Over/Under' },
];

const REGIONS: { key: OddsRegion; label: string; flag: string }[] = [
  { key: 'eu', label: 'Europe', flag: '🇪🇺' },
  { key: 'uk', label: 'UK', flag: '🇬🇧' },
  { key: 'us', label: 'United States', flag: '🇺🇸' },
  { key: 'au', label: 'Australia', flag: '🇦🇺' },
];

// Popular bookmaker display order
const BOOKMAKER_PRIORITY = [
  'betfair', 'bet365', 'williamhill', 'unibet', 'betway', 'bwin',
  'draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbetus',
  'bovada', 'betonlineag', 'pinnacle', 'matchbook',
];

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-bg-card">
      <div className="skeleton-block skeleton-shimmer h-10 w-full rounded-none border-b border-white/[0.05]" />
      <div className="px-4 py-3">
        <div className="skeleton-block skeleton-shimmer h-4 w-2/3 rounded-lg mb-2" />
        <div className="skeleton-block skeleton-shimmer h-4 w-1/2 rounded-lg" />
      </div>
      <div className="px-4 pb-4 flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-block skeleton-shimmer h-10 flex-1 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function SportsbookOddsContent({ sportKey, sportTitle }: SportsbookOddsContentProps) {
  const [events, setEvents] = useState<OddsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [market, setMarket] = useState<OddsMarketKey>('h2h');
  const [region, setRegion] = useState<OddsRegion>('eu');
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>('decimal');
  const [showFilters, setShowFilters] = useState(false);

  const fetchOdds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/odds-events?sport=${encodeURIComponent(sportKey)}&region=${region}&market=${market}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: OddsEvent[] = await res.json();
      setEvents(data);
      setIsDemoMode(res.headers.get('X-Demo-Mode') === 'true');
      setLastUpdate(new Date());
    } catch (e) {
      setError('Unable to load odds. Please try again.');
      console.error('[SportsbookOddsContent]', e);
    } finally {
      setLoading(false);
    }
  }, [sportKey, region, market]);

  useEffect(() => {
    fetchOdds();
  }, [fetchOdds]);

  // Collect all bookmakers appearing across events, sorted by priority
  const allBookmakers = useMemo(() => {
    const bmSet = new Set<string>();
    for (const event of events) {
      for (const bm of event.bookmakers) bmSet.add(bm.key);
    }
    const sorted = [...bmSet].sort((a, b) => {
      const ai = BOOKMAKER_PRIORITY.indexOf(a);
      const bi = BOOKMAKER_PRIORITY.indexOf(b);
      const av = ai === -1 ? 999 : ai;
      const bv = bi === -1 ? 999 : bi;
      return av - bv;
    });
    // Show max 5 bookmakers by default to avoid overflow
    return sorted.slice(0, 5);
  }, [events]);

  const handleOddsClick = (event: OddsEvent, outcomeName: string, price: number, bookmaker: string) => {
    // For now, show a toast-style alert — betting integration can be wired in later
    console.log('[Bet intent]', { event, outcomeName, price, bookmaker });
    // TODO: integrate with your existing betslip / RightSidebar
  };

  return (
    <main className="min-h-full bg-bg-base text-text-primary">
      <div className="mx-auto flex w-full max-w-[1820px] flex-col gap-4 px-3 py-3 pb-[calc(var(--mobile-nav-height)+20px)] md:px-5 md:py-4 md:pb-8 xl:px-6">

        {/* ── Breadcrumb + back ── */}
        <div className="flex items-center gap-2">
          <Link
            href="/sportsbook"
            className="flex items-center gap-1.5 rounded-lg bg-bg-elevated px-3 py-1.5 text-[12px] font-adx-bold text-text-muted transition hover:bg-bg-hover hover:text-text-primary active:scale-95"
          >
            <ChevronLeft size={14} />
            Sportsbook
          </Link>
          <span className="text-text-disabled text-[12px]">/</span>
          <span className="text-[12px] font-adx-bold text-text-primary">{sportTitle}</span>

          {isDemoMode && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-2.5 py-1 text-[10px] font-adx-bold text-brand-gold">
              Demo Data — Add API Key for Live Odds
            </span>
          )}
        </div>

        {/* ── Page header ── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-adx-bold text-[22px] leading-tight text-text-primary md:text-[28px]">
              {sportTitle}
            </h1>
            {lastUpdate && (
              <p className="text-[11px] text-text-muted">
                Updated {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Odds format toggle */}
            <div className="flex items-center rounded-xl bg-bg-elevated p-1 gap-1">
              {(['decimal', 'fractional'] as OddsFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOddsFormat(f)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-adx-bold transition-all ${
                    oddsFormat === f
                      ? 'bg-brand-gold text-text-inverse shadow-[0_2px_8px_rgba(255, 122, 26,0.06)]'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {f === 'decimal' ? 'Dec' : 'Frac'}
                </button>
              ))}
            </div>

            {/* Filter toggle */}
            <button
              type="button"
              onClick={() => setShowFilters((c) => !c)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-adx-bold transition-all ${
                showFilters
                  ? 'bg-brand-gold text-text-inverse'
                  : 'bg-bg-elevated text-text-muted hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              <SlidersHorizontal size={13} />
              Filters
            </button>

            {/* Refresh */}
            <button
              type="button"
              onClick={fetchOdds}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-elevated text-text-muted transition hover:bg-bg-hover hover:text-text-primary active:scale-90 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Filters panel ── */}
        {showFilters && (
          <div className="rounded-xl border border-white/[0.06] bg-bg-card p-4 space-y-4">
            {/* Market selector */}
            <div>
              <p className="text-[10px] font-adx-bold text-text-muted uppercase tracking-wider mb-2">Market</p>
              <div className="flex flex-wrap gap-2">
                {MARKETS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMarket(m.key)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-adx-bold transition-all active:scale-95 ${
                      market === m.key
                        ? 'bg-brand-gold text-text-inverse shadow-[0_4px_14px_rgba(255, 122, 26,0.06)]'
                        : 'bg-bg-elevated text-text-muted hover:bg-bg-hover hover:text-text-primary'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Region selector */}
            <div>
              <p className="text-[10px] font-adx-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <Globe size={10} />
                Region / Bookmakers
              </p>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRegion(r.key)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-adx-bold transition-all active:scale-95 ${
                      region === r.key
                        ? 'bg-brand-gold text-text-inverse shadow-[0_4px_14px_rgba(255, 122, 26,0.06)]'
                        : 'bg-bg-elevated text-text-muted hover:bg-bg-hover hover:text-text-primary'
                    }`}
                  >
                    {r.flag} {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Events list ── */}
        {error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10 text-danger">
              <RefreshCw size={28} />
            </div>
            <p className="text-text-secondary text-center max-w-xs">{error}</p>
            <button
              type="button"
              onClick={fetchOdds}
              className="rounded-xl bg-brand-gold px-5 py-2 text-[13px] font-adx-bold text-text-inverse transition hover:bg-brand-gold-hover active:scale-95"
            >
              Try Again
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-elevated text-text-muted">
              <Globe size={28} />
            </div>
            <div className="text-center">
              <p className="font-adx-bold text-text-primary text-lg">No Events Found</p>
              <p className="text-text-muted text-sm mt-1">
                No upcoming events available for {sportTitle}. Try a different region.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-text-muted">
              {events.length} upcoming event{events.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {events.map((event) => (
                <OddsCompareCard
                  key={event.id}
                  event={event}
                  format={oddsFormat}
                  visibleBookmakers={allBookmakers}
                  onOddsClick={handleOddsClick}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
