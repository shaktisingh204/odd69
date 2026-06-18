"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Loader2, Plus, Trash2, Eye, EyeOff, X, Trophy, Edit2,
    ChevronDown, ChevronRight,
} from 'lucide-react';
import {
    getFantasyContests, createFantasyContest, updateFantasyContest,
    deleteFantasyContest, toggleFantasyContest, getFantasyContestLeaderboard,
} from '@/actions/fantasy';
import {
    settleContest, refundContest, cancelContest, duplicateContest,
} from '@/actions/fantasy-extras';
import { Check, RotateCcw, Copy, XCircle } from 'lucide-react';

interface Contest {
    _id: string;
    matchId: number;
    title: string;
    type: string;
    entryFee: number;
    totalPrize: number;
    maxSpots: number;
    filledSpots: number;
    prizeBreakdown: Array<{ rankFrom: number; rankTo: number; prize: number; percentOfPool?: number }>;
    isActive: boolean;
    icon?: string;
    accent?: string;
    createdAt?: string;
}

interface Entry {
    _id: string;
    userId: number;
    teamId: string;
    totalPoints: number;
    rank: number;
    winnings: number;
    status: string;
}

const CONTEST_TYPES = ['mega', 'head2head', 'winner_takes_all', 'practice', 'small'] as const;

function emptyPrizeRow() {
    return { rankFrom: 1, rankTo: 1, prize: 0 };
}

