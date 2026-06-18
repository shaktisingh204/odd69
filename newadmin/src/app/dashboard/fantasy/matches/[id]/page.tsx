"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    Loader2, ArrowLeft, Calendar, MapPin, Trophy, Flag,
    Users, Shield,
} from 'lucide-react';
import { getFantasyMatch, getFantasyContests } from '@/actions/fantasy';

interface SquadPlayer {
    playerId: number;
    name: string;
    shortName?: string;
    role: string;
    roleStr?: string;
    teamId: number;
    teamName?: string;
    credit: number;
    isPlaying11?: boolean;
    isCaptain?: boolean;
    nationality?: string;
    battingStyle?: string;
    bowlingStyle?: string;
}

interface Match {
    externalMatchId: number;
    title: string;
    competitionTitle?: string;
    format?: string;
    venue?: string;
    startDate?: string;
    status: number;
    statusStr?: string;
    teamA?: { id: number; name: string; short: string };
    teamB?: { id: number; name: string; short: string };
    playing11Announced?: boolean;
    squads?: SquadPlayer[];
    result?: string;
    toss?: { text: string };
    fantasyPoints?: Record<string, number>;
}

interface Contest {
    _id: string;
    matchId: number;
    title: string;
    type: string;
    entryFee: number;
    totalPrize: number;
    maxSpots: number;
    filledSpots: number;
    isActive: boolean;
}

const ROLE_LABEL: Record<string, string> = {
    keeper: 'WK',
    batsman: 'BAT',
    allrounder: 'AR',
    bowler: 'BOWL',
};

export default function FantasyMatchDetailPage() {
    const params = useParams<{ id: string }>();
    const matchId = Number(params?.id);
    const [match, setMatch] = useState<Match | null>(null);
    const [contests, setContests] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!matchId) return;
        (async () => {
            setLoading(true);
            const [m, c] = await Promise.all([
                getFantasyMatch(matchId),
                getFantasyContests(matchId),
            ]);
            if (m.success && m.data) setMatch(m.data as Match);
            if (c.success && c.data) setContests(c.data as Contest[]);
            setLoading(false);
        })();
    }, [matchId]);

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-brand-gold" />
        </div>
    );

    if (!match) return (
        <div className="p-6 text-center text-white/40">
            Match not found.
            <Link href="/dashboard/fantasy/matches" className="block mt-3 text-brand-gold">Back to matches</Link>
        </div>
    );

    const squads = match.squads || [];
    const byTeam = (tid?: number) => squads.filter(p => !tid || p.teamId === tid);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-5">

            <Link href="/dashboard/fantasy/matches"
                className="inline-flex items-center gap-1 text-[12px] text-white/40 hover:text-white">
                <ArrowLeft size={13} /> Back to matches
            </Link>

            {/* Match header */}
            <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
                            {match.competitionTitle} • {match.format} • #{match.externalMatchId}
                        </p>
                        <h1 className="text-xl font-black text-white mt-1">{match.title}</h1>
                        <div className="flex items-center gap-3 mt-2 text-[12px] text-white/40">
                            {match.startDate && (
                                <span className="inline-flex items-center gap-1">
                                    <Calendar size={12} />
                                    {new Date(match.startDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                            )}
                            {match.venue && (
                                <span className="inline-flex items-center gap-1">
                                    <MapPin size={12} /> {match.venue}
                                </span>
                            )}
                            {match.playing11Announced && (
                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                    <Flag size={12} /> Playing XI announced
                                </span>
                            )}
                        </div>
                        {match.toss?.text && (
                            <p className="text-[11px] text-white/40 mt-2">Toss: {match.toss.text}</p>
                        )}
                        {match.result && (
                            <p className="text-[12px] text-emerald-300 font-black mt-2">{match.result}</p>
                        )}
                    </div>
                    <Link href={`/dashboard/fantasy/contests?matchId=${match.externalMatchId}`}
                        className="flex items-center gap-1.5 bg-brand-gold text-bg-base px-4 py-2 rounded-xl font-black text-sm hover:bg-brand-gold/90">
                        <Trophy size={14} /> Manage contests
                    </Link>
                </div>
            </div>

            {/* Contests summary */}
            <section>
                <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-2 flex items-center gap-1.5">
                    <Trophy size={12} /> Contests for this match ({contests.length})
                </h2>
                {contests.length === 0 ? (
                    <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated px-4 py-6 text-sm text-white/30 text-center">
                        No contests yet. <Link href={`/dashboard/fantasy/contests?matchId=${match.externalMatchId}`} className="text-brand-gold">Create one →</Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {contests.map(c => (
                            <div key={c._id} className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-white text-sm font-black truncate">{c.title}</p>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{c.type}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-white/50">
                                    <span>Entry ₹{c.entryFee} • Prize ₹{c.totalPrize.toLocaleString('en-IN')}</span>
                                    <span className={c.isActive ? 'text-emerald-400' : 'text-white/25'}>
                                        {c.filledSpots}/{c.maxSpots} filled
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Squads */}
            <section>
                <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-2 flex items-center gap-1.5">
                    <Users size={12} /> Squads ({squads.length} players)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[match.teamA, match.teamB].map(team => team && (
                        <div key={team.id} className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Shield size={14} className="text-brand-gold" />
                                <p className="text-white text-sm font-black">{team.name}</p>
                                <span className="ml-auto text-[10px] text-white/30">{byTeam(team.id).length} players</span>
                            </div>
                            <div className="space-y-1">
                                {byTeam(team.id).map(p => (
                                    <div key={p.playerId} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
                                        <span className="inline-flex items-center justify-center w-10 h-5 rounded bg-white/5 text-[9px] font-black text-white/50">
                                            {ROLE_LABEL[p.role] || p.role?.slice(0, 4).toUpperCase()}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] text-white font-semibold truncate">
                                                {p.name}
                                                {p.isCaptain && <span className="ml-1 text-brand-gold text-[9px]">(C)</span>}
                                            </p>
                                            {(p.battingStyle || p.bowlingStyle) && (
                                                <p className="text-[10px] text-white/30 truncate">
                                                    {[p.battingStyle, p.bowlingStyle].filter(Boolean).join(' • ')}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-[11px] text-white/60 font-mono">{p.credit?.toFixed(1)}</span>
                                        {p.isPlaying11 && (
                                            <span className="text-[9px] text-emerald-400 font-black">XI</span>
                                        )}
                                        {match.fantasyPoints?.[p.playerId] !== undefined && (
                                            <span className="text-[11px] text-brand-gold font-black font-mono ml-2">
                                                {match.fantasyPoints[p.playerId]}
                                            </span>
                                        )}
                                    </div>
                                ))}
                                {byTeam(team.id).length === 0 && (
                                    <p className="text-[11px] text-white/25 text-center py-3">No squad yet</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
