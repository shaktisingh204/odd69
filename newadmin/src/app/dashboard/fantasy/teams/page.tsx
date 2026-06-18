"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Loader2, Users, ChevronDown, ChevronRight,
    ChevronLeft, ChevronRight as PageRight, User,
} from 'lucide-react';
import { getFantasyTeams } from '@/actions/fantasy';

interface TeamPlayer {
    playerId: number;
    name: string;
    role: string;
    teamId: number;
    credit: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
}

interface Team {
    _id: string;
    userId: number;
    matchId: number;
    teamName: string;
    players: TeamPlayer[];
    captainId: number;
    viceCaptainId: number;
    totalCredits: number;
    totalPoints: number;
    createdAt?: string;
}

export default function FantasyTeamsPage() {
    const [rows, setRows] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [expanded, setExpanded] = useState<string | null>(null);

    const [userId, setUserId] = useState('');
    const [matchId, setMatchId] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        const res = await getFantasyTeams(page, 30, {
            userId: userId.trim() || undefined,
            matchId: matchId.trim() || undefined,
        });
        if (res.success && res.data) {
            setRows(res.data as Team[]);
            setTotalPages(res.pagination?.pages || 1);
            setTotal(res.pagination?.total || 0);
        }
        setLoading(false);
    }, [page, userId, matchId]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-4">

            <div>
                <h1 className="text-xl font-black text-white">User Fantasy Teams</h1>
                <p className="text-sm text-white/40 mt-0.5">{total.toLocaleString('en-IN')} teams built by users.</p>
            </div>

            <div className="flex flex-wrap gap-2">
                <input value={userId} onChange={e => { setUserId(e.target.value); setPage(1); }}
                    placeholder="User ID" className="bg-bg-elevated text-white text-sm font-medium rounded-xl border border-white/10 px-3 py-2 outline-none focus:border-brand-gold/50 placeholder:text-white/25 w-32" />
                <input value={matchId} onChange={e => { setMatchId(e.target.value); setPage(1); }}
                    placeholder="Match ID" className="bg-bg-elevated text-white text-sm font-medium rounded-xl border border-white/10 px-3 py-2 outline-none focus:border-brand-gold/50 placeholder:text-white/25 w-32" />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 size={24} className="animate-spin text-brand-gold" />
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-white/25 text-sm">No teams match these filters.</div>
            ) : (
                <div className="space-y-2">
                    {rows.map(t => (
                        <div key={t._id} className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-4">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setExpanded(expanded === t._id ? null : t._id)} className="text-white/30 hover:text-white">
                                    {expanded === t._id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                <Users size={14} className="text-brand-gold" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30">
                                        <Link href={`/dashboard/users/${t.userId}`} className="hover:text-brand-gold">User #{t.userId}</Link>
                                        <Link href={`/dashboard/fantasy/matches/${t.matchId}`} className="hover:text-brand-gold">Match #{t.matchId}</Link>
                                    </div>
                                    <p className="text-white text-sm font-black">{t.teamName}</p>
                                    <p className="text-[11px] text-white/40 mt-0.5">
                                        {t.players?.length || 0} players • {t.totalCredits?.toFixed(1)} credits used
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-white/40 uppercase tracking-widest">Points</p>
                                    <p className="text-lg font-black text-brand-gold font-mono">{t.totalPoints ?? 0}</p>
                                </div>
                            </div>

                            {expanded === t._id && (
                                <div className="mt-3 pt-3 border-t border-white/5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {t.players?.map(p => (
                                            <div key={p.playerId} className="flex items-center gap-2 bg-bg-base rounded-lg px-2 py-1.5">
                                                <span className="inline-flex items-center justify-center w-8 h-5 rounded bg-white/5 text-[9px] font-black text-white/50">
                                                    {p.role?.slice(0, 4).toUpperCase()}
                                                </span>
                                                <span className="flex-1 text-[12px] text-white font-semibold truncate">
                                                    {p.name}
                                                    {p.isCaptain && <span className="ml-1 text-brand-gold font-black">(C)</span>}
                                                    {p.isViceCaptain && <span className="ml-1 text-sky-400 font-black">(VC)</span>}
                                                </span>
                                                <span className="text-[11px] text-white/50 font-mono">{p.credit?.toFixed(1)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {!loading && rows.length > 0 && (
                <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-white/30">Page {page} of {totalPages}</span>
                    <div className="flex gap-1">
                        <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="p-2 rounded-lg bg-bg-elevated text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                            <ChevronLeft size={14} />
                        </button>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-lg bg-bg-elevated text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                            <PageRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
