"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Loader2, Search, RefreshCw, Calendar, Radio, Flag,
    ChevronLeft, ChevronRight, MapPin, Trophy, ExternalLink,
} from 'lucide-react';
import { getFantasyMatches, triggerFantasySync } from '@/actions/fantasy';

interface Match {
    _id: string;
    externalMatchId: number;
    title: string;
    shortTitle?: string;
    competitionTitle?: string;
    format?: string;
    venue?: string;
    startDate?: string;
    status: number;
    statusStr?: string;
    teamA?: { name: string; short: string; logo?: string };
    teamB?: { name: string; short: string; logo?: string };
    playing11Announced?: boolean;
    squads?: any[];
}

const STATUS_LABEL: Record<number, { text: string; cls: string }> = {
    1: { text: 'Upcoming',  cls: 'bg-sky-500/10 text-sky-400' },
    2: { text: 'Live',      cls: 'bg-rose-500/10 text-rose-400 animate-pulse' },
    3: { text: 'Completed', cls: 'bg-white/5 text-white/40' },
};

export default function FantasyMatchesPage() {
    const [rows, setRows] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<string>('ALL');

    const load = useCallback(async () => {
        setLoading(true);
        const res = await getFantasyMatches(page, 30, { search: search.trim() || undefined, status });
        if (res.success && res.data) {
            setRows(res.data as Match[]);
            setTotalPages(res.pagination?.pages || 1);
            setTotal(res.pagination?.total || 0);
        }
        setLoading(false);
    }, [page, search, status]);

    useEffect(() => {
        // Read initial ?status= from URL once on mount
        if (typeof window !== 'undefined') {
            const sp = new URLSearchParams(window.location.search);
            const s = sp.get('status');
            if (s) setStatus(s);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSync = async () => {
        setSyncing(true);
        await triggerFantasySync();
        setSyncing(false);
        await load();
    };

    const tabs = useMemo(() => ([
        { key: 'ALL', label: 'All' },
        { key: '1',   label: 'Upcoming' },
        { key: '2',   label: 'Live' },
        { key: '3',   label: 'Completed' },
    ]), []);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-4">

            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-black text-white">Fantasy Matches</h1>
                    <p className="text-sm text-white/40 mt-0.5">{total} total.</p>
                </div>
                <button onClick={handleSync} disabled={syncing}
                    className="flex items-center gap-1.5 bg-brand-gold text-bg-base px-4 py-2 rounded-xl font-black text-sm hover:bg-brand-gold/90 transition-colors disabled:opacity-50">
                    {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Sync
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
                <div className="flex gap-1 rounded-2xl bg-bg-elevated p-1">
                    {tabs.map(t => (
                        <button key={t.key}
                            onClick={() => { setStatus(t.key); setPage(1); }}
                            className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${status === t.key ? 'bg-brand-gold text-bg-base' : 'text-white/40 hover:text-white'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 min-w-[220px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search title, competition, venue…"
                        className="w-full bg-bg-elevated text-white text-sm font-medium rounded-xl border border-white/10 pl-9 pr-3 py-2 outline-none focus:border-brand-gold/50 transition-colors placeholder:text-white/25" />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 size={24} className="animate-spin text-brand-gold" />
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-white/25 text-sm">
                    No matches found. Click Sync to pull fresh data.
                </div>
            ) : (
                <div className="space-y-2">
                    {rows.map(m => {
                        const st = STATUS_LABEL[m.status] || STATUS_LABEL[1];
                        return (
                            <Link key={m._id} href={`/dashboard/fantasy/matches/${m.externalMatchId}`}
                                className="block rounded-2xl border border-white/[0.06] bg-bg-elevated hover:border-brand-gold/30 transition-all p-4">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">
                                            <span className={`px-1.5 py-0.5 rounded ${st.cls}`}>{m.statusStr || st.text}</span>
                                            {m.format && <span>{m.format}</span>}
                                            {m.competitionTitle && <span className="truncate">• {m.competitionTitle}</span>}
                                        </div>
                                        <p className="text-white text-sm font-black truncate">{m.title}</p>
                                        <div className="flex items-center gap-3 mt-1 text-[11px] text-white/40">
                                            {m.startDate && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Calendar size={11} />
                                                    {new Date(m.startDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                </span>
                                            )}
                                            {m.venue && (
                                                <span className="inline-flex items-center gap-1 truncate">
                                                    <MapPin size={11} /> {m.venue}
                                                </span>
                                            )}
                                            {m.playing11Announced && (
                                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                                    <Flag size={11} /> Playing XI out
                                                </span>
                                            )}
                                            <span className="text-white/25">• {m.squads?.length || 0} squad</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <TeamBadge name={m.teamA?.short || ''} />
                                        <span className="text-white/20 text-xs">vs</span>
                                        <TeamBadge name={m.teamB?.short || ''} />
                                        <ExternalLink size={14} className="text-white/25" />
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
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

function TeamBadge({ name }: { name: string }) {
    return (
        <span className="inline-flex items-center justify-center h-7 px-2 rounded-lg bg-white/[0.04] border border-white/10 text-[10px] font-black text-white/70">
            {name || '—'}
        </span>
    );
}
