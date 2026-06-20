'use client';

import { useRouter } from 'next/navigation';
import { Activity, ChevronRight, Zap, Shield } from 'lucide-react';
import type { Event, MatchOddSummary } from '@/services/sports';
import { useEarlySixMatches } from '@/hooks/useEarlySixMatches';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SRRunner {
    runnerId: string;
    runnerName: string;
    status: string;
    backPrices: Array<{ price: number; size: number }>;
    layPrices: Array<{ price: number; size: number }>;
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name?: string) {
    if (!name) return '??';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function TeamAvatar({ name, isLive, score }: { name: string; isLive: boolean; score?: number | string | null }) {
    return (
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[11px] font-black border transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                    isLive
                        ? 'bg-[#ff7a1a]/12 border-[#ff7a1a]/30 text-[#ff9a3d]'
                        : 'bg-white/[0.06] border-white/[0.08] text-white/50'
                }`}
            >
                {getInitials(name)}
            </div>
            <span className="flex-1 text-[13px] font-bold text-text-white truncate">{name}</span>
            {score != null && (
                <span className={`text-[15px] font-black min-w-[24px] text-right tabular-nums ${isLive ? 'text-[#ff9a3d]' : 'text-white/60'}`}>
                    {score}
                </span>
            )}
        </div>
    );
}

// ─── Odds Button (SR style — one price chip per runner) ───────────────────────
function OddsButton({
    label,
    price,
    disabled,
    pending,
    onClick,
}: {
    label: string;
    price?: number | null;
    disabled?: boolean;
    pending?: boolean;
    onClick?: () => void;
}) {
    const hasPrice = price != null && price > 1 && !disabled;
    return (
        <div
            className={`flex items-center justify-between px-3 py-2.5 border-t border-white/[0.04] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group/o motion-reduce:transition-none ${
                hasPrice ? 'hover:bg-white/[0.03] cursor-pointer active:scale-[0.97] motion-reduce:active:scale-100' : 'opacity-50'
            }`}
            onClick={hasPrice ? onClick : undefined}
        >
            <span className="text-[12px] font-semibold text-text-secondary truncate flex-1">{label}</span>
            <div className={`ml-3 flex-shrink-0 px-3 py-1 rounded-lg border text-[13px] font-black tabular-nums transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                hasPrice
                    ? 'bg-[#ff7a1a]/10 border-[#ff7a1a]/25 text-[#ff9a3d] group-hover/o:bg-[#ff7a1a]/22 group-hover/o:border-[#ff7a1a]/45 group-hover/o:text-white'
                    : 'bg-white/[0.03] border-white/[0.05] text-white/20'
            }`}>
                {pending ? '...' : hasPrice ? price!.toFixed(2) : '-'}
            </div>
        </div>
    );
}


// ─── SR Match Card ────────────────────────────────────────────────────────────

export interface SRMatchCardProps {
    match: Event & {
        /** Raw Sportsradar markets from events-catalogue */
        sr_markets?: {
            matchOdds?: Array<{
                marketId: string;
                marketName: string;
                marketType: string;
                status: string;
                runners: Array<{
                    runnerId: string;
                    runnerName: string;
                    status: string;
                    backPrices: Array<{ price: number; size: number }>;
                    layPrices: Array<{ price: number; size: number }>;
                }>;
            }>;
        };
        homeScore?: number;
        awayScore?: number;
        catId?: string;
        competitionName?: string;
    };
    onOddsClick?: (match: Event, odd: MatchOddSummary, e: React.MouseEvent<HTMLButtonElement>) => void;
    oneClickEnabled?: boolean;
    isOneClickPending?: (eventId: string, marketId: string, selectionId: string) => boolean;
}

export default function SRMatchCard({ match, onOddsClick, oneClickEnabled, isOneClickPending }: SRMatchCardProps) {
    const router = useRouter();
    const earlySixIds = useEarlySixMatches();
    const hasEarlySix = earlySixIds.has(String(match.event_id));

    const homeTeam = match.home_team || match.event_name?.split(' vs. ')[0]?.trim() || match.event_name || 'Home';
    const awayTeam = match.away_team || match.event_name?.split(' vs. ')[1]?.trim() || '';

    const isLive =
        match.match_status === 'Live' ||
        match.match_status === 'In Play' ||
        (match as any).catId === 'LIVE' ||
        (match as any).status === 'IN_PLAY';

    const isVirtual = (match as any).catId === 'SR VIRTUAL';
    const isCompleted = match.match_status === 'Completed';

    const compName =
        (match as any).competitionName ||
        (match as any).competition_name ||
        match.competition?.competition_name ||
        '';

    // Pull odds from both the SR raw format and the existing normalised format
    const srMarket = (match as any).sr_markets?.matchOdds?.[0];
    const runners = srMarket?.runners ?? [];
    const legacyOdds = (match as any).match_odds ?? [];

    return (
        <div
            onClick={() => router.push(`/sports/match/${match.event_id}`)}
            className={`relative flex flex-col bg-[#1a1510] rounded-2xl ring-1 overflow-hidden cursor-pointer group select-none transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none motion-reduce:active:scale-100 ${
                isLive
                    ? 'ring-[#ff7a1a]/25 hover:ring-[#ff7a1a]/45'
                    : isVirtual
                    ? 'ring-[#ff7a1a]/15 hover:ring-[#ff7a1a]/30'
                    : 'ring-white/[0.06] hover:ring-[#ff7a1a]/25'
            }`}
        >
            {/* Live / Virtual accent stripe — single orange accent */}
            {isLive && <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff7a1a]/70 to-transparent" />}
            {isVirtual && !isLive && <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff7a1a]/45 to-transparent" />}

            {/* Card Header */}
            <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-white/[0.04]">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Shield size={8} className={`flex-shrink-0 ${isLive || isVirtual ? 'text-[#ff7a1a]/50' : 'text-white/25'}`} />
                    <span className={`text-[10px] font-semibold truncate ${isLive || isVirtual ? 'text-[#ff9a3d]/65' : 'text-white/40'}`}>
                        {compName}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {isLive && (
                        <div className="flex items-center gap-1 bg-[#ff7a1a]/12 border border-[#ff7a1a]/25 px-2 py-0.5 rounded-md">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#ff7a1a] animate-pulse motion-reduce:animate-none" />
                            <span className="text-[#ff9a3d] text-[9px] font-black">LIVE</span>
                        </div>
                    )}
                    {isVirtual && (
                        <div className="flex items-center gap-1 bg-[#ff7a1a]/10 border border-[#ff7a1a]/20 px-2 py-0.5 rounded-md">
                            <Zap size={8} className="text-[#ff9a3d]" />
                            <span className="text-[#ff9a3d] text-[9px] font-black">VIRTUAL</span>
                        </div>
                    )}
                    {!isLive && !isVirtual && (
                        <div className="flex items-center gap-1">
                            <Activity size={8} className="text-white/25" />
                            <span className="text-white/25 text-[9px] font-semibold">{match.match_status || 'Upcoming'}</span>
                        </div>
                    )}
                    {isCompleted && (
                        <span className="text-white/25 text-[9px] font-bold">ENDED</span>
                    )}
                </div>
            </div>

            {/* Early 6 Badge — single orange accent */}
            {hasEarlySix && (
                <div className="px-3 pt-2">
                    <span
                        className="block text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-lg shadow-[0_0_8px_rgba(255,122,26,0.3)] text-center w-full"
                        style={{ background: 'linear-gradient(135deg,#ff9a3d,#ff6a00)' }}
                    >
                        🎯 Early 6 Refund Offer
                    </span>
                </div>
            )}

            {/* Teams */}
            <div className="px-3 py-3 flex flex-col gap-2">
                <TeamAvatar name={homeTeam} isLive={isLive} score={(match as any).homeScore ?? match.score1} />

                {/* VS divider */}
                <div className="flex items-center gap-2 pl-[2.75rem]">
                    <div className="flex-1 h-px bg-white/[0.035]" />
                    <span className="text-[8px] font-black text-white/15">VS</span>
                    <div className="flex-1 h-px bg-white/[0.035]" />
                </div>

                {awayTeam && (
                    <TeamAvatar name={awayTeam} isLive={isLive} score={(match as any).awayScore ?? match.score2} />
                )}
            </div>

            {/* Match Odds Footer — stacked runner rows */}
            {runners.length > 0 ? (
                <div className="border-t border-white/[0.04] mt-1">
                    <div className="flex items-center justify-between px-3 pt-2 pb-1">
                        <span className="text-[9px] font-black text-white/25 uppercase tracking-widest">
                            {srMarket?.marketName || 'Match Odds'}
                        </span>
                        {oneClickEnabled && (
                            <span className="rounded-full bg-[#ff7a1a]/12 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-[#ff9a3d]">
                                1-Tap
                            </span>
                        )}
                    </div>
                    {runners.map((runner: SRRunner, i: number) => {
                        const bestBack = runner.backPrices?.[0]?.price;
                        const isPending = isOneClickPending
                            ? isOneClickPending(match.event_id, srMarket!.marketId, runner.runnerId)
                            : false;
                        const isDisabled = !bestBack || isCompleted || runner.status !== 'Active';
                        const syntheticOdd: MatchOddSummary = {
                            name: runner.runnerName,
                            back: bestBack,
                            marketId: srMarket!.marketId,
                            selectionId: runner.runnerId,
                            marketName: srMarket?.marketName || 'Match Odds',
                            betType: 'back',
                        };
                        return (
                            <OddsButton
                                key={runner.runnerId || i}
                                label={runner.runnerName}
                                price={bestBack}
                                disabled={isDisabled}
                                pending={isPending}
                                onClick={onOddsClick ? () => {
                                    const e = new MouseEvent('click') as unknown as React.MouseEvent<HTMLButtonElement>;
                                    onOddsClick(match, syntheticOdd, e);
                                } : undefined}
                            />
                        );
                    })}
                </div>
            ) : legacyOdds.length > 0 ? (
                <div className="border-t border-white/[0.04] mt-1">
                    <div className="px-3 pt-2 pb-1">
                        <span className="text-[9px] font-black text-white/25 uppercase tracking-widest">Match Odds</span>
                    </div>
                    {legacyOdds.slice(0, 3).map((o: MatchOddSummary, i: number) => {
                        const isPending = isOneClickPending && o.marketId && o.selectionId
                            ? isOneClickPending(match.event_id, o.marketId, o.selectionId)
                            : false;
                        return (
                            <OddsButton
                                key={i}
                                label={o.name}
                                price={o.back}
                                disabled={isCompleted}
                                pending={isPending}
                                onClick={onOddsClick ? () => {
                                    const e = new MouseEvent('click') as unknown as React.MouseEvent<HTMLButtonElement>;
                                    onOddsClick(match, o, e);
                                } : undefined}
                            />
                        );
                    })}
                </div>
            ) : (
                <div className="flex items-center justify-end px-3 py-2.5 border-t border-white/[0.04]">
                    <div className="flex items-center gap-1 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none">
                        <span className="text-[#ff9a3d] text-[10px] font-black">View</span>
                        <ChevronRight size={10} className="text-[#ff9a3d]" />
                    </div>
                </div>
            )}
        </div>
    );
}
