"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { getBonusRedemptions, adminForfeitBonus, adminCompleteBonus } from '@/actions/marketing';
import { CheckCircle, Search, ChevronLeft, ChevronRight, RefreshCcw, Loader2 } from 'lucide-react';

export default function BonusConversionsPage() {
    const [redemptions, setRedemptions] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [status, setStatus] = useState('PENDING_CONVERSION');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const LIMIT = 20;

    const fetchRedemptions = useCallback(async () => {
        setLoading(true);
        const res = await getBonusRedemptions({
            page, limit: LIMIT,
            status: status === 'ALL' ? undefined : status,
            search: search || undefined,
        });
        if (res.success && res.data) {
            setRedemptions((res.data as any).redemptions || []);
            setTotal((res.data as any).total ?? (res.data as any).pagination?.total ?? 0);
        }
        setLoading(false);
    }, [page, status, search]);

    useEffect(() => { fetchRedemptions(); }, [fetchRedemptions]);

    const handleForfeit = async (id: number) => {
        if (!confirm('Reject conversion and forfeit bonus? Their bonus balance will be cleared.')) return;
        setLoading(true);
        await adminForfeitBonus(id);
        fetchRedemptions();
    };

    const handleComplete = async (id: number) => {
        if (!confirm('Approve conversion? The bonus amount will be converted to real balance.')) return;
        setLoading(true);
        await adminCompleteBonus(id);
        fetchRedemptions();
    };

    const statusBadge = (s: string) => {
        const map: Record<string, string> = {
            ACTIVE: 'bg-blue-500/15 text-blue-400',
            COMPLETED: 'bg-emerald-500/15 text-emerald-400',
            FORFEITED: 'bg-red-500/15 text-red-400',
            PENDING_CONVERSION: 'bg-amber-500/15 text-amber-400',
        };
        return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${map[s] || 'bg-slate-700 text-slate-400'}`}>{s.replace('_', ' ')}</span>;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <CheckCircle size={24} className="text-amber-400" /> Bonus Conversions
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Review and approve bonus conversions when user wagering requirements are met.</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input type="text" placeholder="Search user or code…"
                            className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 w-64"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }} />
                    </div>
                    <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white outline-none focus:border-indigo-500">
                        {['PENDING_CONVERSION', 'ALL', 'ACTIVE', 'COMPLETED', 'FORFEITED'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    <button onClick={fetchRedemptions} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><RefreshCcw size={15} /></button>
                </div>

                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
                    ) : redemptions.length === 0 ? (
                        <div className="text-center py-16 text-slate-500">
                            <p className="text-sm">No conversions found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-slate-500 uppercase bg-slate-900/40 border-b border-slate-700">
                                        <th className="px-4 py-3 text-left">User</th>
                                        <th className="px-4 py-3 text-left">Bonus</th>
                                        <th className="px-4 py-3 text-left">Type</th>
                                        <th className="px-4 py-3 text-left">Bonus Amt</th>
                                        <th className="px-4 py-3 text-left">Wagering Progress</th>
                                        <th className="px-4 py-3 text-left">Status</th>
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {redemptions.map((r: any) => {
                                        const progress = r.wageringRequired > 0
                                            ? Math.min(100, Math.floor((r.wageringDone / r.wageringRequired) * 100)) : 0;
                                        return (
                                            <tr key={r.id} className="hover:bg-slate-700/20 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="text-white font-medium">{r.user?.username || `#${r.userId}`}</div>
                                                    <div className="text-slate-500 text-xs">{r.user?.email || ''}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-mono text-indigo-300 text-xs">{r.bonusCode}</div>
                                                    <div className="text-slate-400 text-xs truncate max-w-[140px]">{r.bonusTitle}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${r.applicableTo === 'CASINO'
                                                        ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                                                        : r.applicableTo === 'SPORTS'
                                                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                            : 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                                                        }`}>
                                                        {r.applicableTo === 'CASINO' ? '🎰 Casino' : r.applicableTo === 'SPORTS' ? '⚽ Sports' : '✦ Both'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-emerald-400 font-semibold">₹{r.bonusAmount}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2 min-w-[120px]">
                                                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress}%` }} />
                                                        </div>
                                                        <span className="text-xs text-slate-400 whitespace-nowrap">{progress}%</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-600 mt-0.5">₹{r.wageringDone?.toFixed(0)} / ₹{r.wageringRequired?.toFixed(0)}</div>
                                                </td>
                                                <td className="px-4 py-3">{statusBadge(r.status)}</td>
                                                <td className="px-4 py-3 text-slate-400 text-xs">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                                                <td className="px-4 py-3">
                                                    {(r.status === 'ACTIVE' || r.status === 'PENDING_CONVERSION') && (
                                                        <div className="flex justify-center gap-1">
                                                            <button onClick={() => handleComplete(r.id)}
                                                                className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded text-xs font-semibold transition-colors">
                                                                {r.status === 'PENDING_CONVERSION' ? 'Approve' : 'Complete'}
                                                            </button>
                                                            <button onClick={() => handleForfeit(r.id)}
                                                                className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-xs font-semibold transition-colors">
                                                                {r.status === 'PENDING_CONVERSION' ? 'Reject' : 'Forfeit'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {total > LIMIT && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
                            <span className="text-sm text-slate-400">{total} total</span>
                            <div className="flex items-center gap-2">
                                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                    className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded text-white transition-colors">
                                    <ChevronLeft size={14} />
                                </button>
                                <span className="text-sm text-white">Page {page} / {Math.ceil(total / LIMIT)}</span>
                                <button disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage(p => p + 1)}
                                    className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded text-white transition-colors">
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
