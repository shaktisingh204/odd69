"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { getActivityLog } from '@/actions/fantasy-extras';

interface Row {
    _id: string; action: string; adminUsername?: string;
    targetType?: string; targetId?: string;
    payload?: any; note?: string; createdAt: string;
}

export default function ActivityLogPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [filter, setFilter] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        const res = await getActivityLog(page, 100, filter.trim() || undefined);
        if (res.success && res.data) {
            setRows(res.data as Row[]);
            setPages(res.pagination?.pages || 1);
            setTotal(res.pagination?.total || 0);
        }
        setLoading(false);
    };
    useEffect(() => { load(); }, [page, filter]);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-4">
            <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2"><FileText size={18} className="text-brand-gold" /> Activity Log</h1>
                <p className="text-sm text-white/40 mt-0.5">Every admin-triggered fantasy action. {total.toLocaleString('en-IN')} entries.</p>
            </div>

            <div className="flex gap-2">
                <input value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
                    placeholder="Filter by action (e.g. settle-contest)"
                    className="flex-1 bg-bg-elevated text-white text-sm font-medium rounded-xl border border-white/10 px-3 py-2 outline-none focus:border-brand-gold/50" />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-brand-gold" /></div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-white/25 text-sm">No log entries.</div>
            ) : (
                <div className="space-y-1">
                    {rows.map(r => (
                        <div key={r._id} className="rounded-xl border border-white/[0.06] bg-bg-elevated p-3">
                            <button onClick={() => setExpanded(expanded === r._id ? null : r._id)}
                                className="w-full flex items-center gap-3 text-left">
                                <span className="text-[10px] font-black uppercase tracking-widest text-brand-gold bg-brand-gold/10 rounded-md px-2 py-1">{r.action}</span>
                                <span className="text-[11px] text-white/40 font-mono">{new Date(r.createdAt).toLocaleString('en-IN')}</span>
                                <span className="text-[11px] text-white/60 truncate flex-1">
                                    {r.adminUsername || 'system'}
                                    {r.targetType && <span className="text-white/30"> • {r.targetType}:{r.targetId}</span>}
                                </span>
                            </button>
                            {expanded === r._id && (
                                <pre className="mt-2 text-[10px] text-white/50 font-mono bg-bg-base rounded-lg p-2 overflow-auto max-h-64">
{JSON.stringify(r.payload, null, 2)}
                                </pre>
                            )}
                        </div>
                    ))}
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
