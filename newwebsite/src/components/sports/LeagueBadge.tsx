'use client';

import type { FeaturedLeague } from './types';

interface LeagueBadgeProps {
  league: FeaturedLeague;
  onClick?: () => void;
}

export default function LeagueBadge({ league, onClick }: LeagueBadgeProps) {
  const hasLive     = (league.liveCount ?? 0) > 0;
  const hasUpcoming = (league.upcomingCount ?? 0) > 0;
  const total       = (league.liveCount ?? 0) + (league.upcomingCount ?? 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-[90px] shrink-0 flex-col items-center gap-2 text-center transition-all active:scale-90 cursor-pointer select-none sm:w-[105px]"
    >
      {/* Live pulse dot */}
      {hasLive && (
        <span className="absolute right-1 top-0 z-10 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500 border-[2px] border-[#0f1115]" />
        </span>
      )}

      {/* Circular icon with gradient ring */}
      <div className="transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
        <div
          className={`mx-auto flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full p-[2.5px] shadow-[0_4px_16px_rgba(0,0,0,0.4)] sm:h-[74px] sm:w-[74px] bg-gradient-to-br ${league.ringClass}`}
        >
          <div
            className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br font-adx-bold leading-tight transition-all duration-200 group-hover:brightness-110 ${league.badgeClass}`}
            style={{ fontSize: league.badge.length > 4 ? '12px' : league.badge.length > 2 ? '16px' : '28px' }}
          >
            {league.badge}
          </div>
        </div>
      </div>

      {/* Label */}
      <p className="text-[11px] font-adx-bold leading-[1.2] tracking-[-0.01em] text-white/70 group-hover:text-white transition-colors line-clamp-1 w-full sm:text-[12px]">
        {league.title.replace(/\n/g, ' ')}
      </p>

      {/* Count pills */}
      {total > 0 && (
        <div className="flex flex-wrap justify-center gap-1 -mt-1">
          {hasLive && (
            <span className="flex items-center gap-0.5 rounded-full bg-danger-alpha-16 px-1.5 py-[3px] text-[8px] font-adx-bold leading-none text-danger">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 animate-pulse" />
              {league.liveCount}
            </span>
          )}
          {hasUpcoming && (
            <span className="rounded-full bg-white/[0.06] px-1.5 py-[3px] text-[8px] font-adx-bold leading-none text-white/40">
              {league.upcomingCount}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
