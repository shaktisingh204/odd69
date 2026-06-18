"use client";

import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Eye, EyeOff, X, Tag, Pencil } from 'lucide-react';
import { getPromocodes, createPromocode, updatePromocode, deletePromocode } from '@/actions/fantasy-extras';

interface Promo {
    _id: string;
    code: string; description: string;
    discountPercent: number; flatOff: number;
    maxDiscount: number; minEntryFee: number;
    maxUsesTotal: number; maxUsesPerUser: number; usesSoFar: number;
    allowedMatches: number[]; allowedContestTypes: string[];
    validFrom?: string; validTo?: string;
    isActive: boolean; firstTimeUserOnly: boolean;
    createdAt?: string;
}

const emptyDraft = (): Partial<Promo> => ({
    code: '', description: '', discountPercent: 10, flatOff: 0, maxDiscount: 0,
    minEntryFee: 0, maxUsesTotal: 0, maxUsesPerUser: 1,
    allowedMatches: [], allowedContestTypes: [], isActive: true, firstTimeUserOnly: false,
});

export default function PromocodesPage() {
    const [rows, setRows] = useState<Promo[]>([]);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState<Partial<Promo> | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const load = async () => {
        setLoading(true);
        const res = await getPromocodes();
        if (res.success && res.data) setRows(res.data as Promo[]);
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const startCreate = () => { setDraft(emptyDraft()); setEditingId(null); setErr(''); };
    const startEdit = (p: Promo) => {
        setDraft({ ...p }); setEditingId(p._id); setErr('');
    };

    const submit = async () => {
        if (!draft?.code) { setErr('Code required'); return; }
        setSaving(true); setErr('');
        const res = editingId
            ? await updatePromocode(editingId, draft)
            : await createPromocode(draft);
        setSaving(false);
        if (res.success) { setDraft(null); await load(); }
        else setErr(res.error || 'Failed');
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-white flex items-center gap-2"><Tag size={18} className="text-brand-gold" /> Promocodes</h1>
                    <p className="text-sm text-white/40 mt-0.5">Discount codes that reduce contest entry fees.</p>
                </div>
                <button onClick={startCreate}
                    className="flex items-center gap-1.5 bg-brand-gold text-bg-base px-4 py-2 rounded-xl font-black text-sm hover:bg-brand-gold/90">
                    <Plus size={14} /> New Code
                </button>
            </div>

            {draft && (
                <div className="rounded-2xl border border-white/10 bg-bg-elevated p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="font-black text-white text-sm">{editingId ? 'Edit Code' : 'New Promocode'}</span>
                        <button onClick={() => setDraft(null)} className="text-white/40 hover:text-white"><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <FI label="Code *">
                            <input value={draft.code || ''} onChange={e => setDraft(d => ({ ...d!, code: e.target.value.toUpperCase() }))} className="input" />
                        </FI>
                        <FI label="Description" wide>
                            <input value={draft.description || ''} onChange={e => setDraft(d => ({ ...d!, description: e.target.value }))} className="input" />
                        </FI>
                        <FI label="% Discount"><input type="number" value={draft.discountPercent ?? 0} onChange={e => setDraft(d => ({ ...d!, discountPercent: Number(e.target.value) }))} className="input" /></FI>
                        <FI label="Flat off (₹)"><input type="number" value={draft.flatOff ?? 0} onChange={e => setDraft(d => ({ ...d!, flatOff: Number(e.target.value) }))} className="input" /></FI>
                        <FI label="Max discount (₹)"><input type="number" value={draft.maxDiscount ?? 0} onChange={e => setDraft(d => ({ ...d!, maxDiscount: Number(e.target.value) }))} className="input" /></FI>
                        <FI label="Min entry fee"><input type="number" value={draft.minEntryFee ?? 0} onChange={e => setDraft(d => ({ ...d!, minEntryFee: Number(e.target.value) }))} className="input" /></FI>
                        <FI label="Max uses (0=∞)"><input type="number" value={draft.maxUsesTotal ?? 0} onChange={e => setDraft(d => ({ ...d!, maxUsesTotal: Number(e.target.value) }))} className="input" /></FI>
                        <FI label="Max uses / user"><input type="number" value={draft.maxUsesPerUser ?? 1} onChange={e => setDraft(d => ({ ...d!, maxUsesPerUser: Number(e.target.value) }))} className="input" /></FI>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-[12px] text-white/60 cursor-pointer">
                            <input type="checkbox" checked={!!draft.isActive} onChange={e => setDraft(d => ({ ...d!, isActive: e.target.checked }))} className="accent-brand-gold" /> Active
                        </label>
                        <label className="flex items-center gap-2 text-[12px] text-white/60 cursor-pointer">
                            <input type="checkbox" checked={!!draft.firstTimeUserOnly} onChange={e => setDraft(d => ({ ...d!, firstTimeUserOnly: e.target.checked }))} className="accent-brand-gold" /> First-time users only
                        </label>
                    </div>
                    {err && <p className="text-xs text-red-400">{err}</p>}
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setDraft(null)} className="px-3 py-2 rounded-xl text-xs font-black text-white/40 hover:text-white">Cancel</button>
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
                <div className="text-center py-16 text-white/25 text-sm">No promocodes yet.</div>
            ) : (
                <div className="space-y-2">
                    {rows.map(p => (
                        <div key={p._id} className={`rounded-2xl border p-4 transition-all ${p.isActive ? 'border-white/[0.06] bg-bg-elevated' : 'border-white/[0.03] bg-bg-base opacity-60'}`}>
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="px-2.5 py-1 rounded-lg bg-brand-gold/10 text-brand-gold font-mono font-black text-xs">{p.code}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-black truncate">
                                        {p.flatOff > 0 ? `₹${p.flatOff} off` : `${p.discountPercent}% off`}
                                        {p.maxDiscount > 0 && <span className="text-white/40 ml-1">(max ₹{p.maxDiscount})</span>}
                                        {p.firstTimeUserOnly && <span className="ml-2 text-[9px] uppercase tracking-widest text-sky-400">first-time</span>}
                                    </p>
                                    {p.description && <p className="text-[11px] text-white/40 truncate">{p.description}</p>}
                                    <p className="text-[10px] text-white/30 mt-0.5">
                                        Min ₹{p.minEntryFee} • Used {p.usesSoFar}{p.maxUsesTotal ? `/${p.maxUsesTotal}` : ''} • Per user {p.maxUsesPerUser}
                                    </p>
                                </div>
                                <button onClick={() => startEdit(p)} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><Pencil size={13} /></button>
                                <button onClick={async () => { await updatePromocode(p._id, { isActive: !p.isActive }); await load(); }}
                                    className={`p-2 rounded-lg ${p.isActive ? 'text-brand-gold' : 'text-white/25'} hover:bg-white/5`}>
                                    {p.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                                <button onClick={async () => { if (!confirm(`Delete code ${p.code}?`)) return; await deletePromocode(p._id); await load(); }}
                                    className="p-2 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function FI({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
    return (
        <div className={wide ? 'md:col-span-2' : ''}>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1 block">{label}</label>
            {children}
        </div>
    );
}
