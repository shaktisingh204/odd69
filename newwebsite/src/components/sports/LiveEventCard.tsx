'use client';

import type { LiveEvent, TeamRow } from './types';

interface LiveEventCardProps {
  event: LiveEvent;
  onCardClick?: (matchId: string) => void;
  onOddsClick?: (matchId: string, oddLabel: string, oddValue: string) => void;
  /** 'rail' = horizontal scroll card (default). 'grid' = fills its CSS grid column. */
  variant?: 'rail' | 'grid';
}

// ─── Country code → flag URL mapping ────────────────────────────────────────
const COUNTRY_FLAGS: Record<string, string> = {};
function getFlagUrl(code?: string) {
  if (!code) return null;
  const c = code.toLowerCase();
  return `https://flagcdn.com/w320/${c}.png`;
}

// Team avatar with fallback chain: uploaded icon → country flag → initials
function TeamAvatar({ team }: { team?: TeamRow }) {
  if (!team) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-[10px] font-adx-bold text-white/60 backdrop-blur-sm">
        ??
      </div>
    );
  }
  if (team.iconUrl) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.06] backdrop-blur-sm">
        <img src={team.iconUrl} alt={team.name} className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }
  if (team.flag) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-lg leading-none backdrop-blur-sm">
        {team.flag}
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-[10px] font-adx-bold text-white/60 backdrop-blur-sm">
      {team.initials ?? '??'}
    </div>
  );
}

function getSportGlyph(sport: string) {
  const lower = sport.toLowerCase();
  if (lower.includes('cricket')) return '🏏';
  if (lower.includes('soccer')) return '⚽';
  if (lower.includes('basketball')) return '🏀';
  if (lower.includes('tennis')) return '🎾';
  if (lower.includes('hockey')) return '🏒';
  if (lower.includes('baseball')) return '⚾';
  if (lower.includes('football')) return '🏈';
  if (lower.includes('mma') || lower.includes('boxing')) return '🥊';
  if (lower.includes('golf')) return '⛳';
  return '🏟️';
}

