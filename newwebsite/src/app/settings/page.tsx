'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Settings, User, Lock, Shield, Wallet, ChevronRight,
    CheckCircle, XCircle, Loader2, Eye, EyeOff, Edit2,
    Mail, Phone, Calendar, AlertCircle, ExternalLink,
    GripVertical, ToggleLeft, ToggleRight, Gamepad2, Save, RotateCcw,
    Trophy, ImageIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/context/WalletContext';
import api from '@/services/api';
import toast from 'react-hot-toast';
import {
    getSidebarCategories,
    saveSidebarCategories,
    type SidebarCategory,
} from '@/lib/actions/sidebarCategories';
import {
    getLeagueImages,
    updateLeagueImage,
    type LeagueImageEntry,
} from '@/lib/actions/leagueImages';
import BindMobileModal from '@/components/BindMobileModal/BindMobileModal';
import BindEmailModal from '@/components/BindEmailModal/BindEmailModal';
import { COUNTRIES } from '@/components/shared/CountryCodeSelector';
import CountrySelector from '@/components/shared/CountrySelector';

// ─── Admin Sidebar Category Manager ──────────────────────────────────────────
function AdminSidebarCategories() {
    const [cats, setCats] = useState<SidebarCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const dragItem = useRef<number | null>(null);
    const dragOver = useRef<number | null>(null);
    const { token } = useAuth();

    const loadCats = async () => {
        setLoading(true);
        try {
            const { all } = await getSidebarCategories();
            setCats(all.sort((a, b) => a.order - b.order));
        } catch {
            toast.error('Failed to load categories');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadCats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleVisible = (id: string) => {
        setCats(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
        setDirty(true);
    };

    const onDragStart = (i: number) => { dragItem.current = i; };
    const onDragEnter = (i: number) => { dragOver.current = i; };
    const onDragEnd = () => {
        if (dragItem.current === null || dragOver.current === null) return;
        const updated = [...cats];
        const [moved] = updated.splice(dragItem.current, 1);
        updated.splice(dragOver.current, 0, moved);
        setCats(updated.map((c, i) => ({ ...c, order: i })));
        dragItem.current = null;
        dragOver.current = null;
        setDirty(true);
    };

    const handleSave = async () => {
        if (!token) { toast.error('Not authenticated'); return; }
        setSaving(true);
        try {
            const result = await saveSidebarCategories(token, cats.map((c, i) => ({ ...c, order: i })));
            if (!result.ok) throw new Error(result.error ?? 'Failed');
            toast.success('Sidebar categories saved!');
            setDirty(false);
        } catch (e: any) {
            toast.error(e.message ?? 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const visibleCount = cats.filter(c => c.visible).length;
    const shownCount = Math.min(visibleCount, 8);

    if (loading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Info banner */}
            <div className="rounded-xl border border-brand-gold/20 bg-brand-gold/5 px-4 py-3 flex items-start gap-3">
                <Gamepad2 size={16} className="text-brand-gold mt-0.5 flex-shrink-0" />
                <div className="text-xs text-white/60 leading-relaxed">
                    <span className="text-white font-bold">Only the top 8 visible categories</span> appear in the sidebar.
                    Drag rows to reorder. Toggle to show/hide a category.
                    <span className="text-brand-gold font-bold ml-1">Currently showing {shownCount}/8.</span>
                </div>
            </div>

            {/* Category rows */}
            <div className="space-y-1.5">
                {cats.map((cat, i) => (
                    <div
                        key={cat.id}
                        draggable
                        onDragStart={() => onDragStart(i)}
                        onDragEnter={() => onDragEnter(i)}
                        onDragEnd={onDragEnd}
                        onDragOver={e => e.preventDefault()}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none
                            ${cat.visible && i < 8
                                ? 'border-brand-gold/20 bg-brand-gold/5'
                                : cat.visible
                                    ? 'border-white/[0.06] bg-bg-deep-4 opacity-60'
                                    : 'border-white/[0.04] bg-bg-deep-4 opacity-40'
                            }`}
                    >
                        <GripVertical size={14} className="text-white/20 flex-shrink-0" />
                        <span className="flex-1 text-sm font-medium text-white">{cat.name}</span>
                        <span className="text-[10px] text-white/25 font-mono">#{cat.id}</span>
                        {cat.visible && i < 8 && (
                            <span className="text-[9px] bg-brand-gold/20 text-brand-gold px-1.5 py-0.5 rounded font-bold">SHOWN</span>
                        )}
                        {cat.visible && i >= 8 && (
                            <span className="text-[9px] bg-white/[0.04] text-white/30 px-1.5 py-0.5 rounded font-bold">OVERFLOW</span>
                        )}
                        <button
                            type="button"
                            onClick={() => toggleVisible(cat.id)}
                            className="text-white/30 hover:text-white transition-colors"
                            title={cat.visible ? 'Hide from sidebar' : 'Show in sidebar'}
                        >
                            {cat.visible
                                ? <ToggleRight size={20} className="text-brand-gold" />
                                : <ToggleLeft size={20} />
                            }
                        </button>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
                <button
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-40 disabled:cursor-not-allowed text-text-inverse text-sm font-black rounded-xl transition-colors"
                >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
                {dirty && (
                    <button
                        onClick={() => { setDirty(false); loadCats(); }}
                        className="flex items-center gap-2 px-4 py-2.5 border border-white/[0.06] text-white/50 hover:text-white hover:border-white/[0.12] text-sm font-bold rounded-xl transition-colors"
                    >
                        <RotateCcw size={13} />
                        Reset
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Admin League Images ──────────────────────────────────────────────────────
function AdminLeagueImages() {
    const { token } = useAuth();
    const [leagues, setLeagues] = useState<LeagueImageEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [urls, setUrls] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [saved, setSaved] = useState<Record<string, boolean>>({});
    const [seeding, setSeeding] = useState(false);
    const [search, setSearch] = useState('');
    const BACKEND = (process.env.NEXT_PUBLIC_API_URL ?? 'https://zeero.bet/api').replace(/\/$/, '');

    const load = async () => {
        setLoading(true);
        try {
            const list = await getLeagueImages();
            setLeagues(list);
            const map: Record<string, string> = {};
            list.forEach((l) => { map[l.competitionId] = l.imageUrl ?? ''; });
            setUrls(map);
        } catch {
            toast.error('Failed to load leagues');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSave = async (competitionId: string) => {
        if (!token) { toast.error('Not authenticated'); return; }
        setSaving((p) => ({ ...p, [competitionId]: true }));
        try {
            const result = await updateLeagueImage(token, competitionId, urls[competitionId] ?? '');
            if (!result.ok) throw new Error(result.error ?? 'Failed');
            toast.success('Image updated!');
            setSaved((p) => ({ ...p, [competitionId]: true }));
            setTimeout(() => setSaved((p) => ({ ...p, [competitionId]: false })), 2000);
        } catch (e: any) {
            toast.error(e.message ?? 'Failed to save');
        } finally {
            setSaving((p) => ({ ...p, [competitionId]: false }));
        }
    };

    const handleSeed = async () => {
        if (!token) { toast.error('Not authenticated'); return; }
        setSeeding(true);
        try {
            const adminKey = (typeof localStorage !== 'undefined' && localStorage.getItem('adminToken')) || '';
            const res = await fetch(`${BACKEND}/sports/leagues/seed`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Admin-Token': adminKey,
                },
            });
            const body = await res.json();
            if (body.success) {
                toast.success(`Seeded ${body.seeded ?? 0} leagues from event cache`);
                await load();
            } else {
                toast.error(body.message ?? 'Seed failed');
            }
        } catch {
            toast.error('Seed request failed');
        } finally {
            setSeeding(false);
        }
    };

    const filtered = leagues.filter((l) =>
        !search.trim() ||
        l.competitionName.toLowerCase().includes(search.toLowerCase()) ||
        (l.sportName ?? '').toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Info + Seed */}
            <div className="rounded-xl border border-success-primary/20 bg-success-alpha-10 px-4 py-3 flex items-start gap-3">
                <Trophy size={16} className="text-success-bright mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-xs text-white/60 leading-relaxed">
                    <span className="text-white font-bold">Set banner images for leagues.</span>{' '}
                    Paste any image URL (CDN, Imgur, etc.). Emoji fallback shown when no image is set.
                    <span className="text-success-bright font-bold ml-1">{leagues.length} leagues loaded.</span>
                </div>
                <button
                    onClick={handleSeed}
                    disabled={seeding}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-success-alpha-20 hover:bg-success-alpha-20 border border-success-primary/30 text-success-bright text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                >
                    {seeding ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={12} />}
                    {seeding ? 'Seeding…' : 'Re-seed'}
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <input
                    type="text"
                    placeholder="Search leagues or sport…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-bg-deep-4 border border-white/[0.06] rounded-xl px-4 py-2.5 pl-9 text-sm text-white outline-none focus:border-success-primary/40 transition-all placeholder:text-white/20"
                />
                <ImageIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            </div>

            {/* League rows */}
            {leagues.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">
                    No leagues found. Click <strong>Re-seed</strong> to populate from the live event cache.
                </div>
            ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {filtered.map((league) => {
                        const url = urls[league.competitionId] ?? '';
                        const isSaving = saving[league.competitionId] ?? false;
                        const isDone = saved[league.competitionId] ?? false;
                        const isDirty = url !== (league.imageUrl ?? '');

                        return (
                            <div
                                key={league.competitionId}
                                className="flex items-center gap-3 p-2.5 rounded-xl border border-white/[0.06] bg-bg-deep-4 hover:border-white/[0.06] transition-all"
                            >
                                {/* Preview */}
                                <div className="h-10 w-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.04] border border-white/[0.06]">
                                    {url ? (
                                        <img src={url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-white/20">
                                            <ImageIcon size={14} />
                                        </div>
                                    )}
                                </div>

                                {/* Name */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{league.competitionName}</p>
                                    <p className="text-[10px] text-white/30 mt-0.5">{league.sportName || league.sportId}</p>
                                </div>

                                {/* URL input (sm+) */}
                                <input
                                    type="url"
                                    placeholder="Paste image URL…"
                                    value={url}
                                    onChange={(e) => setUrls((p) => ({ ...p, [league.competitionId]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(league.competitionId); }}
                                    className="w-[200px] bg-bg-deep border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-success-primary/40 transition-all placeholder:text-white/20 hidden sm:block"
                                />

                                {/* Save */}
                                <button
                                    onClick={() => handleSave(league.competitionId)}
                                    disabled={isSaving || !isDirty}
                                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex-shrink-0 ${
                                        isDone
                                            ? 'bg-success-alpha-20 text-success-bright border border-success-primary/30'
                                            : isDirty
                                                ? 'bg-brand-gold hover:bg-brand-gold-hover text-text-inverse border border-transparent'
                                                : 'bg-white/[0.04] text-white/20 border border-white/[0.04] cursor-not-allowed'
                                    }`}
                                >
                                    {isSaving ? (
                                        <Loader2 size={11} className="animate-spin" />
                                    ) : isDone ? (
                                        <CheckCircle size={11} />
                                    ) : (
                                        <Save size={11} />
                                    )}
                                    {isSaving ? 'Saving' : isDone ? 'Saved!' : 'Save'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Accordion Section Shell ─────────────────────────────────────────────────
function SettingsSection({
    icon: Icon,
    title,
    subtitle,
    iconColor = 'text-brand-gold',
    iconBg = 'bg-brand-gold/10',
    children,
    defaultOpen = false,
}: {
    icon: React.ElementType;
    title: string;
    subtitle: string;
    iconColor?: string;
    iconBg?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className={`bg-bg-modal border border-white/[0.06] rounded-2xl ${open ? 'overflow-visible' : 'overflow-hidden'}`}>
            <button
                onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center gap-4 p-5 hover:bg-white/[0.03] transition-colors text-left ${open ? 'rounded-t-2xl' : 'rounded-2xl'}`}
            >
                <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} className={iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-white">{title}</h2>
                    <p className="text-xs text-white/30 mt-0.5">{subtitle}</p>
                </div>
                <ChevronRight
                    size={16}
                    className={`text-white/20 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-90' : ''}`}
                />
            </button>
            {open && (
                <div className="border-t border-white/[0.06] px-5 py-5">
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── Account Info Section ─────────────────────────────────────────────────────
function AccountInfo() {
    const { user } = useAuth();
    const [bindType, setBindType] = useState<'none' | 'email' | 'phone'>('none');

    const fields = [
        { label: 'Email', value: user?.email || '', icon: Mail, type: 'email' as const },
        { label: 'Phone', value: user?.phoneNumber || '', icon: Phone, type: 'phone' as const },
        { label: 'Username', value: user?.username || '–', icon: User, type: 'text' as const },
        {
            label: 'Member Since',
            value: user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : '–',
            icon: Calendar,
            type: 'text' as const,
        },
    ];

    return (
        <div className="space-y-3">
            {fields.map(({ label, value, icon: Icon, type }) => (
                <div key={label} className="flex items-center gap-3 bg-bg-deep-4 rounded-xl px-4 py-3 border border-white/[0.04]">
                    <Icon size={14} className="text-white/30 flex-shrink-0" />
                    <span className="text-xs text-white/30 w-24 flex-shrink-0">{label}</span>
                    <span className="text-sm text-white font-medium flex-1 truncate">{value || '–'}</span>
                    
                    {/* Render Bind button for missing email or phone */}
                    {(!value && (type === 'email' || type === 'phone')) && (
                        <button
                            onClick={() => setBindType(type)}
                            className="px-3 py-1 bg-brand-gold hover:bg-brand-gold-hover text-text-inverse text-[10px] font-bold rounded-lg transition-colors flex-shrink-0"
                        >
                            Bind {label}
                        </button>
                    )}
                </div>
            ))}

            {/* Modals */}
            {bindType === 'phone' && <BindMobileModal onClose={() => setBindType('none')} onSuccess={() => setBindType('none')} />}
            {bindType === 'email' && <BindEmailModal onClose={() => setBindType('none')} onSuccess={() => setBindType('none')} />}
        </div>
    );
}

// ─── Personal Info Section ──────────────────────────────────────────────────
function PersonalInfo() {
    const { user, login } = useAuth();
    const [form, setForm] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        country: user?.country || '',
        city: user?.city || '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            setForm({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                country: user.country || '',
                city: user.city || '',
            });
        }
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.firstName.trim() || !form.lastName.trim() || !form.country.trim() || !form.city.trim()) {
            setError('All fields are required.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await api.patch('/user/profile', form);
            if (res.data.success) {
                toast.success('Personal info updated successfully!');
                // Refresh auth context
                try {
                    const profileRes = await api.get('/auth/profile');
                    const token = localStorage.getItem('token') || '';
                    if (token) login(token, profileRes.data);
                } catch { /* ignore */ }
            } else {
                setError(res.data.error || 'Failed to update info.');
            }
        } catch (e: any) {
            setError(e.response?.data?.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    const isDirty = form.firstName !== (user?.firstName || '') ||
                    form.lastName !== (user?.lastName || '') ||
                    form.country !== (user?.country || '') ||
                    form.city !== (user?.city || '');

    return (
        <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="First Name (Name)"
                    required
                    className="w-full bg-bg-deep-4 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-gold/60 transition-all placeholder:text-white/20"
                />
                <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Last Name (Surname)"
                    required
                    className="w-full bg-bg-deep-4 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-gold/60 transition-all placeholder:text-white/20"
                />
                <CountrySelector
                    value={form.country}
                    onChange={(iso: string) => {
                        setForm({ ...form, country: iso });
                        setError('');
                    }}
                />
                <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="City"
                    required
                    className="w-full bg-bg-deep-4 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-gold/60 transition-all placeholder:text-white/20"
                />
            </div>

            {error && <p className="text-danger text-xs flex items-center gap-1.5"><AlertCircle size={12} />{error}</p>}

            <button
                type="submit"
                disabled={loading || !isDirty}
                className="w-full py-2.5 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-40 disabled:cursor-not-allowed text-text-inverse text-sm font-black rounded-xl transition-colors flex items-center justify-center gap-2 mt-1"
            >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Changes
            </button>
        </form>
    );
}

// ─── Change Username Section ──────────────────────────────────────────────────
function ChangeUsername() {
    const { user, login } = useAuth();
    const [value, setValue] = useState(user?.username || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user?.username) setValue(user.username);
    }, [user?.username]);

    const handleSave = async () => {
        const trimmed = value.trim();
        if (!trimmed || trimmed === user?.username) return;
        if (trimmed.length < 3 || trimmed.length > 20) { setError('Must be 3–20 characters.'); return; }
        if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setError('Letters, numbers, underscores only.'); return; }

        setLoading(true);
        setError('');
        try {
            const res = await api.patch('/user/username', { username: trimmed });
            if (res.data.success) {
                toast.success(`Username updated to ${res.data.username}`);
                // Refresh auth context
                try {
                    const profileRes = await api.get('/auth/profile');
                    const token = localStorage.getItem('token') || '';
                    if (token) login(token, profileRes.data);
                } catch { /* non-critical */ }
            } else {
                setError(res.data.error || 'Failed to update.');
            }
        } catch (e: any) {
            setError(e.response?.data?.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={e => { setValue(e.target.value); setError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                    maxLength={20}
                    placeholder="new_username"
                    className="flex-1 bg-bg-deep-4 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-gold/60 transition-all font-mono placeholder:text-white/20"
                />
                <button
                    onClick={handleSave}
                    disabled={loading || !value.trim() || value.trim() === user?.username}
                    className="px-5 py-2.5 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-40 disabled:cursor-not-allowed text-text-inverse text-sm font-black rounded-xl transition-colors flex items-center gap-2"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Save
                </button>
            </div>
            {error && <p className="text-danger text-xs flex items-center gap-1.5"><AlertCircle size={12} />{error}</p>}
            <p className="text-[11px] text-white/20">3–20 characters · letters, numbers, underscores only</p>
        </div>
    );
}

// ─── Change Password Section ──────────────────────────────────────────────────
function ChangePassword() {
    const [form, setForm] = useState({ current: '', next: '', confirm: '' });
    const [show, setShow] = useState({ current: false, next: false, confirm: false });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const toggle = (field: keyof typeof show) => setShow(s => ({ ...s, [field]: !s[field] }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.current || !form.next || !form.confirm) { setError('All fields are required.'); return; }
        if (form.next.length < 6) { setError('New password must be at least 6 characters.'); return; }
        if (form.next !== form.confirm) { setError('New passwords do not match.'); return; }

        setLoading(true);
        setError('');
        try {
            const res = await api.patch('/user/change-password', {
                currentPassword: form.current,
                newPassword: form.next,
            });
            if (res.data.success) {
                toast.success('Password changed successfully!');
                setForm({ current: '', next: '', confirm: '' });
            } else {
                setError(res.data.error || 'Failed to change password.');
            }
        } catch (e: any) {
            setError(e.response?.data?.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    const fields: { key: keyof typeof form; label: string; toggleKey: keyof typeof show }[] = [
        { key: 'current', label: 'Current Password', toggleKey: 'current' },
        { key: 'next', label: 'New Password', toggleKey: 'next' },
        { key: 'confirm', label: 'Confirm New Password', toggleKey: 'confirm' },
    ];

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            {fields.map(({ key, label, toggleKey }) => (
                <div key={key} className="relative">
                    <input
                        type={show[toggleKey] ? 'text' : 'password'}
                        placeholder={label}
                        value={form[key]}
                        onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); setError(''); }}
                        className="w-full bg-bg-deep-4 border border-white/[0.06] rounded-xl px-4 py-2.5 pr-10 text-sm text-white outline-none focus:border-brand-gold/60 transition-all placeholder:text-white/20"
                    />
                    <button
                        type="button"
                        onClick={() => toggle(toggleKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                    >
                        {show[toggleKey] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                </div>
            ))}

            {error && <p className="text-danger text-xs flex items-center gap-1.5"><AlertCircle size={12} />{error}</p>}

            {/* Password strength hints */}
            <ul className="text-[11px] text-white/20 space-y-0.5 pl-1">
                <li className={form.next.length >= 6 ? 'text-green-400' : ''}>• At least 6 characters</li>
                <li className={form.next === form.confirm && form.confirm.length > 0 ? 'text-green-400' : ''}>• Passwords match</li>
            </ul>

            <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-brand-gold hover:bg-brand-gold-hover disabled:opacity-40 disabled:cursor-not-allowed text-text-inverse text-sm font-black rounded-xl transition-colors flex items-center justify-center gap-2 mt-1"
            >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                Update Password
            </button>
        </form>
    );
}

// ─── Wallet Preference Section ────────────────────────────────────────────────
function WalletPreference() {
    const { selectedWallet, setSelectedWallet, fiatBalance, cryptoBalance, fiatCurrency, activeSymbol } = useWallet();
    const [saving, setSaving] = useState(false);

    const handleSelect = async (wallet: 'fiat' | 'crypto') => {
        if (wallet === selectedWallet) return;
        setSaving(true);
        setSelectedWallet(wallet);
        try {
            await api.patch('/user/wallet-preference', { wallet });
            toast.success(`Active wallet set to ${wallet === 'fiat' ? 'Fiat' : 'Crypto'}`);
        } catch {
            toast.error('Failed to save preference');
        } finally {
            setSaving(false);
        }
    };

    const formatFiat = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: fiatCurrency, minimumFractionDigits: 2 }).format(n);
    const formatUSD = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

    const options = [
        {
            id: 'fiat' as const,
            label: 'Fiat Wallet',
            desc: `${fiatCurrency} · Deposits & withdrawals`,
            emoji: '🏦',
            balance: formatFiat(fiatBalance),
            active: selectedWallet === 'fiat',
            activeClass: 'border-brand-gold/60 bg-brand-gold/5 shadow-[0_0_16px_rgba(212,175,55,0.1)]',
            dotClass: 'bg-brand-gold shadow-[0_0_6px_rgba(212,175,55,0.6)]',
            labelClass: 'text-brand-gold',
        },
        {
            id: 'crypto' as const,
            label: 'Crypto Wallet',
            desc: 'USD · Auto-credited from crypto',
            emoji: '💎',
            balance: formatUSD(cryptoBalance),
            active: selectedWallet === 'crypto',
            activeClass: 'border-purple-500/60 bg-purple-500/5 shadow-[0_0_16px_rgba(168,85,247,0.1)]',
            dotClass: 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.6)]',
            labelClass: 'text-accent-purple',
        },
    ];

    return (
        <div className="space-y-3">
            <p className="text-xs text-white/30 mb-4">
                Choose your default active wallet. This determines which balance is shown in the header.
            </p>
            {options.map(opt => (
                <button
                    key={opt.id}
                    onClick={() => handleSelect(opt.id)}
                    disabled={saving}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${opt.active
                        ? opt.activeClass
                        : 'border-white/[0.04] bg-bg-deep-4 hover:border-white/[0.1]'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-xl">{opt.emoji}</span>
                        <div className="text-left">
                            <p className={`text-sm font-bold ${opt.active ? opt.labelClass : 'text-white'}`}>{opt.label}</p>
                            <p className="text-xs text-white/30">{opt.desc}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${opt.active ? opt.labelClass : 'text-white/50'}`}>{opt.balance}</span>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${opt.active ? opt.dotClass : 'bg-white/[0.08]'}`} />
                    </div>
                </button>
            ))}
        </div>
    );
}

// ─── Danger Zone Section ──────────────────────────────────────────────────────
function DangerZone() {
    return (
        <div className="space-y-4">
            <p className="text-xs text-white/30 leading-relaxed">
                Account deletion is permanent and cannot be undone. All your data, transaction history, and balances will be lost. 
                To request account deletion, please contact our support team.
            </p>
            <a
                href="/support"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-danger-alpha-10 hover:bg-danger-alpha-16 border border-danger/20 text-danger text-sm font-bold rounded-xl transition-colors"
            >
                <ExternalLink size={14} />
                Contact Support to Delete Account
            </a>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
    const { user } = useAuth();

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center flex-shrink-0">
                    <Settings size={20} className="text-brand-gold" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-white">Settings</h1>
                    <p className="text-xs text-white/30 mt-0.5">Manage your account preferences and security</p>
                </div>
            </div>

            {/* Sections */}
            <div className="space-y-3">
                <SettingsSection
                    icon={User}
                    title="Account Information"
                    subtitle="Your system identifiers and member info"
                    iconColor="text-brand-gold"
                    iconBg="bg-brand-gold/10"
                    defaultOpen
                >
                    <AccountInfo />
                </SettingsSection>

                <SettingsSection
                    icon={User}
                    title="Personal Information"
                    subtitle="Name, Surname, City, and Country (Required for withdrawals)"
                    iconColor="text-success-bright"
                    iconBg="bg-success-alpha-10"
                    defaultOpen
                >
                    <PersonalInfo />
                </SettingsSection>

                <SettingsSection
                    icon={Edit2}
                    title="Change Username"
                    subtitle="Update your display name"
                    iconColor="text-green-400"
                    iconBg="bg-green-500/10"
                >
                    <ChangeUsername />
                </SettingsSection>

                <SettingsSection
                    icon={Lock}
                    title="Change Password"
                    subtitle="Keep your account secure with a strong password"
                    iconColor="text-brand-gold"
                    iconBg="bg-brand-gold/10"
                >
                    <ChangePassword />
                </SettingsSection>

                <SettingsSection
                    icon={Wallet}
                    title="Wallet Preference"
                    subtitle="Set your default active wallet for bets and balance display"
                    iconColor="text-accent-purple"
                    iconBg="bg-purple-500/10"
                >
                    <WalletPreference />
                </SettingsSection>

                {/* Admin-only: Sidebar Casino Categories */}
                {['ADMIN', 'admin', 'SUPER_ADMIN'].includes(user?.role ?? '') && (
                    <SettingsSection
                        icon={Gamepad2}
                        title="Sidebar Casino Categories"
                        subtitle="Choose which casino categories appear in the sidebar (max 8)"
                        iconColor="text-brand-gold"
                        iconBg="bg-brand-gold/10"
                        defaultOpen
                    >
                        <AdminSidebarCategories />
                    </SettingsSection>
                )}

                {/* Admin-only: League image editor */}
                {['ADMIN', 'admin', 'SUPER_ADMIN'].includes(user?.role ?? '') && (
                    <SettingsSection
                        icon={Trophy}
                        title="Sports League Images"
                        subtitle="Set banner images for leagues shown in the sports page slider"
                        iconColor="text-success-bright"
                        iconBg="bg-success-alpha-10"
                    >
                        <AdminLeagueImages />
                    </SettingsSection>
                )}

                <SettingsSection
                    icon={Shield}
                    title="Danger Zone"
                    subtitle="Irreversible account actions"
                    iconColor="text-danger"
                    iconBg="bg-danger-alpha-10"
                >
                    <DangerZone />
                </SettingsSection>
            </div>
        </div>
    );
}
