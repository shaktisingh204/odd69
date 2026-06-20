'use client';

// ─────────────────────────────────────────────────────────────
// SportCard — upcoming/featured sport match card with market odds (v2)
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
      className="min-w-[200px] shrink-0 snap-start rounded-2xl ring-1 ring-white/[0.06] bg-[#1a1510] p-3 shadow-[0_4px_16px_rgba(0,0,0,0.3)] sm:min-w-[240px] md:min-w-[260px] md:p-3.5 cursor-pointer hover:-translate-y-0.5 hover:ring-[#ff7a1a]/30 hover:shadow-[0_10px_28px_rgba(0,0,0,0.35)] active:scale-[0.98] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transform-none motion-reduce:transition-none"
    >

      {/* Header */}
      <div className="flex items-start gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[14px] shadow-[0_4px_10px_rgba(255,122,26,0.20)] flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#ff9a3d,#ff6a00)' }}
        >
          {sport.icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-[12px] font-extrabold leading-tight text-white line-clamp-2">
            {sport.competition}
          </h3>
          <p className="mt-0.5 text-[10px] text-white/55">{sport.sport}</p>
        </div>
      </div>

      {/* Market */}
      <div className="mt-2.5 rounded-2xl ring-1 ring-white/[0.05] bg-[#120e0a] p-2.5 md:p-3">
        <div className="flex items-center justify-between text-[10px] text-white/55">
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
            className="flex items-center justify-center rounded-lg border border-[#ff7a1a]/25 bg-[#ff7a1a]/[0.08] px-2.5 py-1.5 text-[14px] font-extrabold text-[#ff7a1a] outline-none transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-[#ff7a1a]/45 hover:bg-[#ff7a1a]/[0.16] focus-visible:border-[#ff7a1a]/45 focus-visible:bg-[#ff7a1a]/[0.16] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {sport.extra}
          </button>
        </div>
      </div>
    </article>
  );
}
