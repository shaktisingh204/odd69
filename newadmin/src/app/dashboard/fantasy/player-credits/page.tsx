"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, BarChart2, Save, Check, Zap } from 'lucide-react';
import { getCreditOverrides, setCreditOverride, setManualPoints } from '@/actions/fantasy-extras';

interface Override { _id: string; matchId: number; playerId: number; newCredit: number; reason?: string; adminUsername?: string; updatedAt: string }

export default function PlayerCreditsPage() {
    const [rows, setRows] = useState<Override[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterMatch, setFilterMatch] = useState('');

    // Override form
    const [matchId, setMatchId] = useState('');
    const [playerId, setPlayerId] = useState('');
    const [credit, setCredit] = useState('8.5');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [ok, setOk] = useState(false);
    const [err, setErr] = useState('');

    // Manual points
    const [mpPlayer, setMpPlayer] = useState('');
    const [mpPoints, setMpPoints] = useState('0');
    const [mpSaving, setMpSaving] = useState(false);
    const [mpOk, setMpOk] = useState(false);

    const load = async () => {
        setLoading(true);
        const res = await getCreditOverrides(filterMatch.trim() ? Number(filterMatch.trim()) : undefined);
        if (res.success && res.data) setRows(res.data as Override[]);
        setLoading(false);
    };
    useEffect(() => { load(); }, [filterMatch]);

    const submit = async () => {
        if (!matchId || !playerId) { setErr('Match + Player required'); return; }
        setSaving(true); setErr('');
        const res = await setCreditOverride(Number(matchId), Number(playerId), Number(credit), reason);
        setSaving(false);
        if (res.success) { setOk(true); setTimeout(() => setOk(false), 1500); await load(); }
        else setErr(res.error || 'Failed');
    };

    const submitPoints = async () => {
        if (!matchId || !mpPlayer) return;
        setMpSaving(true);
        const res = await setManualPoints(Number(matchId), Number(mpPlayer), Number(mpPoints), reason);
        setMpSaving(false);
        if (res.success) { setMpOk(true); setTimeout(() => setMpOk(false), 1500); }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-5">
            <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2"><BarChart2 size={18} className="text-brand-gold" /> Player Credits & Manual Points</h1>
                <p className="text-sm text-white/40 mt-0.5">Override fantasy credits per match or inject manual points before settlement.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Credit override */}
                <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-5">
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-3">Override credit</h2>
                    <div className="space-y-2">
                        <input value={matchId} onChange={e => setMatchId(e.target.value)} placeholder="External Match ID" className="input" />
                        <input value={playerId} onChange={e => setPlayerId(e.target.value)} placeholder="Player ID" className="input" />
                        <input value={credit} onChange={e => setCredit(e.target.value)} placeholder="New Credit" className="input" />
                        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)" className="input" />
                        {err && <p className="text-xs text-red-400">{err}</p>}
                        <div className="flex justify-end gap-2">
                            {ok && <span className="text-[12px] text-emerald-400 flex items-center gap-1"><Check size={12} /> Saved</span>}
                            <button onClick={submit} disabled={saving}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-gold text-bg-base text-xs font-black hover:bg-brand-gold/90 disabled:opacity-50">
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Override
                            </button>
                        </div>
                    </div>
                </div>

                {/* Manual points */}
                <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-5">
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-3">Manual fantasy points</h2>
                    <div className="space-y-2">
                        <input value={matchId} onChange={e => setMatchId(e.target.value)} placeholder="External Match ID" className="input" />
                        <input value={mpPlayer} onChange={e => setMpPlayer(e.target.value)} placeholder="Player ID" className="input" />
                        <input value={mpPoints} onChange={e => setMpPoints(e.target.value)} placeholder="Points" className="input" />
                        <div className="flex justify-end gap-2">
                            {mpOk && <span className="text-[12px] text-emerald-400 flex items-center gap-1"><Check size={12} /> Saved</span>}
                            <button onClick={submitPoints} disabled={mpSaving}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-gold text-bg-base text-xs font-black hover:bg-brand-gold/90 disabled:opacity-50">
                                {mpSaving ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} Set points
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-5">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40">Existing overrides</h2>
                    <input value={filterMatch} onChange={e => setFilterMatch(e.target.value)}
                        placeholder="Filter by Match ID"
                        className="bg-bg-base text-white text-sm font-medium rounded-xl border border-white/10 px-3 py-1.5 outline-none focus:border-brand-gold/50 w-40" />
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-brand-gold" /></div>
                ) : rows.length === 0 ? (
                    <p className="text-[12px] text-white/25 text-center py-8">No overrides.</p>
                ) : (
                    <div className="space-y-1">
                        {rows.map(o => (
                            <div key={o._id} className="flex items-center gap-3 text-[12px] py-1.5 border-b border-white/5 last:border-0">
                                <span className="text-white/50 font-mono w-20">#{o.matchId}</span>
                                <span className="text-white/70 font-mono w-16">P{o.playerId}</span>
                                <span className="text-brand-gold font-black font-mono">{o.newCredit}</span>
                                <span className="text-white/40 truncate flex-1">{o.reason || '—'}</span>
                                <span className="text-white/20 text-[10px]">{new Date(o.updatedAt).toLocaleDateString('en-IN')}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`:global(.input){width:100%;background:#0b0d11;color:white;font-size:13px;font-weight:600;border-radius:12px;border:1px solid rgba(255,255,255,0.1);padding:8px 12px;outline:none}:global(.input:focus){border-color:rgba(234,179,8,0.5)}`}</style>
        </div>
    );
}
