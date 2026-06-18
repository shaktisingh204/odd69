"use client";

import React, { useEffect, useState, useRef } from 'react';
import {
    getCasinoCategories, createCasinoCategory,
    updateCasinoCategory, deleteCasinoCategory
} from '@/actions/casino';
import {
    Plus, Trash2, Eye, EyeOff, Loader2, Check, X,
    Pencil, Monitor, Gamepad2,
    // Icon registry
    Flame, Dice5, PlayCircle, Coffee, Zap, TrendingUp, Fish,
    Sparkles, Star, Trophy, Tv, Crown, Layers, Rocket, Diamond,
    Gift, Heart, Circle, Shuffle, Music, Target, Award, BarChart2,
    Ghost, Joystick, Ticket, Gem, Banknote, Swords,
} from 'lucide-react';

// ─── Icon registry ─────────────────────────────────────────────────────────────
const ICON_REGISTRY: { name: string; Comp: React.ElementType }[] = [
    { name: 'Flame',      Comp: Flame      }, { name: 'Dice5',     Comp: Dice5      },
    { name: 'PlayCircle', Comp: PlayCircle  }, { name: 'Coffee',    Comp: Coffee     },
    { name: 'Zap',        Comp: Zap        }, { name: 'TrendingUp',Comp: TrendingUp  },
    { name: 'Fish',       Comp: Fish       }, { name: 'Sparkles',  Comp: Sparkles   },
    { name: 'Star',       Comp: Star       }, { name: 'Trophy',    Comp: Trophy     },
    { name: 'Tv',         Comp: Tv         }, { name: 'Crown',     Comp: Crown      },
    { name: 'Layers',     Comp: Layers     }, { name: 'Rocket',    Comp: Rocket     },
    { name: 'Diamond',    Comp: Diamond    }, { name: 'Gift',      Comp: Gift       },
    { name: 'Heart',      Comp: Heart      }, { name: 'Circle',    Comp: Circle     },
    { name: 'Shuffle',    Comp: Shuffle    }, { name: 'Music',     Comp: Music      },
    { name: 'Target',     Comp: Target     }, { name: 'Award',     Comp: Award      },
    { name: 'BarChart2',  Comp: BarChart2  }, { name: 'Ghost',     Comp: Ghost      },
    { name: 'Joystick',   Comp: Joystick   }, { name: 'Ticket',    Comp: Ticket     },
    { name: 'Gem',        Comp: Gem        }, { name: 'Banknote',  Comp: Banknote   },
    { name: 'Swords',     Comp: Swords     }, { name: 'Gamepad2',  Comp: Gamepad2   },
];
const ICON_MAP = Object.fromEntries(ICON_REGISTRY.map(r => [r.name, r.Comp]));

function resolveIcon(name: string, size = 14): React.ReactNode {
    const Comp = ICON_MAP[name] ?? Gamepad2;
    return <Comp size={size} />;
}

