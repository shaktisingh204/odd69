"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Loader2, Receipt, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { getFantasyEntries } from '@/actions/fantasy';

interface Entry {
    _id: string;
    userId: number;
    contestId: string;
    teamId: string;
    matchId: number;
    entryFee: number;
    status: string;
    rank: number;
    totalPoints: number;
    winnings: number;
    createdAt?: string;
}

const STATUS_CLS: Record<string, string> = {
    settled:  'bg-emerald-500/10 text-emerald-400',
    pending:  'bg-amber-500/10 text-amber-400',
    refunded: 'bg-white/5 text-white/40',
};

export default function FantasyEntriesPage() {
    const [rows, setRows] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [userId, setUserId] = useState('');
    const [matchId, setMatchId] = useState('');
    const [contestId, setContestId] = useState('');
    const [status, setStatus] = useState('ALL');

    const load = useCallback(async () => {
        setLoading(true);
        const res = await getFantasyEntries(page, 50, {
            userId: userId.trim() || undefined,
            matchId: matchId.trim() || undefined,
            contestId: contestId.trim() || undefined,
            status,
        });
        if (res.success && res.data) {
            setRows(res.data as Entry[]);
            setTotalPages(res.pagination?.pages || 1);
            setTotal(res.pagination?.total || 0);
        }
        setLoading(false);
    }, [page, userId, matchId, contestId, status]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-4">

            <div>
                <h1 className="text-xl font-black text-white">Contest Entries</h1>
                <p className="text-sm text-white/40 mt-0.5">{total.toLocaleString('en-IN')} entries placed.</p>
            </div>

            <div className="flex flex-wrap gap-2">
                <input value={userId} onChange={e => { setUserId(e.target.value); setPage(1); }}
                    placeholder="User ID"
                    className="bg-bg-elevated text-white text-sm font-medium rounded-xl border border-white/10 px-3 py-2 outline-none focus:border-brand-gold/50 placeholder:text-white/25 w-32" />
                <input value={matchId} onChange={e => { setMatchId(e.target.value); setPage(1); }}
                    placeholder="Match ID"
                    className="bg-bg-elevated text-white text-sm font-medium rounded-xl border border-white/10 px-3 py-2 outline-none focus:border-brand-gold/50 placeholder:text-white/25 w-32" />
                <input value={contestId} onChange={e => { setContestId(e.target.value); setPage(1); }}
                    placeholder="Contest _id"
                    className="bg-bg-elevated text-white text-sm font-medium rounded-xl border border-white/10 px-3 py-2 outline-none focus:border-brand-gold/50 placeholder:text-white/25 flex-1 min-w-[200px]" />
                <div className="flex gap-1 rounded-2xl bg-bg-elevated p-1">
                    {['ALL', 'pending', 'settled', 'refunded'].map(s => (
                        <button key={s} onClick={() => { setStatus(s); setPage(1); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${status === s ? 'bg-brand-gold text-bg-base' : 'text-white/40 hover:text-white'}`}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 size={24} className="animate-spin text-brand-gold" />
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-white/25 text-sm">No entries match these filters.</div>
            ) : (
                <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-widest text-white/40 border-b border-white/5">
                                <th className="px-3 py-2 text-left">Date</th>
                                <th className="px-3 py-2 text-left">User</th>
                                <th className="px-3 py-2 text-left">Match</th>
                                <th className="px-3 py-2 text-left">Contest</th>
                                <th className="px-3 py-2 text-right">Entry</th>
                                <th className="px-3 py-2 text-right">Rank</th>
                                <th className="px-3 py-2 text-right">Points</th>
                                <th className="px-3 py-2 text-right">Winnings</th>
                                <th className="px-3 py-2 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r._id} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]">
                                    <td className="px-3 py-2 text-[11px] text-white/40 font-mono">
                                        {r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                    </td>
                                    <td className="px-3 py-2">
                                        <Link href={`/dashboard/users/${r.userId}`} className="text-white hover:text-brand-gold font-semibold">
                                            #{r.userId}
                                        </Link>
                                    </td>
                                    <td className="px-3 py-2">
                                        <Link href={`/dashboard/fantasy/matches/${r.matchId}`} className="text-white/70 hover:text-brand-gold font-mono text-[11px]">
                                            {r.matchId}
                                        </Link>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-[10px] text-white/40 truncate max-w-[120px]">{r.contestId}</td>
                                    <td className="px-3 py-2 text-right text-white/70 font-mono">₹{r.entryFee}</td>
                                    <td className="px-3 py-2 text-right text-white font-black">{r.rank || '—'}</td>
                                    <td className="px-3 py-2 text-right text-brand-gold font-mono font-black">{r.totalPoints || 0}</td>
                                    <td className="px-3 py-2 text-right">
                                        {r.winnings > 0 ? (
                                            <span className="text-emerald-400 font-black">₹{r.winnings.toLocaleString('en-IN')}</span>
                                        ) : (
                                            <span className="text-white/20">—</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${STATUS_CLS[r.status] || 'bg-white/5 text-white/40'}`}>
                                            {r.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
