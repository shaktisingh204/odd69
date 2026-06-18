'use client';

// ─────────────────────────────────────────────────────────────
// SportCard — upcoming/featured sport match card with market odds
// ─────────────────────────────────────────────────────────────

import OddsChip from './OddsChip';
import type { TopSport } from './types';

interface SportCardProps {
  sport: TopSport;
  onCardClick?: (matchId: string) => void;
  onOddsClick?: (matchId: string, label: string, value: string) => void;
}

export default function SportCard({
  sport,
  onCardClick,
  onOddsClick,
}: SportCardProps) {
  return (
    <article
      onClick={() => onCardClick?.(sport.matchId)}
      className="min-w-[200px] shrink-0 snap-start rounded-xl border border-white/[0.06] bg-bg-card p-3 shadow-[0_4px_16px_rgba(0,0,0,0.3)] sm:min-w-[240px] md:min-w-[260px] md:p-3.5 cursor-pointer hover:border-brand-gold/25 hover:shadow-soft active:scale-[0.98] transition-all duration-150"
    >

      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8B5CF6_0%,#7C3AED_100%)] text-[14px] shadow-[0_4px_10px_rgba(139,92,246,0.05)] flex-shrink-0">
          {sport.icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-[12px] font-adx-bold leading-tight text-text-primary line-clamp-2">
            {sport.competition}
          </h3>
          <p className="mt-0.5 text-[10px] text-text-muted">{sport.sport}</p>
        </div>
      </div>

      {/* Market */}
      <div className="mt-2.5 rounded-xl border border-white/[0.05] bg-bg-elevated p-2.5 md:p-3">
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span>Popular market</span>
          <span>Winner</span>
        </div>

        <div
          className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <OddsChip
            label={sport.marketA.label}
            value={sport.marketA.value}
            onClick={() => onOddsClick?.(sport.matchId, sport.marketA.label, sport.marketA.value)}
          />
          <OddsChip
            label={sport.marketB.label}
            value={sport.marketB.value}
            onClick={() => onOddsClick?.(sport.matchId, sport.marketB.label, sport.marketB.value)}
          />
          <button
            type="button"
            onClick={() => onCardClick?.(sport.matchId)}
            className="flex items-center justify-center rounded-lg border border-brand-gold/20 bg-brand-gold/8 px-2.5 py-1.5 text-[14px] font-adx-bold text-brand-gold transition-all hover:border-brand-gold/40 hover:bg-brand-gold/15 active:scale-95"
          >
            {sport.extra}
          </button>
        </div>
      </div>
    </article>
  );
}
