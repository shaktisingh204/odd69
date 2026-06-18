"use client";

import React, { useEffect, useState } from 'react';
import {
    Loader2, Plus, Trash2, Eye, EyeOff, X, Layers, Pencil, Link as LinkIcon,
} from 'lucide-react';
import {
    getContestTemplates, createContestTemplate, updateContestTemplate,
    deleteContestTemplate, attachTemplatesToMatch,
} from '@/actions/fantasy-extras';

interface Template {
    _id: string;
    name: string; description: string; type: string;
    entryFee: number; totalPrize: number; maxSpots: number;
    multiEntry: number; isGuaranteed: boolean;
    prizeBreakdown: Array<{ rankFrom: number; rankTo: number; prize: number }>;
    autoFormats: string[]; autoAttach: boolean; isActive: boolean;
    icon?: string; accent?: string;
}

const TYPES = ['mega', 'head2head', 'winner_takes_all', 'practice', 'small'];

const emptyDraft = (): Partial<Template> => ({
    name: '', description: '', type: 'mega',
    entryFee: 49, totalPrize: 10000, maxSpots: 250,
    multiEntry: 1, isGuaranteed: false,
    prizeBreakdown: [{ rankFrom: 1, rankTo: 1, prize: 5000 }],
    autoFormats: ['T20'], autoAttach: false, isActive: true,
});

