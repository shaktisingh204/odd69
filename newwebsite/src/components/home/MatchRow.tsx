
import { useRouter } from 'next/navigation';
import { Clock, Radio, Trophy, ChevronRight } from 'lucide-react';
import { Event } from '@/services/sports';
import { useBets } from '@/context/BetContext';
import { getFlagByCode, getRegionFlag, countries } from '@/config/countries';

interface MatchRowProps {
    match: Event;
}

export default function MatchRow({ match }: MatchRowProps) {
    const router = useRouter();
    const { addBet } = useBets();

    const getMarket = (namePart: string) =>
        match.markets?.find(m => m.market_name.toLowerCase().includes(namePart.toLowerCase()));

    const handleOddClick = (e: React.MouseEvent, marketId: string, selectionName: string, odds: number, selectionId: string, marketName: string) => {
        e.stopPropagation();
        if (!odds || odds <= 1) return;
        addBet({
            eventId: match.event_id,
            eventName: match.event_name,
            marketId,
            marketName,
            selectionId,
            selectionName,
            odds,
            marketType: 'MATCH_ODDS',
        });
    };

    const winnerMarket = getMarket('Winner') || getMarket('Match Result') || getMarket('1x2');

    const formatMatchTime = (dateStr: string) => {
        if (!dateStr) return 'TBA';
        let date: Date;
        if (typeof dateStr === 'string' && dateStr.includes('/Date(')) {
            const ts = parseInt(dateStr.replace(/\/Date\((-?\d+)\)\//, '$1'));
            if (isNaN(ts)) return 'TBA';
            date = new Date(ts);
        } else {
            date = new Date(dateStr);
        }
        if (isNaN(date.getTime())) return 'TBA';
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return `${day} ${month}, ${time}`;
    };

    const leagueName = match.competition_name || match.competition?.competition_name || 'Unknown League';
    const countryCode = match.competition?.country_code;
    const getCountryName = (code?: string) => {
        if (!code) return 'International';
        const c = countries.find(c => c.code === code);
        return c ? c.name : 'International';
    };
    const countryName = getCountryName(countryCode);
    const flag = countryCode ? getFlagByCode(countryCode) : getRegionFlag(leagueName);

    const isTournament = !match.event_name.includes(' v ') && !match.away_team;
    const isCompleted = match.match_status === 'Completed';

    // Time-based live fallback: if open_date is past and match isn't completed, it's live
    const parseOpenDate = (d: string) => {
        if (!d) return 0;
        if (d.includes('/Date(')) return parseInt(d.replace(/\/Date\((-?\d+)\)\//, '$1'));
        return new Date(d).getTime();
    };
    const matchStartedAt = parseOpenDate(match.open_date);
    const hasStarted = matchStartedAt > 0 && Date.now() >= matchStartedAt;

    const isLive =
        match.match_status === 'In Play' ||
        match.match_status === 'Live' ||
        !!match.match_info ||
        (match as any).in_play ||
        (!isCompleted && hasStarted);


    // Tournament card
    if (isTournament) {
        return (
            <div
                onClick={() => router.push(`/sports/match/${match.event_id}`)}
                className="group relative bg-bg-modal hover:bg-bg-input-2 rounded-xl p-4 cursor-pointer transition-all duration-200 border border-white/[0.06] hover:border-white/[0.06] overflow-hidden flex flex-col gap-3"
            >
                <div className="flex items-center gap-2 text-[11px] text-white/40 font-medium">
                    <span className="text-base leading-none">{flag}</span>
                    <span className="truncate">{countryName} · {leagueName}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-bg-surface flex items-center justify-center border border-white/[0.04]">
                        <Trophy size={16} className="text-warning-bright" />
                    </div>
                    <span className="text-sm font-bold text-white leading-snug truncate">{match.event_name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-white/30">
                    <Clock size={10} />
                    <span>{isCompleted ? 'Completed' : isLive ? 'In Play' : formatMatchTime(match.open_date)}</span>
                </div>
            </div>
        );
    }

    const homeTeam = match.home_team || match.event_name.split(' v ')[0] || '';
    const awayTeam = match.away_team || match.event_name.split(' v ')[1] || '';

    // Runners for odds
    const runners = winnerMarket?.runners_data || [];
    const getOdd = (runner: any) => {
        const back = runner.odds?.find((o: any) => o.otype === 'back' && o.tno === 0) ||
            runner.odds?.find((o: any) => o.otype === 'back');
        return back?.odds;
    };

    return (
        <div
            onClick={() => router.push(`/sports/match/${match.event_id}`)}
            className="group relative bg-bg-modal hover:bg-bg-input-2 rounded-xl cursor-pointer transition-all duration-200 border border-white/[0.06] hover:border-white/[0.06] overflow-hidden"
        >
            {/* Header strip: league + time/live badge */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
                <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-medium min-w-0">
                    <span className="text-sm leading-none flex-shrink-0">{flag}</span>
                    <span className="truncate">{countryName} · {leagueName}</span>
                </div>
                {isLive ? (
                    <div className="flex items-center gap-1 flex-shrink-0 bg-danger-alpha-10 border border-danger/20 text-danger text-[10px] font-black px-2 py-0.5 rounded uppercase">
                        <Radio size={8} className="animate-pulse" />
                        LIVE
                    </div>
                ) : isCompleted ? (
                    <span className="flex-shrink-0 text-[10px] font-semibold text-white/20 uppercase">Ended</span>
                ) : (
                    <span className="flex-shrink-0 flex items-center gap-1 text-[10px] text-white/30 font-medium">
                        <Clock size={9} />
                        {formatMatchTime(match.open_date)}
                    </span>
                )}
            </div>

            {/* Teams + Score */}
            <div className="px-3 py-3 flex flex-col gap-2.5">
                {/* Home */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <TeamFlag team={homeTeam} fallbackFlag={flag} countryCode={countryCode} size="sm" />
                        <span className="text-[13px] font-semibold text-white truncate">{homeTeam}</span>
                    </div>
                    {match.score1 != null && (
                        <span className={`text-base font-black tabular-nums tracking-tight flex-shrink-0 ${isLive ? 'text-brand-gold' : 'text-white'}`}>
                            {match.score1}
                        </span>
                    )}
                </div>
                {/* Away */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <TeamFlag team={awayTeam} fallbackFlag={flag} countryCode={countryCode} size="sm" />
                        <span className="text-[13px] font-semibold text-white truncate">{awayTeam}</span>
                    </div>
                    {match.score2 != null && (
                        <span className={`text-base font-black tabular-nums tracking-tight flex-shrink-0 ${isLive ? 'text-brand-gold' : 'text-white'}`}>
                            {match.score2}
                        </span>
                    )}
                </div>
            </div>

            {/* Odds Strip */}
            {runners.length > 0 && !isCompleted && (
                <div className="px-3 pb-3">
                    <div className="grid grid-cols-3 gap-1.5">
                        {runners.slice(0, 3).map((runner: any, idx: number) => {
                            const price = getOdd(runner);
                            let label = '1';
                            if (idx === 1) label = runners.length > 2 ? 'X' : '2';
                            if (idx === 2) label = '2';
                            return (
                                <OddsButton
                                    key={idx}
                                    label={label}
                                    value={price}
                                    onClick={(e) => price && handleOddClick(
                                        e,
                                        winnerMarket?.market_id || '1',
                                        runner.nat || runner.runnerName || label,
                                        price,
                                        String(runner.sid || runner.selectionId || runner.runnerId || label),
                                        winnerMarket?.market_name || 'Match Odds'
                                    )}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* More markets hint */}
            <div className="flex items-center justify-end px-3 pb-2">
                <span className="text-[10px] text-white/20 flex items-center gap-0.5 font-medium">
                    {(match.markets?.length || 0)} markets <ChevronRight size={10} />
                </span>
            </div>
        </div>
    );
}

/* ─── Sub-components ─── */

function TeamFlag({ team, fallbackFlag, countryCode, size = 'sm' }: {
    team: string; fallbackFlag: string; countryCode?: string; size?: 'sm' | 'md';
}) {
    const dim = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';
    const code = getFlagCode(team);
    const isGeneric = code === 'un' || (countryCode && code === countryCode.toLowerCase());

    return (
        <div className={`${dim} rounded-md bg-bg-surface flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/[0.04]`}>
            {isGeneric ? (
                <span className="text-sm leading-none">{fallbackFlag}</span>
            ) : (
                <img
                    src={`https://flagcdn.com/w40/${code}.png`}
                    className="w-full h-full object-contain"
                    alt={team}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
            )}
        </div>
    );
}

function OddsButton({ label, value, onClick }: {
    label: string; value?: number; onClick: (e: React.MouseEvent) => void;
}) {
    if (!value) {
        return (
            <div className="h-9 rounded-lg bg-bg-surface border border-white/[0.04] flex items-center justify-between px-2.5 opacity-40">
                <span className="text-[10px] text-white/40 font-bold">{label}</span>
                <span className="text-[11px] text-white/20 font-bold">-</span>
            </div>
        );
    }
    return (
        <button
            onClick={onClick}
            className="h-9 rounded-lg bg-bg-surface hover:bg-brand-gold border border-white/[0.06] hover:border-brand-gold flex items-center justify-between px-2.5 transition-all duration-150 active:scale-95 group/odd"
        >
            <span className="text-[10px] font-bold text-white/40 group-hover/odd:text-text-inverse/60 transition-colors">{label}</span>
            <span className="text-[13px] font-black text-white group-hover/odd:text-text-inverse transition-colors">{value}</span>
        </button>
    );
}

function getFlagCode(teamName?: string): string {
    if (!teamName) return 'un';
    const lower = teamName.toLowerCase();
    if (lower.includes('india')) return 'in';
    if (lower.includes('australia')) return 'au';
    if (lower.includes('new zealand')) return 'nz';
    if (lower.includes('afghanistan')) return 'af';
    if (lower.includes('england')) return 'gb-eng';
    if (lower.includes('nepal')) return 'np';
    if (lower.includes('sri lanka')) return 'lk';
    if (lower.includes('ireland')) return 'ie';
    if (lower.includes('pakistan')) return 'pk';
    if (lower.includes('bangladesh')) return 'bd';
    if (lower.includes('south africa')) return 'za';
    if (lower.includes('west indies')) return 'kn';
    if (lower.includes('zimbabwe')) return 'zw';
    if (lower.includes('kenya')) return 'ke';
    if (lower.includes('usa') || lower.includes('united states')) return 'us';
    return 'un';
}