export default function FantasyContestsPage() {
    const [rows, setRows] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);
    const [matchFilter, setMatchFilter] = useState('');

    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<Contest | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [leaderboard, setLeaderboard] = useState<Record<string, Entry[]>>({});

    const load = useCallback(async () => {
        setLoading(true);
        const mid = matchFilter.trim() ? Number(matchFilter.trim()) : undefined;
        const res = await getFantasyContests(mid, 1, 200);
        if (res.success && res.data) setRows(res.data as Contest[]);
        setLoading(false);
    }, [matchFilter]);

    useEffect(() => {
        // Read ?matchId= once
        if (typeof window !== 'undefined') {
            const sp = new URLSearchParams(window.location.search);
            const mid = sp.get('matchId');
            if (mid) setMatchFilter(mid);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const toggleExpand = async (c: Contest) => {
        if (expanded === c._id) { setExpanded(null); return; }
        setExpanded(c._id);
        if (!leaderboard[c._id]) {
            const res = await getFantasyContestLeaderboard(c._id, 1, 25);
            if (res.success && res.data) setLeaderboard(prev => ({ ...prev, [c._id]: res.data as Entry[] }));
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-4">

            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-black text-white">Fantasy Contests</h1>
                    <p className="text-sm text-white/40 mt-0.5">Create and manage paid/free contests per match.</p>
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-1.5 bg-brand-gold text-bg-base px-4 py-2 rounded-xl font-black text-sm hover:bg-brand-gold/90">
                    <Plus size={14} /> New Contest
                </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
                <input value={matchFilter}
                    onChange={e => setMatchFilter(e.target.value)}
                    placeholder="Filter by External Match ID (blank = all)"
                    className="bg-bg-elevated text-white text-sm font-medium rounded-xl border border-white/10 px-3 py-2 outline-none focus:border-brand-gold/50 placeholder:text-white/25" />
                {matchFilter && (
                    <button onClick={() => setMatchFilter('')} className="text-white/40 hover:text-white text-xs">Clear</button>
                )}
            </div>

            {(showCreate || editing) && (
                <ContestForm
                    existing={editing}
                    defaultMatchId={matchFilter.trim() ? Number(matchFilter.trim()) : undefined}
                    onCancel={() => { setShowCreate(false); setEditing(null); }}
                    onSaved={async () => {
                        setShowCreate(false); setEditing(null);
                        await load();
                    }}
                />
            )}

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 size={24} className="animate-spin text-brand-gold" />
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-white/25 text-sm">
                    No contests yet. Click "New Contest" to add one.
                </div>
            ) : (
                <div className="space-y-2">
                    {rows.map(c => {
                        const pct = c.maxSpots > 0 ? Math.round((c.filledSpots / c.maxSpots) * 100) : 0;
                        return (
                            <div key={c._id} className={`rounded-2xl border transition-all ${c.isActive ? 'border-white/[0.06] bg-bg-elevated' : 'border-white/[0.03] bg-bg-base opacity-60'}`}>
                                <div className="p-4">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => toggleExpand(c)} className="text-white/30 hover:text-white">
                                            {expanded === c._id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </button>
                                        <div className="h-9 w-9 rounded-xl bg-brand-gold/10 text-brand-gold flex items-center justify-center flex-shrink-0">
                                            <Trophy size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30">
                                                <span>{c.type}</span>
                                                <Link href={`/dashboard/fantasy/matches/${c.matchId}`} className="hover:text-brand-gold">
                                                    Match #{c.matchId}
                                                </Link>
                                            </div>
                                            <p className="text-white text-sm font-black truncate">{c.title}</p>
                                            <p className="text-[11px] text-white/40 mt-0.5">
                                                Entry ₹{c.entryFee} • Prize ₹{c.totalPrize.toLocaleString('en-IN')} • {c.maxSpots} spots
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[11px] text-white/40">Filled</p>
                                            <p className="text-sm font-black text-white">{c.filledSpots}/{c.maxSpots}</p>
                                            <div className="w-20 h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                                                <div className="h-full bg-brand-gold" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                        <button onClick={() => setEditing(c)}
                                            className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5" title="Edit">
                                            <Edit2 size={13} />
                                        </button>
                                        <button onClick={async () => {
                                                if (!confirm(`Settle contest "${c.title}"? Pays out winnings based on match fantasy points.`)) return;
                                                const res = await settleContest(c._id, 'manual admin settle');
                                                alert(res.success ? `Settled ${(res.data as any)?.settled ?? 0} entries.` : (res.error || 'Failed'));
                                                await load();
                                            }}
                                            className="p-2 rounded-lg text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10" title="Settle">
                                            <Check size={14} />
                                        </button>
                                        <button onClick={async () => {
                                                const reason = prompt('Refund reason?', 'admin refund') || '';
                                                if (!confirm(`Refund ALL entries for "${c.title}"?`)) return;
                                                const res = await refundContest(c._id, reason);
                                                alert(res.success ? `Refunded ${(res.data as any)?.refunded ?? 0} entries.` : (res.error || 'Failed'));
                                                await load();
                                            }}
                                            className="p-2 rounded-lg text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10" title="Refund">
                                            <RotateCcw size={13} />
                                        </button>
                                        <button onClick={async () => {
                                                const reason = prompt('Cancellation reason?', 'cancelled by admin') || '';
                                                if (!confirm(`Cancel "${c.title}" and refund all entries?`)) return;
                                                const res = await cancelContest(c._id, reason, true);
                                                alert(res.success ? 'Cancelled and refunded.' : (res.error || 'Failed'));
                                                await load();
                                            }}
                                            className="p-2 rounded-lg text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10" title="Cancel">
                                            <XCircle size={13} />
                                        </button>
                                        <button onClick={async () => {
                                                const res = await duplicateContest(c._id);
                                                if (res.success) await load();
                                                else alert(res.error || 'Failed');
                                            }}
                                            className="p-2 rounded-lg text-sky-400/60 hover:text-sky-400 hover:bg-sky-500/10" title="Duplicate">
                                            <Copy size={13} />
                                        </button>
                                        <button onClick={async () => { await toggleFantasyContest(c._id, !c.isActive); await load(); }}
                                            className={`p-2 rounded-lg transition-colors ${c.isActive ? 'text-brand-gold hover:bg-brand-gold/10' : 'text-white/25 hover:text-white/60'}`} title={c.isActive ? 'Hide' : 'Show'}>
                                            {c.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                                        </button>
                                        <button onClick={async () => {
                                                if (!confirm(`Delete contest "${c.title}"?`)) return;
                                                const res = await deleteFantasyContest(c._id);
                                                if (!res.success) alert(res.error);
                                                await load();
                                            }}
                                            className="p-2 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10" title="Delete">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>

                                    {expanded === c._id && (
                                        <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Prize breakdown */}
                                            <div>
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Prize breakdown</h4>
                                                {c.prizeBreakdown?.length ? (
                                                    <div className="space-y-1">
                                                        {c.prizeBreakdown.map((p, i) => (
                                                            <div key={i} className="flex items-center justify-between text-[12px] bg-bg-base rounded-lg px-2.5 py-1.5">
                                                                <span className="text-white/50 font-mono">
                                                                    #{p.rankFrom}{p.rankTo !== p.rankFrom ? `–${p.rankTo}` : ''}
                                                                </span>
                                                                <span className="text-brand-gold font-black">₹{p.prize.toLocaleString('en-IN')}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-white/25">No breakdown defined.</p>
                                                )}
                                            </div>

                                            {/* Leaderboard */}
                                            <div>
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Leaderboard (top 25)</h4>
                                                {(leaderboard[c._id] || []).length > 0 ? (
                                                    <div className="space-y-0.5 max-h-[240px] overflow-y-auto">
                                                        {leaderboard[c._id].map((e, i) => (
                                                            <div key={e._id} className="flex items-center gap-2 text-[11px] py-1 border-b border-white/5 last:border-0">
                                                                <span className="w-5 text-white/30 font-mono text-[10px]">#{e.rank || i + 1}</span>
                                                                <Link href={`/dashboard/users/${e.userId}`} className="text-white/80 hover:text-brand-gold flex-1 truncate">
                                                                    User #{e.userId}
                                                                </Link>
                                                                <span className="text-white/50 font-mono">{e.totalPoints} pts</span>
                                                                {e.winnings > 0 && (
                                                                    <span className="text-emerald-400 font-black font-mono ml-1">
                                                                        ₹{e.winnings.toLocaleString('en-IN')}
                                                                    </span>
                                                                )}
                                                                <span className={`text-[9px] uppercase tracking-wider ${e.status === 'settled' ? 'text-emerald-300' : 'text-white/30'}`}>
                                                                    {e.status}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-white/25">No entries yet.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Create / Edit form ───────────────────────────────────────────────────────

function ContestForm({ existing, defaultMatchId, onCancel, onSaved }: {
    existing: Contest | null;
    defaultMatchId?: number;
    onCancel: () => void;
    onSaved: () => void;
}) {
    const [matchId, setMatchId] = useState<number>(existing?.matchId ?? defaultMatchId ?? 0);
    const [title, setTitle] = useState(existing?.title ?? '');
    const [type, setType] = useState(existing?.type ?? 'mega');
    const [entryFee, setEntryFee] = useState<number>(existing?.entryFee ?? 49);
    const [totalPrize, setTotalPrize] = useState<number>(existing?.totalPrize ?? 10000);
    const [maxSpots, setMaxSpots] = useState<number>(existing?.maxSpots ?? 250);
    const [prizeRows, setPrizeRows] = useState(existing?.prizeBreakdown?.length
        ? existing.prizeBreakdown.map(p => ({ rankFrom: p.rankFrom, rankTo: p.rankTo, prize: p.prize }))
        : [emptyPrizeRow()]);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const handleSubmit = async () => {
        setErr('');
        if (!matchId) { setErr('Match ID required'); return; }
        if (!title.trim()) { setErr('Title required'); return; }
        if (maxSpots < 2) { setErr('Spots must be ≥ 2'); return; }
        setSaving(true);
        const payload = {
            matchId,
            title: title.trim(),
            type,
            entryFee,
            totalPrize,
            maxSpots,
            prizeBreakdown: prizeRows.filter(r => r.prize > 0),
        };
        const res = existing
            ? await updateFantasyContest(existing._id, payload)
            : await createFantasyContest(payload);
        setSaving(false);
        if (res.success) onSaved();
        else setErr(res.error || 'Failed');
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-bg-elevated p-5 space-y-4">
            <div className="flex items-center justify-between">
                <span className="font-black text-white text-sm">{existing ? 'Edit Contest' : 'New Contest'}</span>
                <button onClick={onCancel} className="p-1 rounded-lg text-white/40 hover:text-white"><X size={14} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="External Match ID *">
                    <input type="number" value={matchId || ''}
                        onChange={e => setMatchId(Number(e.target.value))}
                        disabled={!!existing}
                        className="input" />
                </Field>
                <Field label="Type">
                    <select value={type} onChange={e => setType(e.target.value)} className="input">
                        {CONTEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </Field>
                <Field label="Title *" wide>
                    <input value={title} onChange={e => setTitle(e.target.value)}
                        placeholder="e.g. Mega Contest — ₹10 Lakh"
                        className="input" />
                </Field>
                <Field label="Entry Fee (₹)">
                    <input type="number" value={entryFee}
                        onChange={e => setEntryFee(Number(e.target.value))}
                        className="input" />
                </Field>
                <Field label="Total Prize (₹)">
                    <input type="number" value={totalPrize}
                        onChange={e => setTotalPrize(Number(e.target.value))}
                        className="input" />
                </Field>
                <Field label="Max Spots">
                    <input type="number" value={maxSpots}
                        onChange={e => setMaxSpots(Number(e.target.value))}
                        className="input" />
                </Field>
            </div>

            {/* Prize breakdown rows */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30">
                        Prize Breakdown
                    </label>
                    <button onClick={() => setPrizeRows(r => [...r, emptyPrizeRow()])}
                        className="text-[11px] font-black text-brand-gold hover:text-white">+ Row</button>
                </div>
                <div className="space-y-1.5">
                    {prizeRows.map((row, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <input type="number" value={row.rankFrom}
                                onChange={e => setPrizeRows(rows => rows.map((r, idx) => idx === i ? { ...r, rankFrom: Number(e.target.value) } : r))}
                                placeholder="From" className="input w-20" />
                            <span className="text-white/30 text-xs">–</span>
                            <input type="number" value={row.rankTo}
                                onChange={e => setPrizeRows(rows => rows.map((r, idx) => idx === i ? { ...r, rankTo: Number(e.target.value) } : r))}
                                placeholder="To" className="input w-20" />
                            <input type="number" value={row.prize}
                                onChange={e => setPrizeRows(rows => rows.map((r, idx) => idx === i ? { ...r, prize: Number(e.target.value) } : r))}
                                placeholder="Prize (₹)" className="input flex-1" />
                            <button onClick={() => setPrizeRows(rows => rows.filter((_, idx) => idx !== i))}
                                className="p-2 rounded-lg text-red-400/40 hover:text-red-400">
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {err && <p className="text-xs text-red-400">{err}</p>}

            <div className="flex justify-end gap-2">
                <button onClick={onCancel}
                    className="px-3 py-2 rounded-xl text-xs font-black text-white/40 hover:text-white">Cancel</button>
                <button onClick={handleSubmit} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-gold text-bg-base text-xs font-black hover:bg-brand-gold/90 disabled:opacity-50">
                    {saving && <Loader2 size={12} className="animate-spin" />}
                    {existing ? 'Save' : 'Create'}
                </button>
            </div>

            <style jsx>{`
                :global(.input) {
                    width: 100%;
                    background: #0b0d11;
                    color: white;
                    font-size: 13px;
                    font-weight: 600;
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 8px 12px;
                    outline: none;
                    transition: border-color .15s;
                }
                :global(.input:focus) { border-color: rgba(234,179,8,0.5); }
                :global(.input:disabled) { opacity: 0.5; cursor: not-allowed; }
            `}</style>
        </div>
    );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
    return (
        <div className={wide ? 'md:col-span-2' : ''}>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1 block">{label}</label>
            {children}
        </div>
    );
}
