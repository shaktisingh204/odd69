"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    getSportLeagues,
    updateLeagueImage,
    updateLeagueVisibility,
    updateLeagueOrder,
    seedLeaguesFromBackend,
} from '@/actions/sports';
import { scrapeLeagueIcon, bulkScrapeLeagueIcons } from '@/actions/team-icon-scraper';
import {
    Image as ImageIcon, Eye, EyeOff, RefreshCcw, Loader2,
    GripVertical, CheckCircle2, Layers,
    Zap, Save, ChevronLeft, Globe, Wand2
} from 'lucide-react';
import Link from 'next/link';

// ── Sportradar sport emoji ─────────────────────────────────────────────────
const SPORT_EMOJI: Record<string, string> = {
    'sr:sport:21':  '🏏',
    'sr:sport:1':   '⚽',
    'sr:sport:5':   '🎾',
    'sr:sport:2':   '🏀',
    'sr:sport:12':  '🏉',
    'sr:sport:4':   '🏒',
    'sr:sport:138': '🤼',
    'sr:sport:31':  '🏸',
    'sr:sport:20':  '🏓',
    'sr:sport:23':  '🏐',
};

type League = {
    _id: string;
    competitionId: string;
    competitionName: string;
    sportId: string;
    sportName: string;
    imageUrl: string;
    isVisible: boolean;
    order: number;
    eventCount: number;
    liveCount: number;
};

type Toast = { msg: string; type: 'success' | 'error' };