export default function TemplatesPage() {
    const [rows, setRows] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState<Partial<Template> | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const [attachMatchId, setAttachMatchId] = useState('');
    const [attachIds, setAttachIds] = useState<Set<string>>(new Set());
    const [attachMsg, setAttachMsg] = useState('');

    const load = async () => {
        setLoading(true);
        const res = await getContestTemplates();
        if (res.success && res.data) setRows(res.data as Template[]);
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const submit = async () => {
        if (!draft?.name) { setErr('Name required'); return; }
        setSaving(true); setErr('');
        const res = editingId
            ? await updateContestTemplate(editingId, draft)
            : await createContestTemplate(draft);
        setSaving(false);
        if (res.success) { setDraft(null); setEditingId(null); await load(); }
        else setErr(res.error || 'Failed');
    };

    const handleAttach = async () => {
        const mid = Number(attachMatchId);
        if (!mid || attachIds.size === 0) { setAttachMsg('Pick a match ID + at least one template'); return; }
        const res = await attachTemplatesToMatch(mid, Array.from(attachIds));
        setAttachMsg(res.success ? `Created ${(res.data as any)?.created?.length || 0} contests.` : (res.error || 'Failed'));
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-white flex items-center gap-2"><Layers size={18} className="text-brand-gold" /> Contest Templates</h1>
                    <p className="text-sm text-white/40 mt-0.5">Reusable contest blueprints — attach to any match, or auto-attach on sync.</p>
                </div>
                <button onClick={() => { setDraft(emptyDraft()); setEditingId(null); setErr(''); }}
                    className="flex items-center gap-1.5 bg-brand-gold text-bg-base px-4 py-2 rounded-xl font-black text-sm hover:bg-brand-gold/90">
                    <Plus size={14} /> New Template
                </button>
            </div>

            {/* Bulk-attach tool */}
            <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-4">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-2 flex items-center gap-1.5"><LinkIcon size={12} /> Attach selected templates to a match</h2>
                <div className="flex flex-wrap gap-2 items-center">
                    <input value={attachMatchId} onChange={e => setAttachMatchId(e.target.value)}
                        placeholder="External Match ID"
                        className="bg-bg-base text-white text-sm font-medium rounded-xl border border-white/10 px-3 py-2 outline-none focus:border-brand-gold/50 w-40" />
                    <span className="text-[11px] text-white/40">{attachIds.size} selected</span>
                    <button onClick={handleAttach}
                        className="ml-auto px-4 py-2 rounded-xl bg-brand-gold text-bg-base text-xs font-black hover:bg-brand-gold/90">Attach</button>
                </div>
                {attachMsg && <p className="text-[11px] text-brand-gold/80 mt-2">{attachMsg}</p>}
            </div>

            {draft && (
                <div className="rounded-2xl border border-white/10 bg-bg-elevated p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="font-black text-white text-sm">{editingId ? 'Edit Template' : 'New Template'}</span>
                        <button onClick={() => { setDraft(null); setEditingId(null); }} className="text-white/40 hover:text-white"><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <F label="Name *" wide>
                            <input value={draft.name || ''} onChange={e => setDraft(d => ({ ...d!, name: e.target.value }))} className="input" />
                        </F>
                        <F label="Type">
                            <select value={draft.type || 'mega'} onChange={e => setDraft(d => ({ ...d!, type: e.target.value }))} className="input">
                                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </F>
                        <F label="Entry Fee"><input type="number" value={draft.entryFee ?? 0} onChange={e => setDraft(d => ({ ...d!, entryFee: Number(e.target.value) }))} className="input" /></F>
                        <F label="Total Prize"><input type="number" value={draft.totalPrize ?? 0} onChange={e => setDraft(d => ({ ...d!, totalPrize: Number(e.target.value) }))} className="input" /></F>
                        <F label="Max Spots"><input type="number" value={draft.maxSpots ?? 0} onChange={e => setDraft(d => ({ ...d!, maxSpots: Number(e.target.value) }))} className="input" /></F>
                        <F label="Multi entry"><input type="number" value={draft.multiEntry ?? 1} onChange={e => setDraft(d => ({ ...d!, multiEntry: Number(e.target.value) }))} className="input" /></F>
                        <F label="Auto-formats (csv)"><input value={(draft.autoFormats || []).join(',')} onChange={e => setDraft(d => ({ ...d!, autoFormats: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} className="input" /></F>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-[12px] text-white/60 cursor-pointer">
                            <input type="checkbox" checked={!!draft.isActive} onChange={e => setDraft(d => ({ ...d!, isActive: e.target.checked }))} className="accent-brand-gold" /> Active
                        </label>
                        <label className="flex items-center gap-2 text-[12px] text-white/60 cursor-pointer">
                            <input type="checkbox" checked={!!draft.isGuaranteed} onChange={e => setDraft(d => ({ ...d!, isGuaranteed: e.target.checked }))} className="accent-brand-gold" /> Guaranteed
                        </label>
                        <label className="flex items-center gap-2 text-[12px] text-white/60 cursor-pointer">
                            <input type="checkbox" checked={!!draft.autoAttach} onChange={e => setDraft(d => ({ ...d!, autoAttach: e.target.checked }))} className="accent-brand-gold" /> Auto-attach to new matches
                        </label>
                    </div>
                    {err && <p className="text-xs text-red-400">{err}</p>}
                    <div className="flex justify-end gap-2">
                        <button onClick={() => { setDraft(null); setEditingId(null); }} className="px-3 py-2 rounded-xl text-xs font-black text-white/40 hover:text-white">Cancel</button>
                        <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-gold text-bg-base text-xs font-black hover:bg-brand-gold/90 disabled:opacity-50">
                            {saving && <Loader2 size={12} className="animate-spin" />} {editingId ? 'Save' : 'Create'}
                        </button>
                    </div>
                    <style jsx>{`:global(.input){width:100%;background:#0b0d11;color:white;font-size:13px;font-weight:600;border-radius:12px;border:1px solid rgba(255,255,255,0.1);padding:8px 12px;outline:none}:global(.input:focus){border-color:rgba(234,179,8,0.5)}`}</style>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-brand-gold" /></div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-white/25 text-sm">No templates yet.</div>
            ) : (
                <div className="space-y-2">
                    {rows.map(t => (
                        <div key={t._id} className={`rounded-2xl border p-4 ${t.isActive ? 'border-white/[0.06] bg-bg-elevated' : 'border-white/[0.03] bg-bg-base opacity-60'}`}>
                            <div className="flex items-center gap-3">
                                <input type="checkbox"
                                    checked={attachIds.has(t._id)}
                                    onChange={e => setAttachIds(prev => { const s = new Set(prev); e.target.checked ? s.add(t._id) : s.delete(t._id); return s; })}
                                    className="accent-brand-gold" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-black">
                                        {t.name}
                                        <span className="ml-2 text-[9px] uppercase tracking-widest text-white/40">{t.type}</span>
                                        {t.autoAttach && <span className="ml-2 text-[9px] text-emerald-400">auto</span>}
                                        {t.isGuaranteed && <span className="ml-2 text-[9px] text-sky-400">guaranteed</span>}
                                    </p>
                                    <p className="text-[11px] text-white/40 mt-0.5">Entry ₹{t.entryFee} • Prize ₹{t.totalPrize.toLocaleString('en-IN')} • {t.maxSpots} spots • {t.multiEntry}x entries</p>
                                    <p className="text-[10px] text-white/25">Formats: {(t.autoFormats || []).join(', ')}</p>
                                </div>
                                <button onClick={() => { setDraft({ ...t }); setEditingId(t._id); setErr(''); }} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><Pencil size={13} /></button>
                                <button onClick={async () => { await updateContestTemplate(t._id, { isActive: !t.isActive }); await load(); }}
                                    className={`p-2 rounded-lg ${t.isActive ? 'text-brand-gold' : 'text-white/25'} hover:bg-white/5`}>{t.isActive ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                                <button onClick={async () => { if (!confirm(`Delete "${t.name}"?`)) return; await deleteContestTemplate(t._id); await load(); }}
                                    className="p-2 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function F({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
    return (
        <div className={wide ? 'md:col-span-2' : ''}>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1 block">{label}</label>
            {children}
        </div>
    );
}
