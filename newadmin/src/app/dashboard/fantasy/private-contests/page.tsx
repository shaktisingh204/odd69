"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Shield, ChevronLeft, ChevronRight, Copy, Trophy } from 'lucide-react';
import { getPrivateContests } from '@/actions/fantasy-extras';

interface Row {
    _id: string; matchId: number; title: string;
    inviteCode: string; creatorUserId?: number;
    entryFee: number; totalPrize: number;
    maxSpots: number; filledSpots: number;
    isActive: boolean; isCancelled: boolean; isSettled: boolean;
    createdAt: string;
}

export default function PrivateContestsPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const res = await getPrivateContests(page, 50);
            if (res.success && res.data) {
                setRows(res.data as Row[]);
                setPages(res.pagination?.pages || 1);
                setTotal(res.pagination?.total || 0);
            }
            setLoading(false);
        })();
    }, [page]);

    const copyCode = (code: string) => {
        navigator.clipboard?.writeText(code);
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-4">
            <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2"><Shield size={18} className="text-brand-gold" /> Private Contests</h1>
                <p className="text-sm text-white/40 mt-0.5">Invite-only contests created by users. {total.toLocaleString('en-IN')} total.</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-brand-gold" /></div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-white/25 text-sm">No private contests yet.</div>
            ) : (
                <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-widest text-white/40 border-b border-white/5">
                                <th className="px-3 py-2 text-left">Code</th>
                                <th className="px-3 py-2 text-left">Title</th>
                                <th className="px-3 py-2 text-left">Creator</th>
                                <th className="px-3 py-2 text-left">Match</th>
                                <th className="px-3 py-2 text-right">Entry</th>
                                <th className="px-3 py-2 text-right">Prize</th>
                                <th className="px-3 py-2 text-right">Filled</th>
                                <th className="px-3 py-2 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r._id} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]">
                                    <td className="px-3 py-2.5">
                                        <button onClick={() => copyCode(r.inviteCode)}
                                            className="inline-flex items-center gap-1.5 bg-brand-gold/10 text-brand-gold px-2 py-1 rounded-lg font-mono text-xs font-black hover:bg-brand-gold/20"
                                            title="Copy invite code">
                                            {r.inviteCode} <Copy size={10} />
                                        </button>
                                    </td>
                                    <td className="px-3 py-2.5 text-white font-semibold truncate max-w-[200px]">{r.title}</td>
                                    <td className="px-3 py-2.5">
                                        {r.creatorUserId ? (
                                            <Link href={`/dashboard/users/${r.creatorUserId}`} className="text-white/70 hover:text-brand-gold">#{r.creatorUserId}</Link>
                                        ) : <span className="text-white/20">—</span>}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <Link href={`/dashboard/fantasy/matches/${r.matchId}`} className="text-white/70 hover:text-brand-gold font-mono text-[11px]">{r.matchId}</Link>
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-white/70 font-mono">₹{r.entryFee}</td>
                                    <td className="px-3 py-2.5 text-right text-brand-gold font-mono">₹{r.totalPrize.toLocaleString('en-IN')}</td>
                                    <td className="px-3 py-2.5 text-right text-white font-black">{r.filledSpots}/{r.maxSpots}</td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                                            r.isCancelled ? 'bg-rose-500/10 text-rose-400' :
                                            r.isSettled   ? 'bg-white/5 text-white/40' :
                                            r.isActive    ? 'bg-emerald-500/10 text-emerald-400' :
                                                            'bg-amber-500/10 text-amber-400'
                                        }`}>
                                            {r.isCancelled ? 'cancelled' : r.isSettled ? 'settled' : r.isActive ? 'open' : 'closed'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && rows.length > 0 && (
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/30">Page {page} of {pages}</span>
                    <div className="flex gap-1">
                        <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="p-2 rounded-lg bg-bg-elevated text-white/50 hover:text-white disabled:opacity-30"><ChevronLeft size={14} /></button>
                        <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-lg bg-bg-elevated text-white/50 hover:text-white disabled:opacity-30"><ChevronRight size={14} /></button>
                    </div>
                </div>
            )}
        </div>
    );
}