export default function LeaguesPage() {
    const [leagues, setLeagues] = useState<League[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);
    const [toast, setToast] = useState<Toast | null>(null);
    const [search, setSearch] = useState('');
    const [editingImage, setEditingImage] = useState<Record<string, string>>({});
    const [scrapingOne, setScrapingOne] = useState<string | null>(null);
    const [bulkScraping, setBulkScraping] = useState(false);
    const [scrapeResults, setScrapeResults] = useState<{ competitionName: string; status: string; source?: string }[] | null>(null);
    const [scrapeStats, setScrapeStats] = useState<{ fetched: number; existing: number; notFound: number; total: number } | null>(null);
    const dragItem = useRef<number | null>(null);
    const dragOver = useRef<number | null>(null);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchLeagues = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getSportLeagues();
            if (res.success) {
                setLeagues(res.data as League[]);
                // Prefill image editing state
                const imgMap: Record<string, string> = {};
                (res.data as League[]).forEach(l => { imgMap[l.competitionId] = l.imageUrl; });
                setEditingImage(imgMap);
            } else {
                showToast('Failed to load leagues', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLeagues(); }, [fetchLeagues]);

    const handleSeedLeagues = async () => {
        setSeeding(true);
        try {
            const res = await seedLeaguesFromBackend();
            if (res.success) {
                showToast(`✅ Seeded ${res.seeded ?? 0} leagues from Redis cache`, 'success');
                await fetchLeagues();
            } else {
                showToast(res.error || 'Seed failed', 'error');
            }
        } catch {
            showToast('Seed request failed', 'error');
        } finally {
            setSeeding(false);
        }
    };

    const handleToggleVisibility = async (league: League) => {
        const next = !league.isVisible;
        setLeagues(prev => prev.map(l => l.competitionId === league.competitionId ? { ...l, isVisible: next } : l));
        const res = await updateLeagueVisibility(league.competitionId, next);
        if (!res.success) {
            setLeagues(prev => prev.map(l => l.competitionId === league.competitionId ? { ...l, isVisible: league.isVisible } : l));
            showToast('Failed to toggle visibility', 'error');
        } else {
            showToast(next ? 'League shown in slider' : 'League hidden from slider', 'success');
        }
    };

    const handleSaveImage = async (competitionId: string) => {
        const imageUrl = editingImage[competitionId] ?? '';
        setSaving(competitionId);
        try {
            const res = await updateLeagueImage(competitionId, imageUrl);
            if (res.success) {
                setLeagues(prev => prev.map(l => l.competitionId === competitionId ? { ...l, imageUrl } : l));
                showToast('Image saved', 'success');
            } else {
                showToast('Failed to save image', 'error');
            }
        } finally {
            setSaving(null);
        }
    };

    // ── Drag-and-drop reorder ───────────────────────────────────────────────

    const handleDragStart = (index: number) => { dragItem.current = index; };
    const handleDragEnter = (index: number) => { dragOver.current = index; };
    const handleDragEnd = async () => {
        const from = dragItem.current;
        const to = dragOver.current;
        if (from === null || to === null || from === to) return;

        const reordered = [...leagues];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);
        setLeagues(reordered);

        dragItem.current = null;
        dragOver.current = null;

        const orderedIds = reordered.map(l => l.competitionId);
        const res = await updateLeagueOrder(orderedIds);
        if (!res.success) showToast('Failed to save order', 'error');
    };

    // ── Auto-scrape league icons ──────────────────────────────────────────
    const handleScrapeOne = async (league: League) => {
        setScrapingOne(league.competitionId);
        const res = await scrapeLeagueIcon(league.competitionId, league.competitionName);
        if (res.success) {
            showToast(
                res.alreadyExists
                    ? `"${league.competitionName}" already has an image`
                    : `Fetched logo for "${league.competitionName}" via ${res.source}`,
                'success'
            );
            await fetchLeagues();
        } else {
            showToast(res.error || `No logo found for "${league.competitionName}"`, 'error');
        }
        setScrapingOne(null);
    };

    const handleBulkScrape = async () => {
        const noImage = leagues.filter(l => !l.imageUrl).length;
        if (!confirm(`Auto-scrape logos for ${noImage} leagues without images from TheSportsDB, ESPN, Sofascore, and Wikipedia?`)) return;
        setBulkScraping(true);
        setScrapeResults(null);
        setScrapeStats(null);

        const res = await bulkScrapeLeagueIcons();
        if (res.success) {
            setScrapeResults(res.results);
            setScrapeStats(res.stats);
            showToast(`Done! ${res.stats.fetched} logos fetched, ${res.stats.notFound} not found`, 'success');
            await fetchLeagues();
        } else {
            showToast('Bulk scrape failed', 'error');
        }
        setBulkScraping(false);
    };

    const leaguesWithoutImage = leagues.filter(l => !l.imageUrl).length;

    const filtered = leagues.filter(l =>
        !search ||
        l.competitionName.toLowerCase().includes(search.toLowerCase()) ||
        l.sportName.toLowerCase().includes(search.toLowerCase())
    );

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
                    <Link href="/dashboard/sports" className="text-xs text-slate-500 hover:text-slate-300 mb-1 flex items-center gap-1">
                        <ChevronLeft size={12} /> Back to Sports
                    </Link>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Layers className="text-indigo-400" size={28} />
                        League Image Management
                    </h1>
                    <p className="text-slate-400 mt-1 text-sm">
                        <span className="text-white font-semibold">{leagues.length}</span> leagues &nbsp;·&nbsp;
                        <span className="text-emerald-400 font-semibold">{leagues.filter(l => l.isVisible).length} visible</span>&nbsp;·&nbsp;
                        <span className="text-indigo-400 font-semibold">{leagues.filter(l => l.imageUrl).length} with images</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSeedLeagues}
                        disabled={seeding}
                        className="flex items-center gap-2 rounded-lg border border-amber-700/50 bg-amber-900/30 px-4 py-2 text-sm text-amber-300 hover:bg-amber-900/60 disabled:opacity-50 transition-colors"
                    >
                        <Zap size={14} className={seeding ? 'animate-pulse' : ''} />
                        {seeding ? 'Seeding…' : 'Seed Leagues from Redis'}
                    </button>
                    <button
                        onClick={fetchLeagues}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                    type="text"
                    placeholder="Search leagues or sports..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Info banner */}
            <div className="bg-indigo-900/20 border border-indigo-700/30 rounded-xl p-4 text-sm text-indigo-300">
                <p className="font-semibold mb-1">💡 How it works</p>
                <ul className="text-indigo-300/80 space-y-0.5 text-xs">
                    <li>• Click <strong>Seed Leagues from Redis</strong> to populate this list from the live sports cache.</li>
                    <li>• Paste an image URL for each league — it will appear in the frontend league slider.</li>
                    <li>• Drag rows to reorder. Toggle visibility to show/hide in the slider.</li>
                </ul>
            </div>

            {/* Auto-scrape section */}
            <div className="bg-slate-800/60 border border-indigo-700/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Globe size={16} className="text-indigo-400" />
                        <span className="text-sm font-bold text-slate-300">Auto-Scrape League Logos</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400/70">TheSportsDB</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400/70">ESPN</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400/70">Sofascore</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400/70">Wikipedia</span>
                    </div>
                    {leaguesWithoutImage > 0 && (
                        <button
                            onClick={handleBulkScrape}
                            disabled={bulkScraping}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors"
                        >
                            {bulkScraping ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                            {bulkScraping ? 'Scraping…' : `Scrape All Missing (${leaguesWithoutImage})`}
                        </button>
                    )}
                </div>
                <p className="text-xs text-slate-500">
                    Searches 4 sources for each league logo, downloads to Cloudflare, and saves the URL.
                    Use the <Wand2 size={10} className="inline text-indigo-400" /> button on each row, or bulk scrape all missing.
                </p>
                {scrapeStats && (
                    <div className="space-y-2">
                        <div className="flex gap-3 text-[10px]">
                            <span className="text-emerald-400">{scrapeStats.fetched} fetched</span>
                            <span className="text-blue-400">{scrapeStats.existing} existed</span>
                            <span className="text-slate-500">{scrapeStats.notFound} not found</span>
                        </div>
                        {scrapeResults && (
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600">
                                {scrapeResults.filter(r => r.status === 'ok').map((r, i) => (
                                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400">
                                        {r.competitionName} ({r.source})
                                    </span>
                                ))}
                                {scrapeResults.filter(r => r.status === 'not_found').map((r, i) => (
                                    <span key={`nf-${i}`} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-700/50 text-slate-500">
                                        {r.competitionName} ✗
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="animate-spin text-indigo-400" size={32} />
                    <p className="ml-3 text-slate-400">Loading Sportradar leagues…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                    <Layers size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">No leagues found</p>
                    <p className="text-sm mt-1">Click "Seed Leagues from Redis" to populate this list.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((league, idx) => {
                        const emoji = SPORT_EMOJI[league.sportId] || '🏟️';
                        const hasImage = !!league.imageUrl;
                        const isSaving = saving === league.competitionId;

                        return (
                            <div
                                key={league.competitionId}
                                draggable
                                onDragStart={() => handleDragStart(idx)}
                                onDragEnter={() => handleDragEnter(idx)}
                                onDragEnd={handleDragEnd}
                                onDragOver={e => e.preventDefault()}
                                className={`bg-slate-800 rounded-xl border transition-all ${league.isVisible ? 'border-slate-700' : 'border-slate-700/40 opacity-60'} hover:border-slate-600`}
                            >
                                <div className="flex items-start gap-4 p-4">
                                    {/* Drag handle */}
                                    <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 mt-1">
                                        <GripVertical size={18} />
                                    </div>

                                    {/* League image preview */}
                                    <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 flex items-center justify-center">
                                        {hasImage ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={league.imageUrl}
                                                alt={league.competitionName}
                                                className="w-full h-full object-cover"
                                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            <span className="text-2xl">{emoji}</span>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-white font-bold text-sm leading-snug">{league.competitionName}</p>
                                                <p className="text-slate-400 text-xs mt-0.5">
                                                    {emoji} {league.sportName}
                                                    {league.liveCount > 0 && (
                                                        <span className="text-red-400 ml-2 animate-pulse">🔴 {league.liveCount} live</span>
                                                    )}
                                                    &nbsp;· {league.eventCount} events
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {/* Visibility toggle */}
                                                <button
                                                    onClick={() => handleToggleVisibility(league)}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all ${league.isVisible
                                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                                        : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'}`}
                                                >
                                                    {league.isVisible ? <><Eye size={11} /> Show</> : <><EyeOff size={11} /> Hidden</>}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Image URL input */}
                                        <div className="flex items-center gap-2 mt-3">
                                            <div className="relative flex-1">
                                                <ImageIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
                                                <input
                                                    type="url"
                                                    placeholder="Paste image URL (https://…)"
                                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                                                    value={editingImage[league.competitionId] ?? ''}
                                                    onChange={e => setEditingImage(prev => ({
                                                        ...prev,
                                                        [league.competitionId]: e.target.value,
                                                    }))}
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleSaveImage(league.competitionId)}
                                                disabled={isSaving}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex-shrink-0"
                                            >
                                                {isSaving
                                                    ? <Loader2 size={12} className="animate-spin" />
                                                    : hasImage
                                                        ? <><CheckCircle2 size={12} /> Update</>
                                                        : <><Save size={12} /> Save</>}
                                            </button>
                                            {!hasImage && (
                                                <button
                                                    onClick={() => handleScrapeOne(league)}
                                                    disabled={scrapingOne === league.competitionId}
                                                    title="Auto-scrape logo from TheSportsDB/ESPN/Sofascore/Wikipedia"
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/20 text-amber-400 hover:bg-amber-600/40 text-xs font-semibold transition-colors disabled:opacity-50 flex-shrink-0"
                                                >
                                                    {scrapingOne === league.competitionId
                                                        ? <Loader2 size={12} className="animate-spin" />
                                                        : <Wand2 size={12} />}
                                                    Auto
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
