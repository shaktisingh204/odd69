"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Crown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSeasonLeaderboard } from '@/actions/fantasy-extras';

interface Row { userId: number; rank: number; totalPoints: number; totalWinnings: number; totalEntries: number; wins: number }

export default function SeasonLeaderboardPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const res = await getSeasonLeaderboard(page, 50);
            if (res.success && res.data) {
                setRows(res.data as Row[]);
                setPages(res.pagination?.pages || 1);
                setTotal(res.pagination?.total || 0);
            }
            setLoading(false);
        })();
    }, [page]);

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-4">
            <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2"><Crown size={18} className="text-brand-gold" /> Season Leaderboard</h1>
                <p className="text-sm text-white/40 mt-0.5">All-time fantasy points across settled contests. {total.toLocaleString('en-IN')} players.</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-brand-gold" /></div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-white/25 text-sm">No settled entries yet.</div>
            ) : (
                <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-widest text-white/40 border-b border-white/5">
                                <th className="px-4 py-2 text-left">Rank</th>
                                <th className="px-4 py-2 text-left">User</th>
                                <th className="px-4 py-2 text-right">Entries</th>
                                <th className="px-4 py-2 text-right">Wins</th>
                                <th className="px-4 py-2 text-right">Points</th>
                                <th className="px-4 py-2 text-right">Winnings</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={r.userId} className={`border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] ${i < 3 ? 'bg-brand-gold/[0.02]' : ''}`}>
                                    <td className="px-4 py-2.5">
                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-black ${r.rank === 1 ? 'bg-amber-500 text-black' : r.rank === 2 ? 'bg-slate-300 text-black' : r.rank === 3 ? 'bg-orange-600 text-white' : 'bg-white/5 text-white/50'}`}>
                                            {r.rank}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <Link href={`/dashboard/users/${r.userId}`} className="text-white hover:text-brand-gold font-semibold">User #{r.userId}</Link>
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-white/60 font-mono">{r.totalEntries}</td>
                                    <td className="px-4 py-2.5 text-right text-emerald-400 font-mono">{r.wins}</td>
                                    <td className="px-4 py-2.5 text-right text-brand-gold font-mono font-black">{r.totalPoints.toFixed(0)}</td>
                                    <td className="px-4 py-2.5 text-right text-emerald-300 font-mono font-black">₹{r.totalWinnings.toLocaleString('en-IN')}</td>
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
                            className="p-2 rounded-lg bg-bg-elevated text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={14} /></button>
                        <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-lg bg-bg-elevated text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={14} /></button>
                    </div>
                </div>
            )}
        </div>
    );
}
