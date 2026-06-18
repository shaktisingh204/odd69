"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
    getAllBetfairEvents, getBetfairEventsBySport, getTopEvents, getHomeEvents,
    toggleBetfairEventVisibility, togglePopularEvent, toggleHomeEvent, toggleBetfairEventPinned,
    updateEventThumbnail, updateEventTeamImages,
} from '@/actions/sports';
import { uploadToCloudflare } from '@/actions/upload';
import {
    Search, Star, Home, Eye, EyeOff, Trophy, Calendar, Loader2,
    RefreshCcw, ChevronLeft, ChevronRight, Pin, ImageIcon, X, Upload, Check
} from 'lucide-react';
import Link from 'next/link';

// ── Sportradar sports (use sr:sport:X IDs) ─────────────────────────────────
const SPORTS = [
    { id: 'ALL',         name: 'All Sports',       emoji: '🏆' },
    { id: 'sr:sport:21', name: 'Cricket',           emoji: '🏏' },
    { id: 'sr:sport:1',  name: 'Soccer',            emoji: '⚽' },
    { id: 'sr:sport:5',  name: 'Tennis',            emoji: '🎾' },
    { id: 'sr:sport:2',  name: 'Basketball',        emoji: '🏀' },
    { id: 'sr:sport:31', name: 'Badminton',         emoji: '🏸' },
    { id: 'sr:sport:20', name: 'Table Tennis',      emoji: '🏓' },
    { id: 'sr:sport:23', name: 'Volleyball',        emoji: '🏐' },
    { id: 'sr:sport:12', name: 'Rugby',             emoji: '🏉' },
    { id: 'sr:sport:4',  name: 'Ice Hockey',        emoji: '🏒' },
    { id: 'sr:sport:138',name: 'Kabaddi',           emoji: '🤼' },
    { id: 'sr:sport:22', name: 'Darts',             emoji: '🎯' },
];

type EventRow = {
    _id?: string;
    eventId: string;
    eventName: string;
    competitionId: string;
    competitionName: string;
    sportId: string;
    marketStartTime: string;
    inplay: boolean;
    status: string;
    isVisible: boolean;
    isPinned?: boolean;
    homeTeam?: string;
    awayTeam?: string;
    thumbnail?: string;
    team1Image?: string;
    team2Image?: string;
};

type Toast = { msg: string; type: 'success' | 'error' };

const PER_PAGE = 30;

