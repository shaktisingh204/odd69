"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    getSectionConfigs, updateSectionConfigs,
    createSectionConfig, deleteSectionConfig
} from '@/actions/casino';
import {
    Save, Loader2, Eye, EyeOff, GripVertical, RotateCcw,
    Check, Plus, Trash2, X, Monitor, Gamepad2, ArrowUp, ArrowDown,
    Flame, Dice5, PlayCircle, Coffee, Zap, TrendingUp,
    Fish, Sparkles, Star, Trophy, Tv, Crown, Layers,
    Rocket, Diamond, Gift, Heart, Circle,
    Shuffle, Music, Target, Award, BarChart2, Ghost,
    Joystick, Ticket, Gem, Banknote, Search,
} from 'lucide-react';
import Link from 'next/link';

// ─── Icon registry ────────────────────────────────────────────────────────────
const ICON_REGISTRY: { name: string; component: React.ElementType }[] = [
    { name: 'Flame', component: Flame }, { name: 'Dice5', component: Dice5 },
    { name: 'PlayCircle', component: PlayCircle }, { name: 'Coffee', component: Coffee },
    { name: 'Zap', component: Zap }, { name: 'TrendingUp', component: TrendingUp },
    { name: 'Fish', component: Fish }, { name: 'Sparkles', component: Sparkles },
    { name: 'Star', component: Star }, { name: 'Trophy', component: Trophy },
    { name: 'Tv', component: Tv }, { name: 'Crown', component: Crown },
    { name: 'Layers', component: Layers }, { name: 'Rocket', component: Rocket },
    { name: 'Diamond', component: Diamond }, { name: 'Gift', component: Gift },
    { name: 'Heart', component: Heart }, { name: 'Circle', component: Circle },
    { name: 'Shuffle', component: Shuffle }, { name: 'Music', component: Music },
    { name: 'Target', component: Target }, { name: 'Award', component: Award },
    { name: 'BarChart2', component: BarChart2 }, { name: 'Ghost', component: Ghost },
    { name: 'Joystick', component: Joystick }, { name: 'Ticket', component: Ticket },
    { name: 'Gem', component: Gem }, { name: 'Banknote', component: Banknote },
    { name: 'Monitor', component: Monitor }, { name: 'Gamepad2', component: Gamepad2 },
];
const ICON_MAP = Object.fromEntries(ICON_REGISTRY.map(r => [r.name, r.component]));
function resolveIcon(name: string, size = 16): React.ReactNode {
    const Comp = ICON_MAP[name] ?? Gamepad2;
    return <Comp size={size} />;
}

