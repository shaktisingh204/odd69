'use client';

interface LeagueCardProps {
  competitionId: string;
  competitionName: string;
  sportEmoji: string;
  sportLabel: string;
  imageUrl?: string;
  eventCount: number;
  liveCount: number;
  onClick?: () => void;
}

export default function LeagueCard({
  competitionName,
  sportEmoji,
  sportLabel,
  imageUrl,
  eventCount,
  liveCount,
  onClick,
}: LeagueCardProps) {
  const isLive = liveCount > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-[150px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1a1d22] transition-all duration-200 hover:border-brand-gold/30 hover:shadow-[0_8px_28px_rgba(0,0,0,0.35)] active:scale-[0.97] cursor-pointer select-none sm:w-[170px]"
    >
      {/* Banner — full bleed image or gradient */}
      <div className="relative h-[90px] w-full overflow-hidden sm:h-[100px]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={competitionName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-gold/10 via-[#1a1d22] to-[#141720]">
            <span className="text-4xl leading-none opacity-60 group-hover:scale-110 transition-transform duration-200 drop-shadow-lg">
              {sportEmoji}
            </span>
          </div>
        )}

        {/* Dark gradient overlay bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1d22] via-transparent to-transparent" />

        {/* Badges row — top */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between">
          {/* Live badge */}
          {isLive ? (
            <span className="flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-md border border-rose-500/30 px-2 py-0.5 text-[9px] font-adx-bold text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              {liveCount} Live
            </span>
          ) : (
            <span />
          )}

          {/* Event count pill */}
          <span className="rounded-full bg-black/50 backdrop-blur-md px-2 py-0.5 text-[9px] font-adx-bold text-white/80 tabular-nums">
            {eventCount} {eventCount === 1 ? 'match' : 'matches'}
          </span>
        </div>
      </div>

      {/* Info area */}
      <div className="flex flex-col gap-1 px-3 py-3">
        <p className="line-clamp-2 text-left text-[12px] font-adx-bold leading-[1.25] text-white group-hover:text-brand-gold transition-colors duration-150 sm:text-[13px]">
          {competitionName}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] leading-none">{sportEmoji}</span>
          <p className="text-left text-[10px] text-white/40 leading-none sm:text-[11px]">
            {sportLabel}
          </p>
        </div>
      </div>
    </button>
  );
}