function ThumbnailCell({
    eventId, thumbnail, team1Image, team2Image, onUpdate,
}: {
    eventId: string;
    thumbnail?: string;
    team1Image?: string;
    team2Image?: string;
    onUpdate: (data: { thumbnail?: string; team1Image?: string; team2Image?: string }) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [url, setUrl] = React.useState(thumbnail || '');
    const [img1, setImg1] = React.useState(team1Image || '');
    const [img2, setImg2] = React.useState(team2Image || '');
    const [saving, setSaving] = React.useState(false);
    const [uploading1, setUploading1] = React.useState(false);
    const [uploading2, setUploading2] = React.useState(false);
    const [uploadingThumb, setUploadingThumb] = React.useState(false);
    const file1Ref = React.useRef<HTMLInputElement>(null);
    const file2Ref = React.useRef<HTMLInputElement>(null);
    const fileThumbRef = React.useRef<HTMLInputElement>(null);

    const hasTeamImages = !!(img1 || img2);
    const hasThumb = !!url;
    const hasAny = hasTeamImages || hasThumb;

    const handleUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        setter: (v: string) => void,
        setLoading: (v: boolean) => void,
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('folder', 'event-thumbnails');
            const res = await uploadToCloudflare(fd);
            if (res.url) setter(res.url);
        } catch {}
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        // Save team images
        if (img1 || img2) {
            await updateEventTeamImages(eventId, img1, img2);
        }
        // Save thumbnail (legacy single image)
        await updateEventThumbnail(eventId, url);
        setSaving(false);
        onUpdate({ thumbnail: url, team1Image: img1, team2Image: img2 });
        setOpen(false);
    };

    const handleClear = async () => {
        setSaving(true);
        await updateEventTeamImages(eventId, '', '');
        await updateEventThumbnail(eventId, '');
        onUpdate({ thumbnail: '', team1Image: '', team2Image: '' });
        setUrl(''); setImg1(''); setImg2('');
        setSaving(false);
        setOpen(false);
    };

    if (!open) {
        return (
            <button onClick={() => setOpen(true)} className="relative group">
                {hasTeamImages ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-600 flex">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {img1 && <img src={img1} alt="" className="w-1/2 h-full object-cover" />}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {img2 && <img src={img2} alt="" className="w-1/2 h-full object-cover" />}
                        {!img1 && <div className="w-1/2 h-full bg-slate-700" />}
                        {!img2 && <div className="w-1/2 h-full bg-slate-700" />}
                    </div>
                ) : hasThumb ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-600">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="w-10 h-10 rounded-lg border border-dashed border-slate-600 flex items-center justify-center text-slate-600 hover:border-indigo-500 hover:text-indigo-400 transition-colors">
                        <ImageIcon size={14} />
                    </div>
                )}
            </button>
        );
    }

    return (
        <div className="absolute left-0 right-0 z-30 mx-4 mt-1 rounded-xl bg-slate-800 border border-slate-600 p-3 shadow-2xl space-y-3" style={{ width: 380 }}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Match Card Images</span>
                <button onClick={() => setOpen(false)} className="p-1 hover:bg-slate-700 rounded"><X size={12} className="text-slate-500" /></button>
            </div>

            {/* Team 1 & Team 2 images — "/" split style */}
            <div className="space-y-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Team Images (/ split style)</span>
                <div className="flex gap-2">
                    {/* Team 1 */}
                    <div className="flex-1 space-y-1.5">
                        <span className="text-[10px] text-slate-400 font-medium">Team 1 (Home)</span>
                        {img1 ? (
                            <div className="relative group/img">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img1} alt="" className="w-full h-16 object-cover rounded-lg border border-slate-700" />
                                <button onClick={() => setImg1('')} className="absolute top-1 right-1 p-0.5 bg-red-600 rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity">
                                    <X size={8} className="text-white" />
                                </button>
                            </div>
                        ) : (
                            <div className="w-full h-16 rounded-lg border border-dashed border-slate-600 flex items-center justify-center">
                                <span className="text-[10px] text-slate-600">No image</span>
                            </div>
                        )}
                        <input ref={file1Ref} type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, setImg1, setUploading1)} />
                        <button onClick={() => file1Ref.current?.click()} disabled={uploading1}
                            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-[10px] text-slate-300 transition-colors disabled:opacity-50">
                            {uploading1 ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                            Upload
                        </button>
                    </div>
                    {/* Team 2 */}
                    <div className="flex-1 space-y-1.5">
                        <span className="text-[10px] text-slate-400 font-medium">Team 2 (Away)</span>
                        {img2 ? (
                            <div className="relative group/img">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img2} alt="" className="w-full h-16 object-cover rounded-lg border border-slate-700" />
                                <button onClick={() => setImg2('')} className="absolute top-1 right-1 p-0.5 bg-red-600 rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity">
                                    <X size={8} className="text-white" />
                                </button>
                            </div>
                        ) : (
                            <div className="w-full h-16 rounded-lg border border-dashed border-slate-600 flex items-center justify-center">
                                <span className="text-[10px] text-slate-600">No image</span>
                            </div>
                        )}
                        <input ref={file2Ref} type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, setImg2, setUploading2)} />
                        <button onClick={() => file2Ref.current?.click()} disabled={uploading2}
                            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-[10px] text-slate-300 transition-colors disabled:opacity-50">
                            {uploading2 ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                            Upload
                        </button>
                    </div>
                </div>
            </div>

            {/* Legacy single thumbnail */}
            <div className="space-y-1.5 border-t border-slate-700 pt-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Or Single Thumbnail (fallback)</span>
                {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="w-full h-16 object-cover rounded-lg border border-slate-700" />
                )}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        placeholder="Image URL..."
                        className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-white focus:border-indigo-500 outline-none"
                    />
                    <input ref={fileThumbRef} type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, setUrl, setUploadingThumb)} />
                    <button onClick={() => fileThumbRef.current?.click()} disabled={uploadingThumb}
                        className="flex items-center gap-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-[10px] text-slate-300 transition-colors disabled:opacity-50">
                        {uploadingThumb ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                    </button>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs text-white transition-colors disabled:opacity-50">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Save
                </button>
                {hasAny && (
                    <button onClick={handleClear} disabled={saving}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20 disabled:opacity-50">
                        Clear All
                    </button>
                )}
            </div>
        </div>
    );
}