/** Resolve a competition badge — 🌍 for international, country flag, or abbreviation */
function getCompetitionBadge(competition: string, country?: string): string {
  const lower = competition.toLowerCase();
  if (lower.includes('international') || lower.includes('intl') || lower.includes('world cup') || lower.includes('world series')) return '🌍';
  if (lower.includes('ipl') || lower.includes('indian premier')) return '🇮🇳';
  if (lower.includes('premier league') && !lower.includes('indian')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (lower.includes('la liga') || lower.includes('spain')) return '🇪🇸';
  if (lower.includes('bundesliga') || lower.includes('germany')) return '🇩🇪';
  if (lower.includes('serie a') || lower.includes('italy')) return '🇮🇹';
  if (lower.includes('ligue 1') || lower.includes('france')) return '🇫🇷';
  if (lower.includes('champions league') || lower.includes('europa') || lower.includes('uefa')) return '🇪🇺';
  if (lower.includes('australia')) return '🇦🇺';
  if (lower.includes('south africa')) return '🇿🇦';
  if (lower.includes('pakistan') || lower.includes('psl')) return '🇵🇰';
  if (lower.includes('bangladesh') || lower.includes('bpl')) return '🇧🇩';
  if (lower.includes('caribbean') || lower.includes('cpl') || lower.includes('west indies')) return '🌴';
  if (lower.includes('new zealand')) return '🇳🇿';
  if (lower.includes('england') || lower.includes('county') || lower.includes('the hundred')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (lower.includes('asia') || lower.includes('asian')) return '🌏';
  if (lower.includes('africa')) return '🌍';
  if (lower.includes('america') || lower.includes('mls') || lower.includes('nba') || lower.includes('nfl') || lower.includes('mlb')) return '🇺🇸';
  if (lower.includes('japan') || lower.includes('npb')) return '🇯🇵';
  if (lower.includes('korea')) return '🇰🇷';
  if (lower.includes('china')) return '🇨🇳';
  if (lower.includes('copa') || lower.includes('libertadores')) return '🌎';
  return '🏆';
}

/** Shorten competition name for card header — keep it readable */
function shortenCompetition(name: string): string {
  // Cap at ~30 chars with ellipsis
  if (name.length > 30) return name.slice(0, 29).trimEnd() + '…';
  return name;
}

function OddsChip({
  label, value, onClick,
}: { label: string; value: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-black/30 backdrop-blur-sm px-2 py-2 transition-all hover:bg-black/40 active:scale-[0.97] border border-white/[0.08]"
    >
      <span className="text-[11px] font-semibold text-brand-gold">{label}</span>
      <span className="text-[13px] font-adx-bold tabular-nums text-white">
        {value === '-' ? '—' : value}
      </span>
    </button>
  );
}

function ExtraChip({ value, onClick }: { value: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center rounded-lg bg-black/30 backdrop-blur-sm px-3 py-2 text-[13px] font-adx-bold text-white transition-all hover:bg-black/40 active:scale-[0.97] border border-white/[0.08]"
    >
      {value}
    </button>
  );
}

// Determine the best background: team images → thumbnail → country flags → null
type CardBg =
  | { type: 'split'; img1: string; img2: string }
  | { type: 'single'; url: string }
  | { type: 'flags' }
  | { type: 'none' };

function resolveCardBg(event: LiveEvent): CardBg {
  // 1. Two admin-uploaded team images → "/" split style (highest priority)
  if (event.team1Image && event.team2Image) {
    return { type: 'split', img1: event.team1Image, img2: event.team2Image };
  }

  // 2. Legacy single thumbnail
  if (event.thumbnail) {
    return { type: 'single', url: event.thumbnail };
  }

  // 3. Country flag fallback for international matches
  const homeFlag = event.teams[0]?.flag;
  const awayFlag = event.teams[1]?.flag;
  if (homeFlag && awayFlag) {
    return { type: 'flags' };
  }

  // 4. Country code flag
  if (event.country) {
    const flagUrl = getFlagUrl(event.country);
    if (flagUrl) return { type: 'single', url: flagUrl };
  }

  return { type: 'none' };
}

export default function LiveEventCard({ event, onCardClick, onOddsClick, variant = 'rail' }: LiveEventCardProps) {
  const homeTeam = event.teams[0];
  const awayTeam = event.teams[1];
  const isLive = event.isLive;
  const isInPlay = event.isInPlay;
  const glyph = getSportGlyph(event.sport);
  const compBadge = getCompetitionBadge(event.competition, event.country);
  const compName = shortenCompetition(event.competition);
  const oddsButtons = event.extra ? event.odds.slice(0, 2) : event.odds.slice(0, 3);
  const cardBg = resolveCardBg(event);

  const homeFlag = homeTeam?.flag;
  const awayFlag = awayTeam?.flag;

  const railClasses = 'min-w-[320px] shrink-0 snap-start sm:min-w-[340px] h-[240px]';
  const gridClasses = 'w-full min-w-0 h-[240px]';

  return (
    <article
      onClick={() => onCardClick?.(event.matchId)}
      className={`${
        variant === 'grid' ? gridClasses : railClasses
      } relative cursor-pointer overflow-hidden rounded-xl border border-white/[0.06] shadow-card transition-all duration-150 hover:border-white/[0.14] active:scale-[0.985]`}
    >
      {/* ── Background layer ── */}
      {cardBg.type === 'split' ? (
        <>
          {/* Player images pinned to bottom-left and bottom-right */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#2a1a3e] to-[#1a1225]" />
          <div className="absolute bottom-0 left-0 h-[70%] w-[35%]">
            <img src={cardBg.img1} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
          </div>
          <div className="absolute bottom-0 right-0 h-[70%] w-[35%]">
            <img src={cardBg.img2} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
          </div>
          {/* Subtle overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60" />
        </>
      ) : cardBg.type === 'single' ? (
        <>
          {/* Single thumbnail / flag image — blurred and tinted */}
          <div className="absolute inset-0">
            <img
              src={cardBg.url}
              alt=""
              className="h-full w-full object-cover blur-[20px] scale-110"
              loading="lazy"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/80 backdrop-saturate-150" />
        </>
      ) : cardBg.type === 'flags' ? (
        <>
          {/* Flag emoji fallback — large blurred flags as background */}
          <div className="absolute inset-0 flex items-center justify-between px-6 opacity-[0.12]">
            <span className="text-[80px] blur-[2px] select-none">{homeFlag}</span>
            <span className="text-[80px] blur-[2px] select-none">{awayFlag}</span>
          </div>
          <div className="absolute inset-0 bg-[#1c1f24]/90" />
        </>
      ) : (
        /* Default dark background */
        <div className="absolute inset-0 bg-[#1c1f24]" />
      )}

      {/* ── Content (above bg) ── */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header: Sport glyph + flag/badge + competition name + Live */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] shrink-0 leading-none">{glyph}</span>
            <span className="shrink-0 text-[11px] font-bold text-white/80 leading-none">{event.sport}</span>
            <span className="shrink-0 text-white/20 text-[10px] leading-none">•</span>
            <span className="text-[11px] shrink-0 leading-none">{compBadge}</span>
            <span className="truncate text-[11px] font-medium text-white/50 leading-none">
              {compName}
            </span>
          </div>
          {(isLive || isInPlay) && (
            <div className="relative z-10 flex items-center gap-1 ml-1.5 shrink-0 rounded-full bg-red-500/15 border border-red-500/25 px-2 py-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </span>
              <span className="text-[10px] font-bold text-red-400">Live</span>
            </div>
          )}
        </div>

        {/* Teams + Score Center */}
        <div className="px-4 py-3 flex-1 flex items-center">
          <div className="flex items-center justify-between w-full">
            {/* Home team */}
            <div className="flex flex-col items-center gap-1.5 w-[85px]">
              <TeamAvatar team={homeTeam} />
              <span className="text-[11px] font-semibold text-white/90 truncate w-full text-center leading-tight drop-shadow-sm">
                {homeTeam?.name ?? 'Home'}
              </span>
            </div>

            {/* Score / Status */}
            <div className="flex flex-col items-center gap-1 shrink-0 mx-2">
              <div className="flex items-center gap-2">
                <span className="text-xl font-adx-bold text-white tabular-nums drop-shadow-sm">
                  {homeTeam?.pill?.trim() || '0'}
                </span>
                <span className="text-lg font-medium text-white/40">:</span>
                <span className="text-xl font-adx-bold text-white tabular-nums drop-shadow-sm">
                  {awayTeam?.pill?.trim() || '0'}
                </span>
              </div>
              <span className="text-[10px] font-medium text-white/50">
                {event.status}
              </span>
            </div>

            {/* Away team */}
            <div className="flex flex-col items-center gap-1.5 w-[85px]">
              <TeamAvatar team={awayTeam} />
              <span className="text-[11px] font-semibold text-white/90 truncate w-full text-center leading-tight drop-shadow-sm">
                {awayTeam?.name ?? 'Away'}
              </span>
            </div>
          </div>
        </div>

        {/* Odds row — equal width buttons */}
        <div className="flex items-center gap-1.5 px-3 pb-3 mt-auto" onClick={(e) => e.stopPropagation()}>
          {oddsButtons.map((odd) => (
            <OddsChip
              key={odd.label}
              label={odd.label}
              value={odd.value}
              onClick={() => onOddsClick?.(event.matchId, odd.label, odd.value)}
            />
          ))}
          {event.extra ? (
            <ExtraChip value={event.extra} onClick={() => onCardClick?.(event.matchId)} />
          ) : null}
        </div>
      </div>
    </article>
  );
}
