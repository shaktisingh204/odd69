'use client';

import Link from 'next/link';
import { Trophy, Activity, ChevronRight } from 'lucide-react';
import type { Event } from '@/services/sports';

// ─── Country → flag ───────────────────────────────────────────────────────────
import { useEarlySixMatches } from '@/hooks/useEarlySixMatches';
const FLAG_MAP: Record<string, string> = {
    IN: '🇮🇳', GB: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', AU: '🇦🇺', ZA: '🇿🇦', NZ: '🇳🇿', PK: '🇵🇰', WI: '🌴',
    BD: '🇧🇩', SL: '🇱🇰', AF: '🇦🇫', ZW: '🇿🇼', IE: '🇮🇪', NL: '🇳🇱',
    US: '🇺🇸', ES: '🇪🇸', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', BR: '🇧🇷', AR: '🇦🇷',
    JP: '🇯🇵', KR: '🇰🇷', CN: '🇨🇳', MX: '🇲🇽', CA: '🇨🇦', PT: '🇵🇹', SE: '🇸🇪',
    RU: '🇷🇺', TR: '🇹🇷', SA: '🇸🇦', AE: '🇦🇪', EG: '🇪🇬', KE: '🇰🇪', NG: '🇳🇬',
    TH: '🇹🇭', ID: '🇮🇩', MY: '🇲🇾', PH: '🇵🇭', VN: '🇻🇳', SG: '🇸🇬',
};
const getFlag = (code?: string) => code ? (FLAG_MAP[code.toUpperCase()] ?? null) : null;

/**
 * SportEventCard — display-only match card (same UI as the sports page).
 * No bet placement; clicking navigates to the match detail page.
 * Pass `teamIcons` (lowercase team_name → icon_url) to show uploaded logos.
 */