export default function EventsPage() {
    const [events, setEvents] = useState<EventRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedSportId, setSelectedSportId] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [popularIds, setPopularIds] = useState<Set<string>>(new Set());
    const [homeIds, setHomeIds] = useState<Set<string>>(new Set());
    const [toggling, setToggling] = useState<string | null>(null);
    const [toast, setToast] = useState<Toast | null>(null);
    const [page, setPage] = useState(1);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [eventsRes, topRes, homeRes] = await Promise.all([
                selectedSportId === 'ALL'
                    ? getAllBetfairEvents(search)
                    : getBetfairEventsBySport(selectedSportId),
                getTopEvents(),
                getHomeEvents(),
            ]);

            if (eventsRes.success && eventsRes.data) {
                setEvents(eventsRes.data as EventRow[]);
            } else {
                showToast(eventsRes.error || 'Failed to load events', 'error');
                setEvents([]);
            }

            if (topRes.success && topRes.data) {
                // TopEvent uses event_id field (legacy compat)
                setPopularIds(new Set(topRes.data.map((t: any) => String(t.event_id))));
            }
            if (homeRes.success && homeRes.data) {
                setHomeIds(new Set(homeRes.data.map((h: any) => String(h.event_id))));
            }
            setPage(1);
        } catch (e) {
            console.error('Fetch error', e);
            showToast('Failed to connect to database', 'error');
        } finally {
            setLoading(false);
        }
    }, [selectedSportId, search]);

    useEffect(() => {
        const t = setTimeout(fetchAll, 350);
        return () => clearTimeout(t);
    }, [fetchAll]);

    const handleTogglePopular = async (event: EventRow) => {
        const id = event.eventId;
        const isPopular = popularIds.has(id);
        setToggling(`pop_${id}`);
        try {
            const res = await togglePopularEvent(id, !isPopular, event.eventName);
            if (res.success) {
                setPopularIds(prev => {
                    const next = new Set(prev);
                    if (isPopular) next.delete(id); else next.add(id);
                    return next;
                });
                showToast(isPopular ? 'Removed from Popular' : '⭐ Marked as Popular', 'success');
            } else {
                showToast('Failed to update', 'error');
            }
        } catch {
            showToast('Error updating popular status', 'error');
        } finally {
            setToggling(null);
        }
    };

    const handleToggleHome = async (event: EventRow) => {
        const id = event.eventId;
        const isHome = homeIds.has(id);
        setToggling(`home_${id}`);
        try {
            const res = await toggleHomeEvent(id, !isHome, event.eventName);
            if (res.success) {
                setHomeIds(prev => {
                    const next = new Set(prev);
                    if (isHome) next.delete(id); else next.add(id);
                    return next;
                });
                showToast(isHome ? 'Removed from Home Page' : '🏠 Added to Home Page', 'success');
            } else {
                showToast('Failed to update', 'error');
            }
        } catch {
            showToast('Error updating home status', 'error');
        } finally {
            setToggling(null);
        }
    };

    const handleTogglePinned = async (event: EventRow) => {
        const id = event.eventId;
        const next = !event.isPinned;
        setToggling(`pin_${id}`);
        try {
            const res = await toggleBetfairEventPinned(id, next);
            if (res.success) {
                setEvents(prev => prev.map(e => e.eventId === id ? { ...e, isPinned: next } : e));
                showToast(next ? '📌 Pinned to top' : 'Unpinned', 'success');
            } else {
                showToast('Failed to update', 'error');
            }
        } catch {
            showToast('Error toggling pin', 'error');
        } finally {
            setToggling(null);
        }
    };

    const handleToggleVisibility = async (event: EventRow) => {
        const id = event.eventId;
        setToggling(`vis_${id}`);
        try {
            const res = await toggleBetfairEventVisibility(id, !event.isVisible);
            if (res.success) {
                setEvents(prev => prev.map(e => e.eventId === id ? { ...e, isVisible: !e.isVisible } : e));
                showToast(!event.isVisible ? 'Event is now visible' : 'Event hidden', 'success');
            } else {
                showToast('Failed to update', 'error');
            }
        } catch {
            showToast('Error toggling visibility', 'error');
        } finally {
            setToggling(null);
        }
    };

    // Client-side filters
    const filtered = events.filter(e => {
        const matchSearch = !search ||
            e.eventName.toLowerCase().includes(search.toLowerCase()) ||
            e.competitionName.toLowerCase().includes(search.toLowerCase());
        if (!matchSearch) return false;
        if (statusFilter === 'POPULAR')  return popularIds.has(String(e.eventId));
        if (statusFilter === 'HOME')     return homeIds.has(String(e.eventId));
        if (statusFilter === 'PINNED')   return !!e.isPinned;
        if (statusFilter === 'LIVE')     return e.inplay || e.status === 'LIVE';
        if (statusFilter === 'HIDDEN')   return !e.isVisible;
        return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    return (
        <div className="space-y-5 pb-8 relative">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl border text-sm font-medium animate-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-200' : 'bg-red-900/90 border-red-500/40 text-red-200'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <Link href="/dashboard/sports" className="text-xs text-slate-500 hover:text-slate-300 mb-1 block">← Back to Sports</Link>
                    <h1 className="text-3xl font-bold text-white">Sportradar Events</h1>
                    <p className="text-slate-400 mt-1 text-sm">
                        <span className="text-white font-semibold">{filtered.length}</span> events &nbsp;·&nbsp;
                        <span className="text-amber-400 font-semibold">⭐ {popularIds.size} popular</span>&nbsp;·&nbsp;
                        <span className="text-emerald-400 font-semibold">🏠 {homeIds.size} on home</span>&nbsp;·&nbsp;
                        <span className="text-red-400 font-semibold">🔴 {events.filter(e => e.inplay).length} live</span>
                    </p>
                </div>
                <button onClick={fetchAll} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50 sm:w-auto">
                    <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {/* Sport Filter Pills */}
            <div className="flex flex-wrap gap-2">
                {SPORTS.map(sport => (
                    <button
                        key={sport.id}
                        onClick={() => { setSelectedSportId(sport.id); setPage(1); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${selectedSportId === sport.id
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/50'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'}`}
                    >
                        <span>{sport.emoji}</span>{sport.name}
                    </button>
                ))}
            </div>

            {/* Search + Status Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search by event or competition..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-sm"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {[
                        { id: 'ALL',     label: 'All' },
                        { id: 'LIVE',    label: '🔴 Live' },
                        { id: 'PINNED',  label: '📌 Pinned' },
                        { id: 'POPULAR', label: '⭐ Popular' },
                        { id: 'HOME',    label: '🏠 Home Page' },
                        { id: 'HIDDEN',  label: '👁 Hidden' },
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => { setStatusFilter(f.id); setPage(1); }}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${statusFilter === f.id
                                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-[760px] w-full text-sm text-left">
                        <thead className="bg-slate-900/60 uppercase text-xs text-slate-500 tracking-wider">
                            <tr>
                                <th className="px-4 py-3">Event</th>
                                <th className="px-4 py-3 hidden md:table-cell">Competition</th>
                                <th className="px-4 py-3 hidden lg:table-cell">Date / Status</th>
                                <th className="px-4 py-3 text-center">🖼️ Image</th>
                                <th className="px-4 py-3 text-center">📌 Pin</th>
                                <th className="px-4 py-3 text-center">⭐ Popular</th>
                                <th className="px-4 py-3 text-center">🏠 Home</th>
                                <th className="px-4 py-3 text-right">Visible</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/40">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center">
                                        <Loader2 className="animate-spin text-indigo-400 inline mb-3" size={32} />
                                        <p className="text-slate-500 text-sm">Loading Sportradar events...</p>
                                    </td>
                                </tr>
                            ) : paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-slate-500">
                                        <Trophy size={40} className="mx-auto mb-3 opacity-20" />
                                        <p>No events found. Try a different sport or check the Sportradar sync.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginated.map(event => {
                                    const id = event.eventId;
                                    const isPopular = popularIds.has(id);
                                    const isHome    = homeIds.has(id);
                                    const isLive    = event.inplay || event.status === 'LIVE';
                                    const isPinned  = !!event.isPinned;
                                    const pinBusy   = toggling === `pin_${id}`;
                                    const popBusy   = toggling === `pop_${id}`;
                                    const homeBusy  = toggling === `home_${id}`;
                                    const visBusy   = toggling === `vis_${id}`;

                                    return (
                                        <tr key={id} className="hover:bg-slate-700/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <p className="text-white font-medium text-sm leading-snug">{event.eventName}</p>
                                                <p className="text-[11px] text-slate-600 mt-0.5 font-mono">{id}</p>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <div className="flex items-center gap-1.5">
                                                    <Trophy size={11} className="text-amber-500/50 flex-shrink-0" />
                                                    <span className="text-slate-400 text-xs">{event.competitionName || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 hidden lg:table-cell">
                                                <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                                                    <Calendar size={10} />
                                                    <span>
                                                        {event.marketStartTime
                                                            ? new Date(event.marketStartTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                                                            : '—'}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${isLive ? 'bg-red-500/15 text-red-400 animate-pulse' : 'bg-slate-700 text-slate-500'}`}>
                                                    {isLive ? 'LIVE' : event.status || 'Upcoming'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <ThumbnailCell eventId={id} thumbnail={event.thumbnail} team1Image={event.team1Image} team2Image={event.team2Image} onUpdate={(data) => {
                                                    setEvents(prev => prev.map(e => e.eventId === id ? { ...e, ...data } : e));
                                                }} />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleTogglePinned(event)}
                                                    disabled={pinBusy}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50 ${isPinned
                                                        ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 hover:bg-sky-500/25'
                                                        : 'bg-slate-700/60 text-slate-500 border border-slate-700 hover:text-sky-400 hover:border-sky-500/30'}`}
                                                >
                                                    {pinBusy ? <Loader2 size={11} className="animate-spin" /> : <Pin size={11} fill={isPinned ? 'currentColor' : 'none'} />}
                                                    <span className="hidden xl:inline">{isPinned ? 'Pinned' : 'Pin'}</span>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleTogglePopular(event)}
                                                    disabled={popBusy}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50 ${isPopular
                                                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                                                        : 'bg-slate-700/60 text-slate-500 border border-slate-700 hover:text-amber-400 hover:border-amber-500/30'}`}
                                                >
                                                    {popBusy ? <Loader2 size={11} className="animate-spin" /> : <Star size={11} fill={isPopular ? 'currentColor' : 'none'} />}
                                                    <span className="hidden xl:inline">{isPopular ? 'Popular' : 'Set'}</span>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleToggleHome(event)}
                                                    disabled={homeBusy}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50 ${isHome
                                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                                        : 'bg-slate-700/60 text-slate-500 border border-slate-700 hover:text-emerald-400 hover:border-emerald-500/30'}`}
                                                >
                                                    {homeBusy ? <Loader2 size={11} className="animate-spin" /> : <Home size={11} fill={isHome ? 'currentColor' : 'none'} />}
                                                    <span className="hidden xl:inline">{isHome ? 'On Home' : 'Add'}</span>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleToggleVisibility(event)}
                                                    disabled={visBusy}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50 ${event.isVisible
                                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                                        : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'}`}
                                                >
                                                    {visBusy ? <Loader2 size={11} className="animate-spin" /> : event.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                                    {event.isVisible ? 'Visible' : 'Hidden'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && filtered.length > PER_PAGE && (
                    <div className="flex flex-col gap-3 border-t border-slate-700 p-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs">
                            Showing {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 hover:bg-slate-700 rounded disabled:opacity-30">
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-white font-medium text-sm px-2">{page} / {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 hover:bg-slate-700 rounded disabled:opacity-30">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
