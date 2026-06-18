"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { getReferrals } from '@/actions/fantasy-extras';

interface Row { _id: string; referrerId: number; refereeId: number; status: string; totalEarned: number; events: any[]; createdAt: string }

export default function ReferralsPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const res = await getReferrals(page, 50);
            if (res.success && res.data) {
                setRows(res.data as Row[]);
                setPages(res.pagination?.pages || 1);
                setTotal(res.pagination?.total || 0);
            }
            setLoading(false);
        })();
    }, [page]);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-4">
            <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2"><Users size={18} className="text-brand-gold" /> Fantasy Referrals</h1>
                <p className="text-sm text-white/40 mt-0.5">{total.toLocaleString('en-IN')} referral pairs.</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-brand-gold" /></div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-white/25 text-sm">No referrals yet.</div>
            ) : (
                <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-widest text-white/40 border-b border-white/5">
                                <th className="px-3 py-2 text-left">Date</th>
                                <th className="px-3 py-2 text-left">Referrer</th>
                                <th className="px-3 py-2 text-left">Referee</th>
                                <th className="px-3 py-2 text-center">Status</th>
                                <th className="px-3 py-2 text-right">Events</th>
                                <th className="px-3 py-2 text-right">Earned</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r._id} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]">
                                    <td className="px-3 py-2.5 text-[11px] text-white/40 font-mono">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                                    <td className="px-3 py-2.5">
                                        <Link href={`/dashboard/users/${r.referrerId}`} className="text-white hover:text-brand-gold font-semibold">#{r.referrerId}</Link>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <Link href={`/dashboard/users/${r.refereeId}`} className="text-white/70 hover:text-brand-gold">#{r.refereeId}</Link>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                                            r.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                                            r.status === 'rewarded' ? 'bg-sky-500/10 text-sky-400' :
                                            r.status === 'blocked' ? 'bg-rose-500/10 text-rose-400' :
                                                                     'bg-amber-500/10 text-amber-400'
                                        }`}>
                                            {r.status}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-white/60 font-mono">{r.events?.length || 0}</td>
                                    <td className="px-3 py-2.5 text-right text-emerald-400 font-mono font-black">₹{(r.totalEarned || 0).toLocaleString('en-IN')}</td>
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