export default function SportEventCard({ match, teamIcons }: { match: Event; teamIcons?: Record<string, string> }) {
    const homeTeam = match.home_team || match.event_name?.split(' v ')[0] || match.event_name || '';
    const awayTeam = match.away_team || match.event_name?.split(' v ')[1] || '';
    const isLive   = match.match_status === 'In Play' || match.match_status === 'Live';
    const isDone   = match.match_status === 'Completed' || match.match_status === 'Ended';
    const flag     = getFlag(match.competition?.country_code);
    const homeIcon = teamIcons?.[homeTeam.toLowerCase().trim()];
    const awayIcon = teamIcons?.[awayTeam.toLowerCase().trim()];
    const earlySixIds = useEarlySixMatches();
    const hasEarlySix = earlySixIds.has(String(match.event_id));

    return (
        <Link
            href={`/sports/match/${match.event_id}`}
            className={`group relative flex flex-col bg-[#1a1510] rounded-2xl ring-1 overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none ${
                isLive ? 'ring-success-primary/20' : 'ring-white/[0.06]'
            }`}
        >
            {/* orange accent ring on hover / keyboard focus */}
            <div
                className="pointer-events-none absolute inset-0 z-20 rounded-2xl opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:opacity-100 group-focus-visible:opacity-100"
                style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,122,26,0.55)' }}
            />
            {/* live stripe */}
            {isLive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-success-primary/40 z-10" />}

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05]">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Trophy size={9} className="text-success-bright/50 flex-shrink-0" />
                    <span className="text-success-bright/60 text-[10px] font-semibold truncate">
                        {(match as any).competition_name || match.competition?.competition_name || ''}
                    </span>
                </div>
                {isLive ? (
                    <div className="flex items-center gap-1 bg-success-alpha-10 border border-success-primary/20 px-2 py-0.5 rounded-md flex-shrink-0 ml-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-success-primary animate-pulse" />
                        <span className="text-success-bright text-[9px] font-black">LIVE</span>
                    </div>
                ) : isDone ? (
                    <span className="text-white/20 text-[9px] font-bold ml-2 flex-shrink-0">ENDED</span>
                ) : (
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Activity size={8} className="text-white/25" />
                        <span className="text-white/25 text-[9px] font-semibold">{match.match_status || 'Upcoming'}</span>
                    </div>
                )}
            </div>

            {hasEarlySix && (
                <div className="flex justify-center mt-1 -mb-1 relative z-10">
                    <span
                        className="text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-lg shadow-[0_0_8px_rgba(255,122,26,0.3)] border border-[#ff7a1a]/30 w-full mx-3 text-center"
                        style={{ background: 'linear-gradient(135deg,#ff9a3d,#ff6a00)' }}
                    >
                        🎯 Early 6 Refund Offer
                    </span>
                </div>
            )}

            {/* Teams */}
            <div className="px-3 py-2.5 flex flex-col gap-2 flex-1">
                {/* Home */}
                <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.04] border overflow-hidden ${isLive ? 'border-success-primary/15' : 'border-white/[0.06]'}`}>
                        {homeIcon
                            ? <img src={homeIcon} alt="" className="w-full h-full object-contain p-0.5" />
                            : flag
                                ? <span className="text-sm leading-none">{flag}</span>
                                : <span className="text-[10px] font-black text-white/40">{homeTeam.substring(0, 2).toUpperCase()}</span>
                        }
                    </div>
                    <span className="flex-1 text-white text-[13px] font-bold truncate">{homeTeam}</span>
                    {match.score1 != null && (
                        <span className={`text-base font-black min-w-[24px] text-right ${isLive ? 'text-success-bright' : 'text-white'}`}>
                            {match.score1}
                        </span>
                    )}
                </div>

                {/* VS */}
                <div className="flex items-center gap-2 pl-2">
                    <div className="flex-1 h-px bg-white/[0.04]" />
                    <span className="text-[8px] font-black text-white/15">VS</span>
                    <div className="flex-1 h-px bg-white/[0.04]" />
                </div>

                {/* Away */}
                {awayTeam && (
                    <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.04] border overflow-hidden ${isLive ? 'border-success-primary/15' : 'border-white/[0.06]'}`}>
                            {awayIcon
                                ? <img src={awayIcon} alt="" className="w-full h-full object-contain p-0.5" />
                                : flag
                                    ? <span className="text-sm leading-none">{flag}</span>
                                    : <span className="text-[10px] font-black text-white/40">{awayTeam.substring(0, 2).toUpperCase()}</span>
                            }
                        </div>
                        <span className="flex-1 text-white text-[13px] font-bold truncate">{awayTeam}</span>
                        {match.score2 != null && (
                            <span className={`text-base font-black min-w-[24px] text-right ${isLive ? 'text-success-bright' : 'text-white'}`}>
                                {match.score2}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Match Odds / View footer */}
            {(match as any).match_odds?.length > 0 ? (
                <div className="px-2.5 pb-2.5 pt-1.5">
                    <div className="flex items-center gap-0.5 mb-1.5">
                        <ChevronRight size={9} className="text-white/20" />
                        <span className="text-[9px] font-black text-white/25 uppercase tracking-wider">Match Odds</span>
                    </div>
                    <div className="flex gap-1">
                        {(match as any).match_odds.map((o: any, i: number) => (
                            <div
                                key={i}
                                className="flex-1 flex flex-col items-center py-1.5 px-1 rounded-lg min-w-0 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none"
                                style={
                                    o.back
                                        ? { backgroundColor: 'rgba(255,122,26,0.12)', border: '1px solid rgba(255,122,26,0.28)' }
                                        : { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }
                                }
                            >
                                <span className="text-[8px] text-white/55 font-semibold truncate w-full text-center leading-none mb-1">
                                    {o.name}
                                </span>
                                <span className="text-[13px] font-black leading-none" style={{ color: o.back ? '#ff7a1a' : 'rgba(255,255,255,0.2)' }}>
                                    {o.back ?? '-'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-end px-3 py-2 border-t border-white/[0.05]">
                    <div className="flex items-center gap-1 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none">
                        <span className="text-[#ff7a1a] text-[10px] font-black">View</span>
                        <ChevronRight size={10} className="text-[#ff7a1a]" />
                    </div>
                </div>
            )}
        </Link>
    );
}
