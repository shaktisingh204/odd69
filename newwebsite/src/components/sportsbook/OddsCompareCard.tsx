'use client';

// ─────────────────────────────────────────────────────────────
// OddsCompareCard – one event row with multi-bookmaker odds comparison
// ─────────────────────────────────────────────────────────────

import { Clock, TrendingUp } from 'lucide-react';
import type { OddsEvent, OddsFormat, BestOddsMap } from './types';

interface OddsCompareCardProps {
  event: OddsEvent;
  format: OddsFormat;
  visibleBookmakers: string[];
  onOddsClick?: (event: OddsEvent, outcomeName: string, price: number, bookmaker: string) => void;
}

// Convert decimal odds to fractional string (e.g. 2.5 → "3/2")
function toFractional(decimal: number): string {
  const fraction = decimal - 1;
  // Find a good denominator (max 20 iterations)
  for (let d = 1; d <= 100; d++) {
    const n = Math.round(fraction * d);
    if (Math.abs(n / d - fraction) < 0.005) {
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const g = gcd(n, d);
      return `${n / g}/${d / g}`;
    }
  }
  return `${fraction.toFixed(2)}/1`;
}

function formatOdds(price: number, format: OddsFormat): string {
  if (format === 'fractional') return toFractional(price);
  return price.toFixed(2);
}

function formatMatchTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH = diffMs / 3600000;

  if (diffH < 0) return 'Live';
  if (diffH < 1) return `${Math.round(diffH * 60)}m`;
  if (diffH < 24) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function isLive(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export default function OddsCompareCard({ event, format, visibleBookmakers, onOddsClick }: OddsCompareCardProps) {
  // Get all outcomes from first bookmaker available (they all have the same teams)
  const allOutcomes = event.bookmakers[0]?.markets[0]?.outcomes ?? [];

  // Build best-odds map across all bookmakers
  const bestOddsMap: BestOddsMap = {};
  for (const bm of event.bookmakers) {
    const market = bm.markets[0];
    if (!market) continue;
    for (const outcome of market.outcomes) {
      const current = bestOddsMap[outcome.name];
      if (!current || outcome.price > current.price) {
        bestOddsMap[outcome.name] = { bookmaker: bm.key, price: outcome.price };
      }
    }
  }

  const live = isLive(event.commence_time);

  // Get odds for a specific bookmaker + outcome
  const getOdds = (bmKey: string, outcomeName: string): number | null => {
    const bm = event.bookmakers.find((b) => b.key === bmKey);
    if (!bm) return null;
    const market = bm.markets[0];
    if (!market) return null;
    const outcome = market.outcomes.find((o) => o.name === outcomeName);
    return outcome?.price ?? null;
  };

  const isBest = (bmKey: string, outcomeName: string, price: number): boolean => {
    return bestOddsMap[outcomeName]?.bookmaker === bmKey && price === bestOddsMap[outcomeName]?.price;
  };

  return (
    <article className="overflow-hidden rounded-xl border border-white/[0.06] bg-bg-card shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all hover:border-brand-gold/[0.15] hover:shadow-[0_8px_28px_rgba(0,0,0,0.4)]">
      {/* Event header */}
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/25 bg-danger/10 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
              <span className="text-[10px] font-adx-bold text-danger">LIVE</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
              <Clock size={10} className="shrink-0" />
              {formatMatchTime(event.commence_time)}
            </span>
          )}
          <span className="text-[11px] text-text-muted truncate">{event.sport_title}</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] text-text-disabled shrink-0">
          <TrendingUp size={10} />
          {event.bookmakers.length} bookmakers
        </span>
      </div>

      {/* Teams row */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-adx-bold text-text-primary truncate">{event.home_team}</p>
          </div>
          <div className="shrink-0 text-[11px] font-adx-bold text-text-muted bg-bg-elevated px-2 py-1 rounded-lg">
            vs
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-[13px] font-adx-bold text-text-primary truncate">{event.away_team}</p>
          </div>
        </div>
      </div>

      {/* Odds grid */}
      {visibleBookmakers.length > 0 && allOutcomes.length > 0 && (
        <div className="border-t border-white/[0.04] px-3 pb-3 pt-2">
          {/* Header row: bookmaker names */}
          <div
            className="grid gap-1.5 mb-1.5"
            style={{ gridTemplateColumns: `140px repeat(${visibleBookmakers.length}, 1fr)` }}
          >
            <div /> {/* empty cell for outcome name column */}
            {visibleBookmakers.map((bmKey) => {
              const bm = event.bookmakers.find((b) => b.key === bmKey);
              return (
                <div key={bmKey} className="text-center">
                  <span className="text-[9px] font-adx-bold text-text-disabled uppercase tracking-wider">
                    {bm?.title ?? bmKey}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Outcome rows */}
          {allOutcomes.map((outcome) => (
            <div
              key={outcome.name}
              className="grid gap-1.5 mb-1"
              style={{ gridTemplateColumns: `140px repeat(${visibleBookmakers.length}, 1fr)` }}
            >
              {/* Outcome name */}
              <div className="flex items-center">
                <span className="text-[11px] font-adx-bold text-text-secondary truncate pr-2">
                  {outcome.name}
                </span>
              </div>

              {/* Odds chips per bookmaker */}
              {visibleBookmakers.map((bmKey) => {
                const price = getOdds(bmKey, outcome.name);
                if (price === null) {
                  return (
                    <div key={bmKey} className="flex items-center justify-center rounded-lg bg-bg-elevated/50 py-1.5">
                      <span className="text-[10px] text-text-disabled">—</span>
                    </div>
                  );
                }

                const best = isBest(bmKey, outcome.name, price);
                return (
                  <button
                    key={bmKey}
                    type="button"
                    onClick={() => onOddsClick?.(event, outcome.name, price, bmKey)}
                    className={`relative flex items-center justify-center rounded-lg border py-1.5 px-1 transition-all active:scale-95 ${
                      best
                        ? 'border-brand-gold/50 bg-brand-gold/12 shadow-[0_0_12px_rgba(255, 122, 26,0.04)] hover:bg-brand-gold/20'
                        : 'border-white/[0.06] bg-bg-elevated hover:border-brand-gold/25 hover:bg-bg-hover'
                    }`}
                  >
                    {best && (
                      <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-gold px-1.5 py-px text-[7px] font-adx-bold text-text-inverse leading-none">
                        BEST
                      </span>
                    )}
                    <span className={`text-[12px] font-adx-bold ${best ? 'text-brand-gold' : 'text-text-primary'}`}>
                      {formatOdds(price, format)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
