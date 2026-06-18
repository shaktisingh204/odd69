"use client";

import React, { useEffect, useState, useRef } from 'react';
import {
    getPromotions, createPromotion, updatePromotion, deletePromotion
} from '@/actions/cms';
import { uploadImageToWebsitePublic } from '@/actions/upload';
import {
    Plus, Edit2, Trash2, Loader2, X, Upload, Star, Eye, EyeOff,
    LayoutGrid, Gamepad2, Zap, Radio, Crown, Tag, Percent,
    ChevronDown, BadgeCheck, Clock
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Promotion {
    _id: string;
    title: string;
    subtitle?: string;
    description?: string;
    termsAndConditions?: string;
    category: string;
    promoCode?: string;
    minDeposit?: number;
    bonusPercentage?: number;
    maxBonus?: number;
    wageringMultiplier?: number;
    validityDays?: number;
    currency?: string;
    targetAudience?: string;
    claimLimit?: number;
    claimCount?: number;
    startDate?: string;
    expiryDate?: string;
    buttonText?: string;
    buttonLink?: string;
    bgImage?: string;
    charImage?: string;
    gradient?: string;
    badgeLabel?: string;
    isActive: boolean;
    isFeatured: boolean;
    showInApp: boolean;
    order: number;
}

const EMPTY_FORM: Omit<Promotion, '_id'> = {
    title: '', subtitle: '', description: '', termsAndConditions: '',
    category: 'ALL', promoCode: '', minDeposit: 0, bonusPercentage: 0,
    maxBonus: 0, wageringMultiplier: 0, validityDays: 30, currency: 'BOTH',
    targetAudience: 'ALL', claimLimit: 0, claimCount: 0,
    startDate: '', expiryDate: '', buttonText: 'CLAIM NOW', buttonLink: '/register',
    bgImage: '', charImage: '', gradient: 'linear-gradient(135deg, #E37D32, #AE5910)',
    badgeLabel: '', isActive: true, isFeatured: false, showInApp: false, order: 0,
};

const CATEGORIES = [
    { id: '', label: 'All' },
    { id: 'ALL', label: 'General' },
    { id: 'CASINO', label: 'Casino' },
    { id: 'SPORTS', label: 'Sports' },
    { id: 'LIVE', label: 'Live' },
    { id: 'VIP', label: 'VIP' },
];

const GRADIENT_PRESETS = [
    { label: 'Gold', value: 'linear-gradient(135deg, #E37D32, #AE5910)' },
    { label: 'Purple', value: 'linear-gradient(135deg, #7B5CD6, #4A2FA1)' },
    { label: 'Blue', value: 'linear-gradient(135deg, #2D7DD2, #1A4A8A)' },
    { label: 'Teal', value: 'linear-gradient(135deg, #2FA4A9, #1A6A6E)' },
    { label: 'Green', value: 'linear-gradient(135deg, #4CAF50, #2E7D32)' },
    { label: 'Red', value: 'linear-gradient(135deg, #E24C4C, #A52E2E)' },
    { label: 'Dark', value: 'linear-gradient(135deg, #2A2A2E, #1A1A1E)' },
];

const BADGE_PRESETS = ['HOT', 'NEW', 'EXCLUSIVE', 'LIMITED', 'FEATURED', 'VIP ONLY'];

// ─── Mini card preview ────────────────────────────────────────────────────────
function PromotionPreview({ promo }: { promo: Promotion }) {
    const catColors: Record<string, string> = {
        CASINO: 'text-purple-400 bg-purple-500/10',
        SPORTS: 'text-blue-400 bg-blue-500/10',
        LIVE: 'text-red-400 bg-red-500/10',
        VIP: 'text-amber-400 bg-amber-500/10',
        ALL: 'text-slate-400 bg-slate-500/10',
    };
    const catStyle = catColors[promo.category] || catColors['ALL'];
    return (
        <div className="relative rounded-xl overflow-hidden" style={{ background: promo.gradient || '#322E2F', minHeight: 90 }}>
            {promo.bgImage && (
                <img src={promo.bgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
            )}
            <div className="relative p-3 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                    <span className="text-white font-black text-sm leading-tight truncate">{promo.title}</span>
                    {promo.badgeLabel && (
                        <span className="flex-shrink-0 text-[10px] font-black bg-white/20 text-white px-1.5 py-0.5 rounded-full">
                            {promo.badgeLabel}
                        </span>
                    )}
                </div>
                {(promo.bonusPercentage ?? 0) > 0 && (
                    <span className="text-2xl font-black text-white/90">+{promo.bonusPercentage}%</span>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${catStyle}`}>{promo.category}</span>
                    {promo.promoCode && (
                        <span className="text-[10px] font-mono bg-black/20 text-white/80 px-2 py-0.5 rounded">{promo.promoCode}</span>
                    )}
                </div>
                {promo.buttonText && (
                    <div className="mt-2 self-start bg-black/20 text-white/80 text-[10px] font-black px-2 py-1 rounded-lg">{promo.buttonText}</div>
                )}
            </div>
            {promo.charImage && (
                <img src={promo.charImage} alt="char" className="absolute right-0 bottom-0 h-20 object-contain" />
            )}
        </div>
    );
}

// ─── Image Upload Helper ──────────────────────────────────────────────────────
function ImageUploadField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
    const [uploading, setUploading] = useState(false);
    const ref = useRef<HTMLInputElement>(null);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const data = await uploadImageToWebsitePublic(formData);
            if (data.url) onChange(data.url);
        } catch {
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <label className="block text-xs text-slate-400 font-bold mb-1">{label}</label>
            <div className="flex gap-2">
                <input type="text" value={value} onChange={e => onChange(e.target.value)}
                    placeholder="Paste URL or upload ↑"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                <button type="button" onClick={() => ref.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-white font-bold transition-colors">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading ? 'Uploading' : 'Upload'}
                </button>
                <input ref={ref} type="file" accept="image/*" onChange={handleFile} className="sr-only" />
            </div>
            {value && <img src={value} alt="preview" className="mt-1.5 h-14 rounded-lg object-cover border border-slate-700" />}
        </div>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function PromotionsAdminPage() {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCat, setFilterCat] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>({});

    const fetchData = async () => {
        setLoading(true);
        const res = await getPromotions();
        if (res.success) setPromotions(res.data as Promotion[]);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        setAccordionOpen({});
        setShowModal(true);
    };

    const openEdit = (p: Promotion) => {
        setEditingId(p._id);
        setForm({
            title: p.title || '', subtitle: p.subtitle || '',
            description: p.description || '', termsAndConditions: p.termsAndConditions || '',
            category: p.category || 'ALL', promoCode: p.promoCode || '',
            minDeposit: p.minDeposit || 0, bonusPercentage: p.bonusPercentage || 0,
            maxBonus: p.maxBonus || 0, wageringMultiplier: p.wageringMultiplier || 0,
            validityDays: p.validityDays || 30, currency: p.currency || 'BOTH',
            targetAudience: p.targetAudience || 'ALL', claimLimit: p.claimLimit || 0,
            claimCount: p.claimCount || 0,
            startDate: p.startDate ? p.startDate.split('T')[0] : '',
            expiryDate: p.expiryDate ? p.expiryDate.split('T')[0] : '',
            buttonText: p.buttonText || 'CLAIM NOW', buttonLink: p.buttonLink || '/register',
            bgImage: p.bgImage || '', charImage: p.charImage || '',
            gradient: p.gradient || GRADIENT_PRESETS[0].value,
            badgeLabel: p.badgeLabel || '',
            isActive: p.isActive, isFeatured: p.isFeatured, showInApp: p.showInApp ?? false, order: p.order || 0,
        });
        setAccordionOpen({});
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const payload = {
            ...form,
            startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
            expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : null,
        };
        const res = editingId
            ? await updatePromotion(editingId, payload)
            : await createPromotion(payload);
        if (res.success) {
            setShowModal(false);
            fetchData();
        } else {
            alert(res.error || 'Save failed');
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this promotion?')) return;
        setDeleting(id);
        await deletePromotion(id);
        fetchData();
        setDeleting(null);
    };

    const handleToggle = async (p: Promotion, field: 'isActive' | 'isFeatured') => {
        await updatePromotion(p._id, { [field]: !p[field] });
        fetchData();
    };

    const filtered = filterCat ? promotions.filter(p => p.category === filterCat) : promotions;
    const toggle = (key: string) => setAccordionOpen(prev => ({ ...prev, [key]: !prev[key] }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <Tag size={26} className="text-indigo-400" /> Promotions Page
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Manage the rich promotion cards shown on <span className="text-indigo-400 font-bold">/promotions</span>
                        <span className="ml-2 text-xs text-slate-600">(separate from homepage Promo Cards)</span>
                    </p>
                </div>
                <button onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-colors">
                    <Plus size={18} /> Add Promotion
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total', value: promotions.length, icon: LayoutGrid, color: 'text-white' },
                    { label: 'Active', value: promotions.filter(p => p.isActive).length, icon: Eye, color: 'text-emerald-400' },
                    { label: 'Featured', value: promotions.filter(p => p.isFeatured).length, icon: Star, color: 'text-amber-400' },
                    { label: 'Inactive', value: promotions.filter(p => !p.isActive).length, icon: EyeOff, color: 'text-slate-500' },
                ].map(s => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                            <Icon size={20} className={`mx-auto mb-1 ${s.color}`} />
                            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                            <div className="text-slate-500 text-xs">{s.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(c => (
                    <button key={c.id} onClick={() => setFilterCat(c.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${filterCat === c.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                        {c.label}
                        <span className="ml-1.5 text-xs opacity-60">
                            ({c.id ? promotions.filter(p => p.category === c.id).length : promotions.length})
                        </span>
                    </button>
                ))}
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-slate-500" /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                    <Tag size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="font-bold">No promotions yet</p>
                    <p className="text-sm mt-1">Click "Add Promotion" to create the first card</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(promo => (
                        <div key={promo._id} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden hover:border-slate-600 transition-colors">
                            {/* Preview */}
                            <PromotionPreview promo={promo} />

                            {/* Info row */}
                            <div className="p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {promo.isFeatured && (
                                            <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <Star size={9} /> Featured
                                            </span>
                                        )}
                                        {promo.showInApp && (
                                            <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">📱 App</span>
                                        )}
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${promo.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                                            {promo.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                        {promo.expiryDate && (
                                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                <Clock size={9} /> {new Date(promo.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-600">#{promo.order}</span>
                                </div>

                                {promo.subtitle && <p className="text-slate-400 text-xs truncate">{promo.subtitle}</p>}

                                {/* Actions */}
                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => handleToggle(promo, 'isActive')}
                                        title={promo.isActive ? 'Deactivate' : 'Activate'}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${promo.isActive ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400'}`}>
                                        {promo.isActive ? <EyeOff size={13} className="mx-auto" /> : <Eye size={13} className="mx-auto" />}
                                    </button>
                                    <button onClick={() => handleToggle(promo, 'isFeatured')}
                                        title={promo.isFeatured ? 'Unfeature' : 'Feature'}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${promo.isFeatured ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-400'}`}>
                                        <Star size={13} className="mx-auto" />
                                    </button>
                                    <button onClick={() => openEdit(promo)}
                                        className="flex-1 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg text-xs font-bold transition-colors">
                                        <Edit2 size={13} className="mx-auto" />
                                    </button>
                                    <button onClick={() => handleDelete(promo._id)} disabled={deleting === promo._id}
                                        className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                                        {deleting === promo._id ? <Loader2 size={13} className="animate-spin mx-auto" /> : <Trash2 size={13} className="mx-auto" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Create / Edit Modal ───────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
                    <form onSubmit={handleSave} className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* Modal header */}
                        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white">
                                {editingId ? 'Edit Promotion' : 'Add New Promotion'}
                            </h2>
                            <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 space-y-5">
                            {/* ─── Basic Info ─── */}
                            <section>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Basic Info</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Title *</label>
                                        <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Subtitle</label>
                                        <input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Category</label>
                                        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none">
                                            {['ALL', 'CASINO', 'SPORTS', 'LIVE', 'VIP'].map(c => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Description</label>
                                        <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none resize-none" />
                                    </div>
                                </div>
                            </section>

                            {/* ─── Bonus Details ─── */}
                            <section>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Bonus Details</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Bonus %</label>
                                        <input type="number" min={0} max={10000} value={form.bonusPercentage}
                                            onChange={e => setForm({ ...form, bonusPercentage: +e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Max Bonus Amount</label>
                                        <input type="number" min={0} value={form.maxBonus}
                                            onChange={e => setForm({ ...form, maxBonus: +e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                            placeholder="0 = unlimited" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Min Deposit</label>
                                        <input type="number" min={0} value={form.minDeposit}
                                            onChange={e => setForm({ ...form, minDeposit: +e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Promo Code</label>
                                        <input value={form.promoCode} onChange={e => setForm({ ...form, promoCode: e.target.value.toUpperCase() })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                </div>
                            </section>

                            {/* ─── Wagering & Rules ─── */}
                            <section>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Wagering & Rules</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Wagering Req. (x)</label>
                                        <input type="number" min={0} step={0.5} value={form.wageringMultiplier}
                                            onChange={e => setForm({ ...form, wageringMultiplier: +e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                            placeholder="e.g. 5" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Validity (days)</label>
                                        <input type="number" min={1} value={form.validityDays}
                                            onChange={e => setForm({ ...form, validityDays: +e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Claim Limit</label>
                                        <input type="number" min={0} value={form.claimLimit}
                                            onChange={e => setForm({ ...form, claimLimit: +e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                            placeholder="0 = unlimited" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Claims Used</label>
                                        <input type="number" min={0} value={form.claimCount} disabled
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-500 outline-none cursor-not-allowed" />
                                    </div>
                                </div>
                            </section>

                            {/* ─── Targeting & Schedule ─── */}
                            <section>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Targeting & Schedule</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Currency</label>
                                        <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none">
                                            <option value="BOTH">Fiat & Crypto</option>
                                            <option value="INR">INR Only</option>
                                            <option value="CRYPTO">Crypto Only</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Target Audience</label>
                                        <select value={form.targetAudience} onChange={e => setForm({ ...form, targetAudience: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none">
                                            <option value="ALL">All Users</option>
                                            <option value="NEW_USERS">New Users Only</option>
                                            <option value="VIP">VIP Members Only</option>
                                            <option value="RETURNING">Returning Users</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Start Date</label>
                                        <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Expiry Date</label>
                                        <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                </div>
                            </section>

                            {/* ─── Button / CTA ─── */}
                            <section>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Button / CTA</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Button Text</label>
                                        <input value={form.buttonText} onChange={e => setForm({ ...form, buttonText: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Button Link</label>
                                        <input value={form.buttonLink} onChange={e => setForm({ ...form, buttonLink: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Badge Label</label>
                                        <div className="flex gap-1.5 flex-wrap mb-1.5">
                                            {BADGE_PRESETS.map(b => (
                                                <button key={b} type="button" onClick={() => setForm({ ...form, badgeLabel: b })}
                                                    className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${form.badgeLabel === b ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                                                    {b}
                                                </button>
                                            ))}
                                        </div>
                                        <input value={form.badgeLabel} onChange={e => setForm({ ...form, badgeLabel: e.target.value.toUpperCase() })}
                                            placeholder="Custom badge (e.g. HOT)"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-1">Order</label>
                                        <input type="number" min={0} value={form.order}
                                            onChange={e => setForm({ ...form, order: +e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                </div>
                            </section>

                            {/* ─── Visuals ─── */}
                            <section>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Visuals</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 font-bold mb-2">Gradient</label>
                                        <div className="flex gap-2 flex-wrap mb-2">
                                            {GRADIENT_PRESETS.map(g => (
                                                <button key={g.label} type="button" onClick={() => setForm({ ...form, gradient: g.value })}
                                                    className={`w-8 h-8 rounded-lg border-2 transition-all ${form.gradient === g.value ? 'border-white scale-110' : 'border-transparent'}`}
                                                    style={{ background: g.value }} title={g.label} />
                                            ))}
                                        </div>
                                        <input value={form.gradient} onChange={e => setForm({ ...form, gradient: e.target.value })}
                                            placeholder="Custom CSS gradient"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <ImageUploadField label="Background Image" value={form.bgImage || ''} onChange={url => setForm({ ...form, bgImage: url })} />
                                    <ImageUploadField label="Character Image" value={form.charImage || ''} onChange={url => setForm({ ...form, charImage: url })} />
                                </div>
                            </section>

                            {/* ─── Terms & Conditions ─── */}
                            <section>
                                <button type="button" onClick={() => toggle('terms')}
                                    className="flex items-center justify-between w-full text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Terms & Conditions <ChevronDown size={14} className={`transition-transform ${accordionOpen.terms ? 'rotate-180' : ''}`} />
                                </button>
                                {accordionOpen.terms && (
                                    <textarea rows={4} value={form.termsAndConditions}
                                        onChange={e => setForm({ ...form, termsAndConditions: e.target.value })}
                                        placeholder="1. This offer is valid for new users only..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none resize-none" />
                                )}
                            </section>

                            {/* ─── Toggles ─── */}
                            <section className="flex flex-wrap gap-6">
                                {([
                                    { key: 'isActive', label: 'Active', desc: 'Visible on /promotions', color: 'bg-indigo-600' },
                                    { key: 'isFeatured', label: 'Featured', desc: 'Shown in featured section', color: 'bg-amber-500' },
                                    { key: 'showInApp', label: 'Show on App Home', desc: 'Appears in mobile app home screen', color: 'bg-blue-600' },
                                ] as const).map(t => (
                                    <label key={t.key} className="flex items-center gap-3 cursor-pointer">
                                        <div className={`w-11 h-6 rounded-full relative transition-colors ${form[t.key] ? t.color : 'bg-slate-600'}`}>
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form[t.key] ? 'left-6' : 'left-1'}`} />
                                            <input type="checkbox" checked={form[t.key]} onChange={e => setForm({ ...form, [t.key]: e.target.checked })} className="sr-only" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{t.label}</p>
                                            <p className="text-xs text-slate-500">{t.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </section>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-slate-700 flex gap-3">
                            <button type="button" onClick={() => setShowModal(false)}
                                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-bold text-sm transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl font-black text-sm transition-all">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
                                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Promotion'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
