"use client";

import React, { useEffect, useState } from 'react';
import {
    getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement
} from '@/actions/cms';
import {
    Plus, Edit2, Trash2, Loader2, X, Bell, Info, AlertTriangle,
    CheckCircle, Zap, Pin, Eye, EyeOff, BadgeCheck, LayoutGrid
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type AnnouncementType = 'INFO' | 'WARNING' | 'SUCCESS' | 'PROMO';

interface Announcement {
    _id: string;
    title: string;
    message: string;
    type: AnnouncementType;
    isActive: boolean;
    isPinned: boolean;
    startAt?: string;
    endAt?: string;
    order: number;
    createdAt?: string;
}

const EMPTY_FORM = {
    title: '',
    message: '',
    type: 'INFO' as AnnouncementType,
    isActive: true,
    isPinned: false,
    startAt: '',
    endAt: '',
    order: 0,
};

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<AnnouncementType, { label: string; icon: any; bg: string; border: string; text: string; badge: string }> = {
    INFO: {
        label: 'Info', icon: Info,
        bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400',
        badge: 'bg-blue-500/15 text-blue-400',
    },
    WARNING: {
        label: 'Warning', icon: AlertTriangle,
        bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400',
        badge: 'bg-amber-500/15 text-amber-400',
    },
    SUCCESS: {
        label: 'Success', icon: CheckCircle,
        bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400',
        badge: 'bg-emerald-500/15 text-emerald-400',
    },
    PROMO: {
        label: 'Promo', icon: Zap,
        bg: 'bg-amber-900/20', border: 'border-amber-400/30', text: 'text-amber-300',
        badge: 'bg-amber-400/15 text-amber-300',
    },
};

const FILTER_TYPES = [
    { id: '', label: 'All' },
    { id: 'INFO', label: 'Info' },
    { id: 'WARNING', label: 'Warning' },
    { id: 'SUCCESS', label: 'Success' },
    { id: 'PROMO', label: 'Promo' },
];

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AnnouncementsAdminPage() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        const res = await getAnnouncements();
        if (res.success) setAnnouncements(res.data as Announcement[]);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        setShowModal(true);
    };

    const openEdit = (a: Announcement) => {
        setEditingId(a._id);
        setForm({
            title: a.title || '',
            message: a.message || '',
            type: a.type || 'INFO',
            isActive: a.isActive,
            isPinned: a.isPinned,
            startAt: a.startAt ? a.startAt.split('T')[0] : '',
            endAt: a.endAt ? a.endAt.split('T')[0] : '',
            order: a.order || 0,
        });
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const payload = {
            ...form,
            startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
            endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        };
        const res = editingId
            ? await updateAnnouncement(editingId, payload)
            : await createAnnouncement(payload);
        if (res.success) {
            setShowModal(false);
            fetchData();
        } else {
            alert(res.error || 'Save failed');
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this announcement?')) return;
        setDeleting(id);
        await deleteAnnouncement(id);
        fetchData();
        setDeleting(null);
    };

    const handleToggle = async (a: Announcement, field: 'isActive' | 'isPinned') => {
        await updateAnnouncement(a._id, { [field]: !a[field] });
        fetchData();
    };

    const filtered = filterType
        ? announcements.filter(a => a.type === filterType)
        : announcements;

    const now = new Date();
    const activeCount = announcements.filter(a => a.isActive).length;
    const pinnedCount = announcements.filter(a => a.isPinned).length;
    const scheduledCount = announcements.filter(a => a.startAt && new Date(a.startAt) > now).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <Bell size={26} className="text-indigo-400" /> Announcements
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Manage site-wide banners displayed to all users at the top of every page.
                    </p>
                </div>
                <button onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-colors">
                    <Plus size={18} /> Add Announcement
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total', value: announcements.length, icon: LayoutGrid, color: 'text-white' },
                    { label: 'Active', value: activeCount, icon: Eye, color: 'text-emerald-400' },
                    { label: 'Pinned', value: pinnedCount, icon: Pin, color: 'text-amber-400' },
                    { label: 'Scheduled', value: scheduledCount, icon: Bell, color: 'text-blue-400' },
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

            {/* Type Filter */}
            <div className="flex gap-2 flex-wrap">
                {FILTER_TYPES.map(f => (
                    <button key={f.id} onClick={() => setFilterType(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${filterType === f.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                        {f.label}
                        <span className="ml-1.5 text-xs opacity-60">
                            ({f.id ? announcements.filter(a => a.type === f.id).length : announcements.length})
                        </span>
                    </button>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-slate-500" /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                    <Bell size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="font-bold">No announcements yet</p>
                    <p className="text-sm mt-1">Click "Add Announcement" to create the first one</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(ann => {
                        const cfg = TYPE_CONFIG[ann.type] || TYPE_CONFIG.INFO;
                        const TypeIcon = cfg.icon;
                        return (
                            <div key={ann._id}
                                className={`bg-slate-800 border rounded-xl p-4 transition-colors hover:border-slate-600 ${ann.isPinned ? 'border-amber-500/30' : 'border-slate-700'}`}>
                                <div className="flex items-start justify-between gap-4">
                                    {/* Left */}
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className={`p-2 rounded-lg flex-shrink-0 ${cfg.bg}`}>
                                            <TypeIcon size={16} className={cfg.text} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                <span className="text-white font-bold text-sm truncate">{ann.title}</span>
                                                {ann.isPinned && (
                                                    <span className="flex items-center gap-0.5 text-[10px] font-black bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full">
                                                        <Pin size={8} /> Pinned
                                                    </span>
                                                )}
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                                                    {cfg.label}
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ann.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                                                    {ann.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <p className="text-slate-400 text-xs line-clamp-2">{ann.message}</p>
                                            {(ann.startAt || ann.endAt) && (
                                                <p className="text-slate-600 text-[10px] mt-1">
                                                    {ann.startAt && `From ${new Date(ann.startAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                                                    {ann.startAt && ann.endAt && ' → '}
                                                    {ann.endAt && `Until ${new Date(ann.endAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button onClick={() => handleToggle(ann, 'isActive')}
                                            title={ann.isActive ? 'Deactivate' : 'Activate'}
                                            className={`p-2 rounded-lg text-xs transition-colors ${ann.isActive ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400'}`}>
                                            {ann.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                        <button onClick={() => handleToggle(ann, 'isPinned')}
                                            title={ann.isPinned ? 'Unpin' : 'Pin to top'}
                                            className={`p-2 rounded-lg text-xs transition-colors ${ann.isPinned ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-400'}`}>
                                            <Pin size={14} />
                                        </button>
                                        <button onClick={() => openEdit(ann)}
                                            className="p-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg text-xs transition-colors">
                                            <Edit2 size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(ann._id)} disabled={deleting === ann._id}
                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-colors disabled:opacity-50">
                                            {deleting === ann._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ─── Create / Edit Modal ──────────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
                    <form onSubmit={handleSave}
                        className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg my-8 shadow-2xl"
                        onClick={e => e.stopPropagation()}>

                        {/* Modal header */}
                        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white">
                                {editingId ? 'Edit Announcement' : 'New Announcement'}
                            </h2>
                            <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-xs text-slate-400 font-bold mb-1">Title *</label>
                                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                    placeholder="e.g. Scheduled maintenance Sunday 2am–4am"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                            </div>

                            {/* Message */}
                            <div>
                                <label className="block text-xs text-slate-400 font-bold mb-1">Message *</label>
                                <textarea required rows={3} value={form.message}
                                    onChange={e => setForm({ ...form, message: e.target.value })}
                                    placeholder="Full announcement text shown to users..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none resize-none" />
                            </div>

                            {/* Type */}
                            <div>
                                <label className="block text-xs text-slate-400 font-bold mb-2">Type</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['INFO', 'WARNING', 'SUCCESS', 'PROMO'] as AnnouncementType[]).map(t => {
                                        const cfg = TYPE_CONFIG[t];
                                        const TIcon = cfg.icon;
                                        const isSelected = form.type === t;
                                        return (
                                            <button type="button" key={t} onClick={() => setForm({ ...form, type: t })}
                                                className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border-2 transition-all text-xs font-bold
                                                    ${isSelected ? `${cfg.bg} ${cfg.border} ${cfg.text}` : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                                <TIcon size={16} />
                                                {cfg.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Scheduling */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-400 font-bold mb-1">Start Date <span className="text-slate-600">(optional)</span></label>
                                    <input type="date" value={form.startAt}
                                        onChange={e => setForm({ ...form, startAt: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 font-bold mb-1">End Date <span className="text-slate-600">(optional)</span></label>
                                    <input type="date" value={form.endAt}
                                        onChange={e => setForm({ ...form, endAt: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                </div>
                            </div>

                            {/* Order */}
                            <div>
                                <label className="block text-xs text-slate-400 font-bold mb-1">Display Order</label>
                                <input type="number" min={0} value={form.order}
                                    onChange={e => setForm({ ...form, order: +e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                            </div>

                            {/* Toggles */}
                            <div className="flex gap-6">
                                {([
                                    { key: 'isActive' as const, label: 'Active', desc: 'Visible to users' },
                                    { key: 'isPinned' as const, label: 'Pinned', desc: 'Shown above others' },
                                ]).map(t => (
                                    <label key={t.key} className="flex items-center gap-3 cursor-pointer">
                                        <div className={`w-11 h-6 rounded-full relative transition-colors ${form[t.key] ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form[t.key] ? 'left-6' : 'left-1'}`} />
                                            <input type="checkbox" checked={form[t.key]}
                                                onChange={e => setForm({ ...form, [t.key]: e.target.checked })}
                                                className="sr-only" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{t.label}</p>
                                            <p className="text-xs text-slate-500">{t.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
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
                                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Announcement'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
