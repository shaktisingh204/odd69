"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    getCasinoGames, getCasinoCategories, getCasinoProviders, getCasinoGameStats,
    toggleCasinoGame, toggleCasinoGamePopular, toggleCasinoGameNew,
    toggleSectionGame, getAllSectionGameCodes, clearSection,
    updateCasinoGame
} from '@/actions/casino';
import { uploadCasinoGameImage } from '@/actions/upload';
import {
    Gamepad2, Search, RefreshCcw, Star, Home, Trophy,
    Sparkles, Loader2, ChevronLeft, ChevronRight, X, LayoutGrid, List,
    Zap, Flame, Monitor, BookOpen, Rocket, Check, Trash2, Upload,
    Tv, Coffee, PlayCircle,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
    // ── Home Page sections ──
    { key: 'exclusive',  label: '⭐ Exclusive Games',      icon: Star,       color: 'text-pink-400',    border: 'border-pink-500/30',    bg: 'bg-pink-500/10'    },
    { key: 'home',       label: '🏠 Popular (Home)',       icon: Home,       color: 'text-sky-400',     border: 'border-sky-500/30',     bg: 'bg-sky-500/10'     },
    { key: 'top',        label: '🏆 Top Picks',            icon: Trophy,     color: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10'   },
    // ── Casino Lobby rows ──
    { key: 'popular',    label: '🔥 Hot Games',            icon: Flame,      color: 'text-orange-400',  border: 'border-orange-500/30',  bg: 'bg-orange-500/10'  },
    { key: 'new',        label: '✨ New Arrivals',          icon: Sparkles,   color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
    { key: 'trending',   label: '📈 Trending Now',         icon: Rocket,     color: 'text-fuchsia-400', border: 'border-fuchsia-500/30', bg: 'bg-fuchsia-500/10' },
    { key: 'slots',      label: '🎰 Slots',                icon: Zap,        color: 'text-yellow-400',  border: 'border-yellow-500/30',  bg: 'bg-yellow-500/10'  },
    { key: 'table',      label: '🃏 Table Games',          icon: BookOpen,   color: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/10'    },
    { key: 'crash',      label: '💥 Crash Games',          icon: Rocket,     color: 'text-violet-400',  border: 'border-violet-500/30',  bg: 'bg-violet-500/10'  },
    { key: 'top-slots',  label: '🎯 Top Slots',            icon: Star,       color: 'text-rose-400',    border: 'border-rose-500/30',    bg: 'bg-rose-500/10'    },
    { key: 'fishing',    label: '🐟 Fishing',              icon: Flame,      color: 'text-green-400',   border: 'border-green-500/30',   bg: 'bg-green-500/10'   },
    { key: 'arcade',     label: '🕹️ Arcade',               icon: Gamepad2,   color: 'text-indigo-400',  border: 'border-indigo-500/30',  bg: 'bg-indigo-500/10'  },
    { key: 'virtual',    label: '🏅 Virtual Sports',       icon: Trophy,     color: 'text-cyan-400',    border: 'border-cyan-500/30',    bg: 'bg-cyan-500/10'    },
    // ── Live Casino Groups ──
    { key: 'live',       label: '📡 Live — Popular',       icon: Monitor,    color: 'text-rose-400',    border: 'border-rose-500/30',    bg: 'bg-rose-500/10'    },
    { key: 'roulette',   label: '🎡 Live — Roulette',      icon: PlayCircle, color: 'text-orange-400',  border: 'border-orange-500/30',  bg: 'bg-orange-500/10'  },
    { key: 'blackjack',  label: '🃏 Live — Blackjack',     icon: Zap,        color: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/10'    },
    { key: 'baccarat',   label: '💜 Live — Baccarat',      icon: Coffee,     color: 'text-purple-400',  border: 'border-purple-500/30',  bg: 'bg-purple-500/10'  },
    { key: 'shows',      label: '🎬 Live — Game Shows',    icon: Tv,         color: 'text-pink-400',    border: 'border-pink-500/30',    bg: 'bg-pink-500/10'    },
    { key: 'poker',      label: '🃏 Live — Poker',         icon: Gamepad2,   color: 'text-teal-400',    border: 'border-teal-500/30',    bg: 'bg-teal-500/10'    },
] as const;

type SectionKey = typeof SECTIONS[number]['key'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Game {
    _id: string;
    gameCode: string;
    name: string;
    provider: string;
    category: string;
    icon?: string;
    image?: string;
    banner?: string;
    isActive: boolean;
    isPopular: boolean;
    isNewGame: boolean;
    priority: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CF_BASE = 'https://imagedelivery.net/l7vrHxYm1V8kfxard9QBnQ';

/**
 * Build a Cloudflare Images URL from a game record.
 * icon field is stored as '{provider}/{filename}.ext' (e.g. 'SG/SG 118_ Space Crasher.png')
 * or just '{filename}.ext'. In both cases, encode each segment individually.
 */
function getCFImageUrl(game: Game): string {
    const raw = game.banner || game.image || game.icon || '';
    if (!raw) return '';
    if (raw.startsWith('http')) return raw;  // already a full URL
    const noExt = raw.replace(/\.[^.]+$/, '');
    const iconPath = noExt.includes('/')
        ? noExt.split('/').map(encodeURIComponent).join('/')
        : `${encodeURIComponent(game.provider)}/${encodeURIComponent(noExt)}`;
    return `${CF_BASE}/${iconPath}/public`;
}

function MiniToggle({ on, onChange, color = '#6366f1' }: { on: boolean; onChange: () => void; color?: string }) {
    return (
        <button
            onClick={e => { e.stopPropagation(); onChange(); }}
            className={`relative w-8 h-4.5 rounded-full transition-colors duration-150 flex-shrink-0 ${on ? 'opacity-100' : 'opacity-50'}`}
            style={{ backgroundColor: on ? color : '#334155', outline: 'none' }}
        >
            <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all duration-150 ${on ? 'left-[calc(100%-15px)]' : 'left-0.5'}`} />
        </button>
    );
}

function SpinLoader() {
    return <Loader2 size={10} className="animate-spin text-slate-400" />;
}

// ─── Game Thumbnail Preview (same style as frontend) ─────────────────────────

function GameThumb({ game, size = 'sm', onUploaded }: { game: Game; size?: 'sm' | 'md'; onUploaded?: (url: string, icon: string) => void }) {
    const [err, setErr] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [src, setSrc] = useState(() => getCFImageUrl(game));
    const cls = size === 'sm' ? 'w-10 h-10' : 'w-12 h-16';

    const handleUpload = async (file: File) => {
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('provider', game.provider);
        fd.append('gameCode', game.gameCode);
        fd.append('gameName', game.name);
        try {
            const data = await uploadCasinoGameImage(fd);
            if (data.success && data.cloudflareUrl) {
                setSrc(data.cloudflareUrl);
                setErr(false);
                onUploaded?.(data.cloudflareUrl, data.relativePath);
            }
        } finally { setUploading(false); }
    };

    return (
        <div className={`${cls} rounded-lg overflow-hidden bg-slate-700 flex-shrink-0 flex items-center justify-center relative group/thumb`}>
            {src && !err ? (
                <img src={src} alt={game.name} className="w-full h-full object-cover" onError={() => setErr(true)} />
            ) : (
                <Gamepad2 size={size === 'sm' ? 16 : 20} className="text-slate-500" />
            )}
            {/* Upload overlay */}
            <label className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                {uploading ? <Loader2 size={12} className="animate-spin text-white" /> : <Upload size={12} className="text-white" />}
                <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
            </label>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CasinoGamesPage() {
    // ── State ────────────────────────────────────────────────────────────────
    const [games, setGames] = useState<Game[]>([]);
    const [totalGames, setTotalGames] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const [categories, setCategories] = useState<any[]>([]);
    const [providers, setProviders] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);

    // Section pin state: { sectionKey: Set<gameCode> }
    const [pinned, setPinned] = useState<Record<string, Set<string>>>({});
    const [toggling, setToggling] = useState<Record<string, boolean>>({});

    // Filters
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [filterProvider, setFilterProvider] = useState('ALL');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Active section tab
    const [activeSection, setActiveSection] = useState<SectionKey>('popular');
    const [clearing, setClearing] = useState(false);

    const LIMIT = 48;
    const searchTimer = useRef<NodeJS.Timeout | undefined>(undefined);

    // ── Load ─────────────────────────────────────────────────────────────────

    const loadGames = useCallback(async (pg = 1) => {
        setLoading(true);
        const filters: any = {};
        if (search) filters.search = search;
        if (filterProvider !== 'ALL') filters.provider = filterProvider;
        if (filterCategory !== 'ALL') filters.category = filterCategory;
        try {
            const res = await getCasinoGames(pg, LIMIT, filters);
            if (res.success && res.data) {
                setGames(res.data);
                setTotalPages(res.pagination?.pages || 1);
                setTotalGames(res.pagination?.total || 0);
            }
        } finally { setLoading(false); }
    }, [search, filterProvider, filterCategory]);

    const loadMeta = useCallback(async () => {
        const [cats, prov, st, allPins] = await Promise.all([
            getCasinoCategories(),
            getCasinoProviders(),
            getCasinoGameStats(),
            getAllSectionGameCodes(),
        ]);
        if (cats.success) setCategories(cats.data || []);
        if (prov.success) setProviders(prov.data || []);
        if (st.success && st.data) setStats(st.data);
        // Build pinned sets
        const sets: Record<string, Set<string>> = {};
        Object.entries(allPins).forEach(([sec, codes]) => {
            sets[sec] = new Set(codes);
        });
        setPinned(sets);
    }, []);

    useEffect(() => { loadMeta(); }, [loadMeta]);
    useEffect(() => { setPage(1); }, [search, filterProvider, filterCategory]);
    useEffect(() => { loadGames(page); }, [page, loadGames]);

    const handleSearch = (val: string) => {
        setSearchInput(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setSearch(val), 400);
    };

    // ── Pin / Unpin ───────────────────────────────────────────────────────────

    const isPinned = (section: SectionKey, gameCode: string) =>
        !!(pinned[section]?.has(gameCode));

    const handlePin = async (sec: SectionKey, game: Game) => {
        const key = `${sec}_${game.gameCode}`;
        const currently = isPinned(sec, game.gameCode);
        setToggling(t => ({ ...t, [key]: true }));
        await toggleSectionGame(sec, game.gameCode, !currently, {
            name: game.name, provider: game.provider,
            image: getCFImageUrl(game),
        });
        // Optimistic update
        setPinned(prev => {
            const next = { ...prev };
            const set = new Set(prev[sec] || []);
            if (currently) {
                set.delete(game.gameCode);
            } else {
                set.add(game.gameCode);
            }
            next[sec] = set;
            return next;
        });
        // Update section count in stats
        setStats((s: any) => {
            if (!s) return s;
            const sections = { ...(s.sections || {}) };
            sections[sec] = (sections[sec] || 0) + (currently ? -1 : 1);
            return { ...s, sections };
        });
        setToggling(t => ({ ...t, [key]: false }));
    };

    const handleActive = async (game: Game) => {
        const key = `active_${game._id}`;
        setToggling(t => ({ ...t, [key]: true }));
        await toggleCasinoGame(game._id, !game.isActive);
        setGames(gs => gs.map(g => g._id === game._id ? { ...g, isActive: !g.isActive } : g));
        setToggling(t => ({ ...t, [key]: false }));
    };

    const handlePopular = async (game: Game) => {
        const key = `pop_${game.gameCode}`;
        setToggling(t => ({ ...t, [key]: true }));
        await toggleCasinoGamePopular(game.gameCode, !game.isPopular);
        setGames(gs => gs.map(g => g.gameCode === game.gameCode ? { ...g, isPopular: !g.isPopular } : g));
        setToggling(t => ({ ...t, [key]: false }));
    };

    const handleNew = async (game: Game) => {
        const key = `new_${game.gameCode}`;
        setToggling(t => ({ ...t, [key]: true }));
        await toggleCasinoGameNew(game.gameCode, !game.isNewGame);
        setGames(gs => gs.map(g => g.gameCode === game.gameCode ? { ...g, isNewGame: !g.isNewGame } : g));
        setToggling(t => ({ ...t, [key]: false }));
    };

    const handleClearSection = async () => {
        if (!confirm(`Clear all games from the "${SECTIONS.find(s => s.key === activeSection)?.label}" section?`)) return;
        setClearing(true);
        await clearSection(activeSection);
        setPinned(prev => ({ ...prev, [activeSection]: new Set() }));
        setStats((s: any) => {
            if (!s) return s;
            const sections = { ...(s.sections || {}) };
            sections[activeSection] = 0;
            return { ...s, sections };
        });
        setClearing(false);
    };

    // ── Derived ───────────────────────────────────────────────────────────────

    const activeSecDef = SECTIONS.find(s => s.key === activeSection)!;
    const activePins = pinned[activeSection] || new Set<string>();
    const pinnedCount = stats?.sections?.[activeSection] ?? activePins.size;

    // ── Section Tabs ──────────────────────────────────────────────────────────

    const SectionTabs = () => (
        <div className="flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map(sec => {
                const Icon = sec.icon;
                const cnt = stats?.sections?.[sec.key] ?? (pinned[sec.key]?.size ?? 0);
                const sel = activeSection === sec.key;
                return (
                    <button
                        key={sec.key}
                        onClick={() => setActiveSection(sec.key as SectionKey)}
                        className={`flex min-w-[150px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition-all lg:min-w-0 ${sel
                            ? `${sec.bg} ${sec.border} ${sec.color} border`
                            : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                    >
                        <Icon size={15} className={sel ? sec.color : 'text-slate-500'} />
                        <span className="flex-1">{sec.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${sel ? `${sec.bg} ${sec.color}` : 'bg-slate-800 text-slate-500'}`}>
                            {cnt}
                        </span>
                    </button>
                );
            })}
        </div>
    );

    // ── Game Card (grid view) ─────────────────────────────────────────────────

    const GameCardGrid = ({ game }: { game: Game }) => {
        const pin = isPinned(activeSection, game.gameCode);
        const spinPin = toggling[`${activeSection}_${game.gameCode}`];
        const [src, setSrc] = useState(() => getCFImageUrl(game));
        const [imgErr, setImgErr] = useState(false);
        const [uploading, setUploading] = useState(false);
        const [catg, setCatg] = useState(game.category);
        const isCatSpin = toggling[`cat_${game._id}`];

        const handleCategoryChange = async (newCat: string) => {
            const key = `cat_${game._id}`;
            setToggling(t => ({ ...t, [key]: true }));
            setCatg(newCat);
            await updateCasinoGame(game._id, { category: newCat });
            setToggling(t => ({ ...t, [key]: false }));
        };

        const handleUpload = async (file: File) => {
            setUploading(true);
            const fd = new FormData();
            fd.append('file', file);
            fd.append('provider', game.provider);
            fd.append('gameCode', game.gameCode);
            fd.append('gameName', game.name);
            try {
                const data = await uploadCasinoGameImage(fd);
                if (data.success && data.cloudflareUrl) {
                    setSrc(data.cloudflareUrl);
                    setImgErr(false);
                    // Update game icon in state
                    setGames(gs => gs.map(g => g._id === game._id ? { ...g, icon: data.relativePath } : g));
                }
            } finally { setUploading(false); }
        };

        return (
            <div className={`relative bg-slate-800 border rounded-xl overflow-hidden group transition-all hover:border-slate-500 ${!game.isActive ? 'opacity-50' : 'border-slate-700'}`}>
                {/* Image — same ratio as frontend casino cards */}
                <div className="aspect-[3/4] bg-slate-900 overflow-hidden relative">
                    {src && !imgErr ? (
                        <img src={src} alt={game.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={() => setImgErr(true)}
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <Gamepad2 size={24} className="text-slate-600" />
                            <span className="text-[9px] text-slate-600 text-center px-2 leading-tight">{game.name}</span>
                        </div>
                    )}
                    {/* Upload overlay — shown on hover */}
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity z-10">
                        {uploading
                            ? <Loader2 size={20} className="animate-spin text-white" />
                            : <><Upload size={18} className="text-white" /><span className="text-white text-[9px] font-bold mt-1">Upload</span></>}
                        <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
                    </label>
                </div>

                {/* Pinned indicator */}
                {pin && (
                    <div className={`absolute top-1.5 left-1.5 ${activeSecDef.bg} border ${activeSecDef.border} px-1.5 py-0.5 rounded-md`}>
                        <span className={`text-[9px] font-black ${activeSecDef.color} uppercase`}>{activeSecDef.label}</span>
                    </div>
                )}

                {/* Footer */}
                <div className="p-2 space-y-1.5 flex flex-col justify-between" style={{ minHeight: '110px' }}>
                    <div>
                        <div className="text-[11px] font-bold text-white truncate">{game.name}</div>
                        <div className="text-[9px] text-slate-500 truncate">{game.provider}</div>
                    </div>

                    <div className="relative">
                        {isCatSpin ? <SpinLoader /> : (
                            <select 
                                value={catg || ''}
                                onChange={e => handleCategoryChange(e.target.value)}
                                disabled={isCatSpin}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-1 text-[9px] text-slate-400 outline-none hover:border-slate-500 transition-colors"
                            >
                                <option value="" disabled>Select Category</option>
                                {categories.map((c: any) => (
                                    <option key={c._id} value={c.slug || c.name}>{c.name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Pin to section */}
                    <button
                        onClick={() => !spinPin && handlePin(activeSection, game)}
                        disabled={!!spinPin}
                        className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black transition-all border ${pin
                            ? `${activeSecDef.bg} ${activeSecDef.border} ${activeSecDef.color}`
                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-white'
                            }`}
                    >
                        {spinPin ? <SpinLoader /> : pin ? <Check size={10} /> : <span>+ Add</span>}
                        <span>{pin ? 'Pinned' : activeSecDef.label}</span>
                    </button>
                </div>
            </div>
        );
    };

    // ── Game Row (list view) ──────────────────────────────────────────────────

    const GameRowList = ({ game }: { game: Game }) => {
        const pin = isPinned(activeSection, game.gameCode);
        const spinPin = toggling[`${activeSection}_${game.gameCode}`];
        const spinPop = toggling[`pop_${game.gameCode}`];
        const spinNew = toggling[`new_${game.gameCode}`];
        const spinAct = toggling[`active_${game._id}`];
        const isCatSpin = toggling[`cat_${game._id}`];
        const [catg, setCatg] = useState(game.category);

        const handleCategoryChange = async (newCat: string) => {
            const key = `cat_${game._id}`;
            setToggling(t => ({ ...t, [key]: true }));
            setCatg(newCat);
            await updateCasinoGame(game._id, { category: newCat });
            setToggling(t => ({ ...t, [key]: false }));
        };

        return (
            <tr className={`border-t border-slate-700/50 hover:bg-slate-700/20 transition-colors text-sm ${!game.isActive ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                        <GameThumb game={game} size="sm" />
                        <div>
                            <div className="text-white font-semibold text-xs">{game.name}</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">{game.provider}</div>
                            <div className="mt-1">
                                {isCatSpin ? <SpinLoader /> : (
                                    <select 
                                        value={catg || ''}
                                        onChange={e => handleCategoryChange(e.target.value)}
                                        disabled={isCatSpin}
                                        className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-400 outline-none hover:border-slate-500 transition-colors"
                                    >
                                        <option value="" disabled>Select Category</option>
                                        {categories.map((c: any) => (
                                            <option key={c._id} value={c.slug || c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    </div>
                </td>
                <td className="px-3 py-2.5">
                    <div className="flex gap-2 flex-wrap">
                        {game.isPopular && <span className="text-[9px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded">POPULAR</span>}
                        {game.isNewGame && <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">NEW</span>}
                        {pin && <span className={`text-[9px] font-bold ${activeSecDef.bg} ${activeSecDef.color} border ${activeSecDef.border} px-1.5 py-0.5 rounded`}>{activeSecDef.label.toUpperCase()}</span>}
                    </div>
                </td>
                <td className="px-3 py-2.5">
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer select-none">
                            <MiniToggle on={game.isActive} onChange={() => !spinAct && handleActive(game)} />
                            {spinAct ? <SpinLoader /> : 'Visible'}
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer select-none">
                            <MiniToggle on={game.isPopular} onChange={() => !spinPop && handlePopular(game)} color="#f97316" />
                            {spinPop ? <SpinLoader /> : 'Popular'}
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer select-none">
                            <MiniToggle on={game.isNewGame} onChange={() => !spinNew && handleNew(game)} color="#10b981" />
                            {spinNew ? <SpinLoader /> : 'New'}
                        </label>
                    </div>
                </td>
                <td className="px-3 py-2.5">
                    <button
                        onClick={() => !spinPin && handlePin(activeSection, game)}
                        disabled={!!spinPin}
                        className={`text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all ${pin
                            ? `${activeSecDef.bg} ${activeSecDef.color} ${activeSecDef.border}`
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
                            }`}
                    >
                        {spinPin ? <SpinLoader /> : pin ? '✓ Pinned' : '+ Add'}
                    </button>
                </td>
            </tr>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-black text-white flex items-center gap-2">
                        <Gamepad2 size={22} className="text-indigo-400" /> Casino Games Management
                    </h1>
                    <p className="text-slate-400 text-xs mt-0.5">
                        Curate sections · {stats?.total ?? '—'} total games · {stats?.active ?? '—'} active
                    </p>
                </div>
                <button onClick={() => { loadMeta(); loadGames(page); }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-600 sm:w-auto">
                    <RefreshCcw size={13} /> Refresh
                </button>
            </div>

            {/* Quick stat pills */}
            <div className="flex gap-2 flex-wrap text-xs">
                {[
                    { label: 'Popular', count: stats?.popular, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
                    { label: 'New', count: stats?.newGames, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                    { label: 'Active', count: stats?.active, color: 'text-green-400 bg-green-500/10 border-green-500/20' },
                    { label: 'Total', count: stats?.total, color: 'text-slate-300 bg-slate-700 border-slate-600' },
                ].map(p => (
                    <span key={p.label} className={`px-2.5 py-1 rounded-full border font-bold ${p.color}`}>
                        {p.label}: {p.count ?? '—'}
                    </span>
                ))}
            </div>

            {/* Two-column layout */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

                {/* ── LEFT: Section Tabs ─────────────────────────────────────── */}
                <div className="w-full flex-shrink-0 rounded-2xl border border-slate-700 bg-slate-900 p-2 lg:sticky lg:top-4 lg:w-44">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2 mb-2">Casino Sections</div>
                    <SectionTabs />
                </div>

                {/* ── RIGHT: Games Browser ───────────────────────────────────── */}
                <div className="flex-1 min-w-0 space-y-3">
                    {/* Section header */}
                    <div className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${activeSecDef.bg} ${activeSecDef.border}`}>
                        <div className="flex items-center gap-2">
                            <activeSecDef.icon size={16} className={activeSecDef.color} />
                            <span className={`font-bold text-sm ${activeSecDef.color}`}>{activeSecDef.label}</span>
                            <span className="text-slate-400 text-xs">
                                — {pinnedCount} games pinned. Toggle &quot;Add&quot; to curate this section.
                            </span>
                        </div>
                        {pinnedCount > 0 && (
                            <button
                                onClick={handleClearSection}
                                disabled={clearing}
                                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-400 transition-all hover:text-red-300 sm:w-auto"
                            >
                                {clearing ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                Clear All
                            </button>
                        )}
                    </div>

                    {/* Filter bar */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <div className="relative min-w-0 flex-1 sm:min-w-44">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text" placeholder="Search games..."
                                className="w-full pl-8 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500"
                                value={searchInput}
                                onChange={e => handleSearch(e.target.value)}
                            />
                            {searchInput && (
                                <button onClick={() => { setSearchInput(''); setSearch(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                        <select value={filterProvider} onChange={e => { setFilterProvider(e.target.value); setPage(1); }}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs text-white outline-none focus:border-indigo-500 sm:w-auto">
                            <option value="ALL">All Providers</option>
                            {providers.map((p: any) => <option key={p._id} value={p.providerCode || p.name}>{p.name}</option>)}
                        </select>
                        <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs text-white outline-none focus:border-indigo-500 sm:w-auto">
                            <option value="ALL">All Categories</option>
                            {categories.map((c: any) => <option key={c._id} value={c.slug || c.name}>{c.name}</option>)}
                        </select>
                        <div className="flex items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><LayoutGrid size={14} /></button>
                            <button onClick={() => setViewMode('list')} className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><List size={14} /></button>
                        </div>
                    </div>

                    {/* Games */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="text-center">
                                <Loader2 size={32} className="animate-spin text-indigo-400 mx-auto mb-2" />
                                <p className="text-slate-400 text-sm">Loading games...</p>
                            </div>
                        </div>
                    ) : games.length === 0 ? (
                        <div className="flex items-center justify-center py-20 text-center">
                            <div>
                                <Gamepad2 size={40} className="text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-300 font-bold">No games found</p>
                                <p className="text-slate-500 text-sm mt-1">Try adjusting your filters.</p>
                            </div>
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 2xl:grid-cols-9">
                            {games.map(g => <GameCardGrid key={g._id} game={g} />)}
                        </div>
                    ) : (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-[820px] w-full">
                                    <thead>
                                        <tr className="bg-slate-900/60 border-b border-slate-700">
                                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">Game</th>
                                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">Tags</th>
                                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">Controls</th>
                                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">{activeSecDef.label}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {games.map(g => <GameRowList key={g._id} game={g} />)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex flex-col gap-3 border-t border-slate-700 pt-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-xs text-slate-400">{totalGames} games</span>
                            <div className="flex items-center gap-2">
                                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                    className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
                                    <ChevronLeft size={14} />
                                </button>
                                <span className="text-xs text-white px-1">Page {page} / {totalPages}</span>
                                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                                    className="p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