// ─── Icon Picker ──────────────────────────────────────────────────────────────
function IconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    return (
        <div ref={ref} className="relative flex-shrink-0">
            <button type="button" onClick={() => setOpen(v => !v)} title="Change icon"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-white/60 hover:text-white hover:border-indigo-500/50 transition-all">
                {resolveIcon(value, 15)}
            </button>
            {open && (
                <div className="absolute left-0 top-11 z-50 grid grid-cols-6 gap-1 p-2.5 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl w-[240px]">
                    {ICON_REGISTRY.map(({ name, component: Icon }) => (
                        <button key={name} type="button" title={name} onClick={() => { onChange(name); setOpen(false); }}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${value === name ? 'bg-indigo-600/30 text-indigo-400 ring-1 ring-indigo-500/50' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}>
                            <Icon size={14} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface SectionRow {
    section: string;
    label: string;
    icon: string;
    pageType: 'casino' | 'live';
    isVisible: boolean;
    isCustom: boolean;
    order: number;
}

const DEFAULT_LABELS: Record<string, string> = {
    popular: 'Hot Games', slots: 'Slots', new: 'New Arrivals', trending: 'Trending Now',
    table: 'Table Games', crash: 'Crash Games', fishing: 'Fishing', arcade: 'Arcade',
    virtual: 'Virtual Sports', exclusive: 'Exclusive', top: 'Top Picks',
    live: 'Popular Live', roulette: 'Live Roulette', blackjack: 'Live Blackjack',
    baccarat: 'Live Baccarat', shows: 'Game Shows', poker: 'Live Poker',
};
const DEFAULT_ICONS: Record<string, string> = {
    popular: 'Flame', slots: 'Dice5', new: 'Sparkles', trending: 'TrendingUp',
    table: 'Coffee', crash: 'Zap', fishing: 'Fish', arcade: 'Gamepad2',
    virtual: 'Trophy', exclusive: 'Star', top: 'Crown',
    live: 'PlayCircle', roulette: 'Circle', blackjack: 'Layers', baccarat: 'Coffee',
    shows: 'Tv', poker: 'Gamepad2',
};

type Toast = { msg: string; type: 'success' | 'error' };

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CasinoSectionsPage() {
    const [allConfigs, setAllConfigs] = useState<SectionRow[]>([]);
    const [activeTab, setActiveTab] = useState<'casino' | 'live'>('casino');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<Toast | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Create dialog
    const [showCreate, setShowCreate] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newKey, setNewKey] = useState('');
    const [newType, setNewType] = useState<'casino' | 'live'>('casino');
    const [newIcon, setNewIcon] = useState('Gamepad2');
    const [creating, setCreating] = useState(false);

    const flash = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    useEffect(() => {
        getSectionConfigs().then(res => {
            if (res.success && res.data) setAllConfigs(res.data as SectionRow[]);
            setLoading(false);
        });
    }, []);

    const configs = allConfigs
        .filter(c => c.pageType === activeTab)
        .filter(c => !searchQuery || c.label.toLowerCase().includes(searchQuery.toLowerCase()) || c.section.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => a.order - b.order);

    const casinoCount = allConfigs.filter(c => c.pageType === 'casino').length;
    const liveCount = allConfigs.filter(c => c.pageType === 'live').length;
    const visibleCount = configs.filter(c => c.isVisible).length;

    const update = (section: string, patch: Partial<SectionRow>) =>
        setAllConfigs(prev => prev.map(c => c.section === section ? { ...c, ...patch } : c));

    const moveUp = (section: string) => {
        const sorted = [...allConfigs.filter(c => c.pageType === activeTab)].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex(c => c.section === section);
        if (idx <= 0) return;
        const prev = sorted[idx - 1];
        const curr = sorted[idx];
        update(curr.section, { order: prev.order });
        update(prev.section, { order: curr.order });
    };

    const moveDown = (section: string) => {
        const sorted = [...allConfigs.filter(c => c.pageType === activeTab)].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex(c => c.section === section);
        if (idx < 0 || idx >= sorted.length - 1) return;
        const next = sorted[idx + 1];
        const curr = sorted[idx];
        update(curr.section, { order: next.order });
        update(next.section, { order: curr.order });
    };

    const handleSave = async () => {
        setSaving(true);
        const res = await updateSectionConfigs(allConfigs);
        setSaving(false);
        if (res.success) flash('All changes saved');
        else flash(res.error || 'Save failed', 'error');
    };

    const handleCreate = async () => {
        if (!newLabel.trim()) return;
        setCreating(true);
        const res = await createSectionConfig(newKey || newLabel, newLabel.trim(), newType, newIcon);
        setCreating(false);
        if (res.success) {
            const fresh = await getSectionConfigs();
            if (fresh.success && fresh.data) setAllConfigs(fresh.data as SectionRow[]);
            setNewLabel(''); setNewKey(''); setNewIcon('Gamepad2'); setShowCreate(false);
            setActiveTab(newType);
            flash(`"${newLabel}" created`);
        } else {
            flash(res.error || 'Failed', 'error');
        }
    };

    const handleDelete = async (section: string, label: string) => {
        if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
        const res = await deleteSectionConfig(section);
        if (res.success) {
            setAllConfigs(prev => prev.filter(c => c.section !== section));
            flash(`"${label}" deleted`);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-32">
            <Loader2 size={28} className="animate-spin text-indigo-400" />
        </div>
    );

    return (
        <div className="space-y-6 pb-8">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl border text-sm font-medium animate-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-200' : 'bg-red-900/90 border-red-500/40 text-red-200'}`}>
                    {toast.type === 'success' ? <Check size={14} /> : <X size={14} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <Link href="/dashboard/casino" className="text-xs text-slate-500 hover:text-slate-300 mb-1 block">← Back to Casino</Link>
                    <h1 className="text-2xl font-bold text-white">Lobby Sections</h1>
                    <p className="text-slate-400 mt-1 text-sm">
                        Configure game sections for <span className="text-indigo-400 font-semibold">Casino</span> and <span className="text-rose-400 font-semibold">Live Casino</span> pages.
                        Drag to reorder, toggle visibility, or create custom groups.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { setShowCreate(true); setNewType(activeTab); setNewIcon('Gamepad2'); setNewLabel(''); setNewKey(''); }}
                        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors">
                        <Plus size={13} /> New Section
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Create dialog */}
            {showCreate && (
                <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">Create New Section</span>
                        <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg text-slate-500 hover:text-white"><X size={14} /></button>
                    </div>

                    {/* Page type */}
                    <div className="flex gap-2">
                        {(['casino', 'live'] as const).map(t => (
                            <button key={t} onClick={() => setNewType(t)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${newType === t
                                    ? t === 'casino' ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400' : 'bg-rose-600/20 border-rose-500/50 text-rose-400'
                                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                                {t === 'casino' ? <Gamepad2 size={12} /> : <Monitor size={12} />}
                                {t === 'casino' ? 'Casino Page' : 'Live Casino Page'}
                            </button>
                        ))}
                    </div>

                    {/* Fields */}
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Display Name *</label>
                            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Jackpot Games"
                                className="w-full bg-slate-900 text-white text-sm rounded-xl border border-slate-700 px-3 py-2.5 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Section Key</label>
                            <input value={newKey} onChange={e => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                placeholder={newLabel ? newLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : 'my_section'}
                                className="w-full bg-slate-900 text-slate-400 text-sm font-mono rounded-xl border border-slate-700 px-3 py-2.5 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-700" />
                        </div>
                        <IconPicker value={newIcon} onChange={setNewIcon} />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-white">Cancel</button>
                        <button onClick={handleCreate} disabled={creating || !newLabel.trim()}
                            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 disabled:opacity-50">
                            {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                            Create Section
                        </button>
                    </div>
                </div>
            )}

            {/* Tab bar + search */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="flex gap-1 rounded-xl bg-slate-800 p-1 border border-slate-700">
                    {([
                        { tab: 'casino' as const, label: 'Casino', Icon: Gamepad2, count: casinoCount, color: 'indigo' },
                        { tab: 'live' as const, label: 'Live Casino', Icon: Monitor, count: liveCount, color: 'rose' },
                    ]).map(({ tab, label, Icon, count, color }) => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                activeTab === tab
                                    ? `bg-${color}-600/20 text-${color}-400 border border-${color}-500/30`
                                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                            }`}
                            style={activeTab === tab ? { backgroundColor: color === 'indigo' ? 'rgba(79,70,229,0.15)' : 'rgba(225,29,72,0.15)', color: color === 'indigo' ? '#818cf8' : '#fb7185' } : {}}>
                            <Icon size={13} /> {label}
                            <span className="text-[10px] opacity-60">({count})</span>
                        </button>
                    ))}
                </div>
                <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Filter sections..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-indigo-500 placeholder:text-slate-600" />
                </div>
            </div>

            {/* Stats */}
            <div className="flex gap-3">
                <div className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs">
                    <span className="text-slate-500">Total: </span>
                    <span className="text-white font-bold">{configs.length}</span>
                </div>
                <div className="px-4 py-2 bg-emerald-900/30 border border-emerald-500/20 rounded-xl text-xs">
                    <span className="text-emerald-500/80">Visible: </span>
                    <span className="text-emerald-400 font-bold">{visibleCount}</span>
                </div>
                <div className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs">
                    <span className="text-slate-500">Hidden: </span>
                    <span className="text-slate-400 font-bold">{configs.length - visibleCount}</span>
                </div>
            </div>

            {/* Section list */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800 overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[40px_44px_100px_1fr_80px_80px_60px] gap-3 px-4 py-3 bg-slate-900/50 text-[10px] font-bold uppercase tracking-widest text-slate-600 border-b border-slate-700">
                    <span>Order</span>
                    <span>Icon</span>
                    <span>Key</span>
                    <span>Display Name</span>
                    <span className="text-center">Page</span>
                    <span className="text-center">Visible</span>
                    <span className="text-right">Actions</span>
                </div>

                {configs.length === 0 ? (
                    <div className="text-center py-16 text-slate-600 text-sm">
                        <Gamepad2 size={32} className="mx-auto mb-3 opacity-30" />
                        <p>{searchQuery ? 'No sections match your search' : 'No sections yet. Click "New Section" to create one.'}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-700/40">
                        {configs.map((cfg, i) => (
                            <div key={cfg.section}
                                className={`grid grid-cols-[40px_44px_100px_1fr_80px_80px_60px] gap-3 items-center px-4 py-3 transition-all hover:bg-slate-700/20 ${!cfg.isVisible ? 'opacity-40' : ''}`}>

                                {/* Order arrows */}
                                <div className="flex flex-col gap-0.5">
                                    <button onClick={() => moveUp(cfg.section)} disabled={i === 0}
                                        className="p-0.5 rounded text-slate-600 hover:text-white disabled:opacity-20 transition-colors">
                                        <ArrowUp size={11} />
                                    </button>
                                    <button onClick={() => moveDown(cfg.section)} disabled={i === configs.length - 1}
                                        className="p-0.5 rounded text-slate-600 hover:text-white disabled:opacity-20 transition-colors">
                                        <ArrowDown size={11} />
                                    </button>
                                </div>

                                {/* Icon */}
                                <IconPicker
                                    value={cfg.icon || DEFAULT_ICONS[cfg.section] || 'Gamepad2'}
                                    onChange={name => update(cfg.section, { icon: name })}
                                />

                                {/* Key */}
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-mono text-slate-500 truncate">{cfg.section}</span>
                                    {cfg.isCustom && (
                                        <span className="shrink-0 text-[8px] font-bold text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded">CUSTOM</span>
                                    )}
                                </div>

                                {/* Label input */}
                                <input type="text" value={cfg.label}
                                    onChange={e => update(cfg.section, { label: e.target.value })}
                                    className="bg-transparent text-white text-sm font-semibold outline-none border-b border-transparent focus:border-indigo-500/60 py-1 placeholder:text-slate-600 transition-colors"
                                    placeholder={DEFAULT_LABELS[cfg.section] || cfg.section}
                                />

                                {/* Page type badge */}
                                <div className="flex justify-center">
                                    <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-lg ${
                                        cfg.pageType === 'casino'
                                            ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                                            : 'bg-rose-600/15 text-rose-400 border border-rose-500/20'
                                    }`}>
                                        {cfg.pageType === 'casino' ? 'Casino' : 'Live'}
                                    </span>
                                </div>

                                {/* Visibility toggle */}
                                <div className="flex justify-center">
                                    <button onClick={() => update(cfg.section, { isVisible: !cfg.isVisible })}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                            cfg.isVisible
                                                ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-slate-700 text-slate-600 border border-slate-600'
                                        }`}>
                                        {cfg.isVisible ? <Eye size={10} /> : <EyeOff size={10} />}
                                        {cfg.isVisible ? 'On' : 'Off'}
                                    </button>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-end gap-1">
                                    {!cfg.isCustom && (
                                        <button onClick={() => update(cfg.section, { label: DEFAULT_LABELS[cfg.section] || cfg.section, icon: DEFAULT_ICONS[cfg.section] || 'Gamepad2' })}
                                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-colors" title="Reset defaults">
                                            <RotateCcw size={11} />
                                        </button>
                                    )}
                                    {cfg.isCustom && (
                                        <button onClick={() => handleDelete(cfg.section, cfg.label)}
                                            className="p-1.5 rounded-lg text-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                                            <Trash2 size={11} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer hint */}
            <p className="text-[11px] text-slate-600 text-center">
                Visible sections appear as lobby rows on the {activeTab === 'casino' ? 'Casino' : 'Live Casino'} page. First 6 visible also show as navigation pills on mobile.
            </p>
        </div>
    );
}