// ─── Icon picker popover ───────────────────────────────────────────────────────
function IconPicker({ value, onChange }: { value: string; onChange: (n: string) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, []);
    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(v => !v)} title="Pick icon"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-white/25 transition-all">
                {resolveIcon(value, 14)}
            </button>
            {open && (
                <div className="absolute left-0 top-10 z-50 grid grid-cols-5 gap-1 p-2 rounded-2xl border border-white/10 bg-[#1a1d24] shadow-2xl w-[200px]">
                    {ICON_REGISTRY.map(({ name, Comp }) => (
                        <button key={name} type="button" title={name}
                            onClick={() => { onChange(name); setOpen(false); }}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${value === name ? 'bg-brand-gold/20 text-brand-gold border border-brand-gold/40' : 'text-white/40 hover:bg-white/10 hover:text-white'}`}>
                            <Comp size={14} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Category {
    _id: string;
    name: string;
    slug: string;
    icon: string;
    pageType: 'casino' | 'live';
    priority: number;
    isActive: boolean;
}

interface EditState {
    id: string;
    name: string;
    icon: string;
    pageType: 'casino' | 'live';
}

export default function CategoriesPage() {
    const [all, setAll]           = useState<Category[]>([]);
    const [activeTab, setActiveTab] = useState<'casino' | 'live'>('casino');
    const [loading, setLoading]   = useState(true);

    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName]   = useState('');
    const [newIcon, setNewIcon]   = useState('Gamepad2');
    const [newType, setNewType]   = useState<'casino' | 'live'>('casino');
    const [creating, setCreating] = useState(false);
    const [createErr, setCreateErr] = useState('');

    // Inline edit
    const [editing, setEditing]   = useState<EditState | null>(null);
    const [saving, setSaving]     = useState(false);
    const [saveOk, setSaveOk]     = useState(false);

    const load = async () => {
        setLoading(true);
        const res = await getCasinoCategories();
        if (res.success && res.data) setAll(res.data as Category[]);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const cats = all.filter(c => c.pageType === activeTab)
        .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

    const handleCreate = async () => {
        if (!newName.trim()) { setCreateErr('Name is required.'); return; }
        setCreating(true); setCreateErr('');
        const res = await createCasinoCategory({ name: newName.trim(), icon: newIcon, pageType: newType });
        setCreating(false);
        if (res.success) {
            await load(); setNewName(''); setNewIcon('Gamepad2'); setShowCreate(false); setActiveTab(newType);
        } else { setCreateErr(res.error || 'Failed'); }
    };

    const handleSaveEdit = async () => {
        if (!editing) return;
        setSaving(true);
        await updateCasinoCategory(editing.id, { name: editing.name, icon: editing.icon, pageType: editing.pageType });
        setSaving(false); setSaveOk(true);
        await load();
        setTimeout(() => { setSaveOk(false); setEditing(null); }, 800);
    };

    const handleToggle = async (cat: Category) => {
        setAll(prev => prev.map(c => c._id === cat._id ? { ...c, isActive: !c.isActive } : c));
        await updateCasinoCategory(cat._id, { isActive: !cat.isActive });
    };

    const handleDelete = async (cat: Category) => {
        if (!confirm(`Delete category "${cat.name}"?`)) return;
        await deleteCasinoCategory(cat._id);
        setAll(prev => prev.filter(c => c._id !== cat._id));
    };

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-brand-gold" />
        </div>
    );

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-black text-white">Casino Categories</h1>
                    <p className="text-sm text-white/40 mt-0.5">Manage game categories for Casino and Live Casino. These drive the sidebar filter and game browser.</p>
                </div>
                <button onClick={() => { setShowCreate(true); setNewType(activeTab); setCreateErr(''); setNewIcon('Gamepad2'); }}
                    className="flex items-center gap-1.5 bg-brand-gold text-bg-base px-4 py-2 rounded-xl font-black text-sm hover:bg-brand-gold/90 transition-colors">
                    <Plus size={14} /> New Category
                </button>
            </div>

            {/* Create dialog */}
            {showCreate && (
                <div className="rounded-2xl border border-white/10 bg-bg-elevated p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="font-black text-white text-sm">New Category</span>
                        <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg text-white/40 hover:text-white"><X size={14} /></button>
                    </div>

                    {/* Type selector */}
                    <div className="flex gap-2">
                        {(['casino', 'live'] as const).map(t => (
                            <button key={t} onClick={() => setNewType(t)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-black transition-all ${newType === t ? 'bg-brand-gold/15 border-brand-gold/40 text-brand-gold' : 'bg-bg-base border-white/10 text-white/40'}`}>
                                {t === 'casino' ? <Gamepad2 size={12} /> : <Monitor size={12} />}
                                {t === 'casino' ? 'Casino' : 'Live Casino'}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1 block">Name *</label>
                            <input value={newName} onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                placeholder="e.g. Jackpot Games"
                                className="w-full bg-bg-base text-white text-sm font-semibold rounded-xl border border-white/10 px-3 py-2 outline-none focus:border-brand-gold/50 transition-colors placeholder:text-white/20" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1 block">Icon</label>
                            <IconPicker value={newIcon} onChange={setNewIcon} />
                        </div>
                    </div>

                    {createErr && <p className="text-xs text-red-400">{createErr}</p>}

                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowCreate(false)} className="px-3 py-2 rounded-xl text-xs font-black text-white/40 hover:text-white">Cancel</button>
                        <button onClick={handleCreate} disabled={creating || !newName.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-gold text-bg-base text-xs font-black hover:bg-brand-gold/90 disabled:opacity-50">
                            {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                            Create
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 rounded-2xl bg-bg-elevated p-1 w-fit">
                {([['casino', 'Casino', Gamepad2], ['live', 'Live Casino', Monitor]] as const).map(([tab, label, Icon]) => (
                    <button key={tab} onClick={() => { setActiveTab(tab as 'casino' | 'live'); setEditing(null); }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === tab ? 'bg-brand-gold text-bg-base' : 'text-white/40 hover:text-white'}`}>
                        <Icon size={12} /> {label}
                        <span className="opacity-60">({all.filter(c => c.pageType === tab).length})</span>
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="space-y-2">
                {cats.length === 0 && (
                    <div className="text-center py-12 text-white/25 text-sm">
                        No {activeTab === 'casino' ? 'casino' : 'live casino'} categories yet. Click "New Category" to add one.
                    </div>
                )}
                {cats.map(cat => {
                    const isEditing = editing?.id === cat._id;
                    return (
                        <div key={cat._id}
                            className={`rounded-2xl border px-4 py-3 transition-all ${cat.isActive ? 'bg-bg-elevated border-white/[0.06]' : 'bg-bg-base border-white/[0.03] opacity-55'}`}>
                            {isEditing ? (
                                /* ── Edit row ── */
                                <div className="flex items-center gap-3">
                                    <IconPicker value={editing.icon} onChange={ic => setEditing(e => e ? { ...e, icon: ic } : e)} />
                                    <input value={editing.name} onChange={e => setEditing(prev => prev ? { ...prev, name: e.target.value } : prev)}
                                        className="flex-1 bg-bg-base text-white text-sm font-semibold rounded-xl border border-white/10 px-3 py-2 outline-none focus:border-brand-gold/50 transition-colors" />
                                    {/* Type toggle inside edit */}
                                    <div className="flex gap-1">
                                        {(['casino', 'live'] as const).map(t => (
                                            <button key={t} onClick={() => setEditing(e => e ? { ...e, pageType: t } : e)}
                                                className={`px-2 py-1.5 rounded-lg text-[10px] font-black transition-all ${editing.pageType === t ? 'bg-brand-gold/20 text-brand-gold' : 'text-white/30 hover:text-white'}`}>
                                                {t === 'casino' ? '🎰' : '📡'}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={handleSaveEdit} disabled={saving}
                                        className="p-1.5 rounded-lg bg-brand-gold/15 text-brand-gold hover:bg-brand-gold/25 transition-colors">
                                        {saving ? <Loader2 size={13} className="animate-spin" /> : saveOk ? <Check size={13} /> : <Check size={13} />}
                                    </button>
                                    <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5">
                                        <X size={13} />
                                    </button>
                                </div>
                            ) : (
                                /* ── View row ── */
                                <div className="flex items-center gap-3">
                                    {/* Icon */}
                                    <div className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/5 text-white/50">
                                        {resolveIcon(cat.icon || 'Gamepad2', 15)}
                                    </div>

                                    {/* Name + slug */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-black leading-tight truncate">{cat.name}</p>
                                        <p className="text-white/30 text-[10px] font-mono">{cat.slug}</p>
                                    </div>

                                    {/* Type badge */}
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${cat.pageType === 'live' ? 'bg-rose-500/10 text-rose-400' : 'bg-sky-500/10 text-sky-400'}`}>
                                        {cat.pageType}
                                    </span>

                                    {/* Priority bubble */}
                                    <span className="text-[10px] text-white/25 font-mono w-6 text-center" title="Priority">{cat.priority}</span>

                                    {/* Edit */}
                                    <button onClick={() => setEditing({ id: cat._id, name: cat.name, icon: cat.icon || 'Gamepad2', pageType: cat.pageType })}
                                        className="p-1.5 rounded-lg text-white/25 hover:text-white hover:bg-white/5 transition-colors" title="Edit">
                                        <Pencil size={12} />
                                    </button>

                                    {/* Visibility */}
                                    <button onClick={() => handleToggle(cat)}
                                        className={`p-1.5 rounded-lg transition-colors ${cat.isActive ? 'text-brand-gold hover:bg-brand-gold/10' : 'text-white/20 hover:text-white/50'}`}
                                        title={cat.isActive ? 'Hide' : 'Show'}>
                                        {cat.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>

                                    {/* Delete */}
                                    <button onClick={() => handleDelete(cat)}
                                        className="p-1.5 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <p className="text-[11px] text-white/15 text-center pt-2">
                Categories are used to filter games on the casino and live casino game browser.<br />
                Slug is auto-generated from name and used as the API filter key.
            </p>
        </div>
    );
}
