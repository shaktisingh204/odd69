'use client';

import { useState, useEffect, useRef } from 'react';
import { getTeamIcons, uploadTeamIcon, deleteTeamIcon, getUniqueTeamNames } from '@/actions/team-icons';
import { scrapeTeamIcon, bulkScrapeTeamIcons, scrapeAllLeagues, getAvailableLeagues, type ScrapeResult } from '@/actions/team-icon-scraper';
import { Upload, Trash2, Search, ImageIcon, Loader2, Trophy, CheckCircle, X, Wand2, Zap, Globe, Database, ChevronDown, ChevronUp } from 'lucide-react';

interface TeamIconEntry {
    _id: string;
    team_name: string;
    display_name: string;
    icon_url: string;
    sport_id: string;
}

// Sportradar sport IDs — match backend SORT_ORDER in sportradar.service.ts
const SPORTS = [
    { id: '',              label: 'All Sports' },
    { id: 'sr:sport:21',   label: 'Cricket' },
    { id: 'sr:sport:1',    label: 'Soccer' },
    { id: 'sr:sport:5',    label: 'Tennis' },
    { id: 'sr:sport:2',    label: 'Basketball' },
    { id: 'sr:sport:12',   label: 'Rugby' },
    { id: 'sr:sport:4',    label: 'Ice Hockey' },
    { id: 'sr:sport:3',    label: 'Baseball' },
    { id: 'sr:sport:16',   label: 'American Football' },
    { id: 'sr:sport:138',  label: 'Kabaddi' },
    { id: 'sr:sport:31',   label: 'Badminton' },
    { id: 'sr:sport:20',   label: 'Table Tennis' },
    { id: 'sr:sport:23',   label: 'Volleyball' },
    { id: 'sr:sport:29',   label: 'Futsal' },
    { id: 'sr:sport:19',   label: 'Snooker' },
    { id: 'sr:sport:22',   label: 'Darts' },
    { id: 'sr:sport:117',  label: 'MMA' },
];

export default function TeamIconsPage() {
    const [icons, setIcons] = useState<TeamIconEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
    const [sportId, setSportId] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [teamNames, setTeamNames] = useState<string[]>([]);
    const [teamFilter, setTeamFilter] = useState('');
    const [customTeamName, setCustomTeamName] = useState('');
    const [autoFetching, setAutoFetching] = useState<string | null>(null);
    const [bulkFetching, setBulkFetching] = useState(false);
    const [bulkResults, setBulkResults] = useState<ScrapeResult[] | null>(null);
    const [bulkStats, setBulkStats] = useState<{ fetched: number; existing: number; notFound: number; total: number } | null>(null);
    const [leagueFetching, setLeagueFetching] = useState(false);
    const [leagueResults, setLeagueResults] = useState<ScrapeResult[] | null>(null);
    const [leagueStats, setLeagueStats] = useState<{ fetched: number; existing: number; failed: number; total: number } | null>(null);
    const [selectedLeagues, setSelectedLeagues] = useState<Set<string>>(new Set());
    const [showLeaguePanel, setShowLeaguePanel] = useState(false);
    const [leagues, setLeagues] = useState<{ id: string; name: string; sport: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const flash = (type: 'ok' | 'err', text: string) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 3000);
    };

    const iconMap = new Map(icons.map(i => [i.team_name, i]));

    const fetchIcons = async () => {
        setLoading(true);
        const res = await getTeamIcons();
        if (res.success) setIcons(res.data || []);
        else flash('err', res.error || 'Failed to load');
        setLoading(false);
    };

    const fetchTeamNames = async () => {
        const res = await getUniqueTeamNames();
        if (res.success && res.data) setTeamNames(res.data);
    };

    useEffect(() => {
        fetchIcons();
        fetchTeamNames();
        getAvailableLeagues().then(setLeagues);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] || null;
        setFile(f);
        if (f) {
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(f);
        } else {
            setPreview(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedTeam) return flash('err', 'Select a team first');
        if (!file) return flash('err', 'Select an icon file');

        setUploading(true);
        const form = new FormData();
        form.append('file', file);
        form.append('teamName', selectedTeam);
        form.append('sportId', sportId);

        const res = await uploadTeamIcon(form);
        if (res.success) {
            flash('ok', `Icon uploaded for "${selectedTeam}"`);
            setSelectedTeam(null);
            setSportId('');
            setFile(null);
            setPreview(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchIcons();
        } else {
            flash('err', res.error || 'Upload failed');
        }
        setUploading(false);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete icon for "${name}"?`)) return;
        const res = await deleteTeamIcon(id);
        if (res.success) {
            flash('ok', 'Deleted');
            setIcons(prev => prev.filter(i => i._id !== id));
        } else {
            flash('err', res.error || 'Delete failed');
        }
    };

    // ─── Multi-source auto-fetch ──────────────────────────────────────────
    const handleAutoFetch = async (name: string) => {
        setAutoFetching(name);
        const res = await scrapeTeamIcon(name);
        if (res.success) {
            flash('ok', res.alreadyExists
                ? `"${name}" already has an icon`
                : `Fetched icon for "${name}" via ${res.source}`
            );
            fetchIcons();
        } else {
            flash('err', res.error || `No icon found for "${name}"`);
        }
        setAutoFetching(null);
    };

    const handleBulkScrape = async () => {
        if (!confirm(`Auto-scrape icons for ${teamsWithoutIcon.length} teams from 5 sources (TheSportsDB, ESPN, Sofascore, Wikipedia, Flashscore)? This may take several minutes.`)) return;
        setBulkFetching(true);
        setBulkResults(null);
        setBulkStats(null);

        const res = await bulkScrapeTeamIcons(teamsWithoutIcon);
        if (res.success) {
            setBulkResults(res.results);
            setBulkStats(res.stats);
            flash('ok', `Done! ${res.stats.fetched} fetched, ${res.stats.notFound} not found`);
            fetchIcons();
            fetchTeamNames();
        } else {
            flash('err', 'Bulk scrape failed');
        }
        setBulkFetching(false);
    };

    const handleLeagueScrape = async () => {
        const ids = Array.from(selectedLeagues);
        const count = ids.length || leagues.length;
        if (!confirm(`Fetch all team icons from ${count} leagues via TheSportsDB? This will take a while (~2s per league).`)) return;
        setLeagueFetching(true);
        setLeagueResults(null);
        setLeagueStats(null);

        const res = await scrapeAllLeagues(ids.length ? ids : undefined);
        if (res.success) {
            setLeagueResults(res.results);
            setLeagueStats(res.stats);
            flash('ok', `Leagues done! ${res.stats.fetched} new icons, ${res.stats.existing} already existed`);
            fetchIcons();
        } else {
            flash('err', 'League scrape failed');
        }
        setLeagueFetching(false);
    };

    const toggleLeague = (id: string) => {
        setSelectedLeagues(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const filteredTeams = teamNames.filter(t =>
        t.toLowerCase().includes(teamFilter.toLowerCase())
    );

    const teamsWithoutIcon = filteredTeams.filter(t => !iconMap.has(t.toLowerCase()));
    const teamsWithIcon = filteredTeams.filter(t => iconMap.has(t.toLowerCase()));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Trophy size={24} className="text-violet-400" />
                        Team Icons
                    </h1>
                    <p className="text-sm text-white/40 mt-1">
                        Select a team → choose icon → upload
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-400/60 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                        {icons.length} uploaded
                    </span>
                    <span className="text-xs font-bold text-white/30 bg-white/5 px-2.5 py-1 rounded-lg">
                        {teamNames.length} teams
                    </span>
                </div>
            </div>

            {/* Flash message */}
            {msg && (
                <div className={`rounded-xl px-4 py-2.5 text-sm font-medium ${msg.type === 'ok' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                    {msg.text}
                </div>
            )}

            {/* Selected team upload bar */}
            {selectedTeam && (
                <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-bold text-violet-300">Uploading icon for:</span>
                        <span className="bg-violet-600/30 text-white font-bold text-sm px-3 py-1 rounded-lg">
                            {selectedTeam}
                        </span>
                        <button onClick={() => { setSelectedTeam(null); setFile(null); setPreview(null); }}
                            className="ml-auto text-white/30 hover:text-white/60">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="flex items-end gap-3">
                        {/* Sport */}
                        <div className="w-40">
                            <label className="text-xs text-white/40 font-medium block mb-1">Sport (optional)</label>
                            <select
                                value={sportId}
                                onChange={e => setSportId(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                            >
                                {SPORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                        </div>

                        {/* File */}
                        <div className="flex-1">
                            <label className="text-xs text-white/40 font-medium block mb-1">Icon File *</label>
                            <div className="flex items-center gap-2">
                                {preview && (
                                    <img src={preview} alt="preview" className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0" />
                                )}
                                <label className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 border-dashed rounded-xl px-3 py-2 cursor-pointer hover:border-violet-500/40 transition-colors">
                                    <ImageIcon size={14} className="text-white/30" />
                                    <span className="text-sm text-white/40 truncate">{file ? file.name : 'Choose file…'}</span>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Upload */}
                        <button
                            onClick={handleUpload}
                            disabled={uploading || !file}
                            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/40 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
                        >
                            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            {uploading ? 'Uploading…' : 'Upload'}
                        </button>
                    </div>
                </div>
            )}

            {/* Custom team name input — always available, not tied to live events */}
            <div className="bg-[#13151a] border border-white/[0.06] rounded-2xl p-5">
                <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">
                    Upload for a Custom Team Name
                </h2>
                <p className="text-xs text-white/30 mb-3">
                    Type any team name to assign an icon. Use this when the team
                    is not currently listed below (e.g. a new team, or a team
                    not yet in any live/upcoming event).
                </p>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={customTeamName}
                        onChange={(e) => setCustomTeamName(e.target.value)}
                        placeholder="e.g. Mumbai Indians, Manchester United…"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && customTeamName.trim()) {
                                setSelectedTeam(customTeamName.trim());
                                setCustomTeamName('');
                            }
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => {
                            if (customTeamName.trim()) {
                                setSelectedTeam(customTeamName.trim());
                                setCustomTeamName('');
                            }
                        }}
                        disabled={!customTeamName.trim()}
                        className="bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/30 disabled:cursor-not-allowed text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors"
                    >
                        Use This Name
                    </button>
                </div>
            </div>

            {/* ─── Multi-Source Scraper ─────────────────────────────────── */}
            <div className="bg-[#13151a] border border-violet-500/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Globe size={16} className="text-violet-400" />
                        <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">
                            Multi-Source Icon Scraper
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400/70">TheSportsDB</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400/70">ESPN</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400/70">Sofascore</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400/70">Wikipedia</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400/70">Flashscore</span>
                    </div>
                </div>
                <p className="text-xs text-white/30">
                    Searches 5 sources in order. Downloads badge → uploads to Cloudflare → saves to DB.
                    Click <Wand2 size={10} className="inline text-violet-400" /> next to any team, or use the buttons below for bulk operations.
                </p>

                {/* Bulk scrape for live event teams */}
                {teamsWithoutIcon.length > 0 && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleBulkScrape}
                            disabled={bulkFetching}
                            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/40 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors"
                        >
                            {bulkFetching ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                            {bulkFetching ? 'Scraping…' : `Scrape Missing (${teamsWithoutIcon.length} teams)`}
                        </button>
                        <span className="text-[10px] text-white/25">Searches all 5 sources for each missing team</span>
                    </div>
                )}

                {/* Bulk scrape results */}
                {bulkResults && bulkStats && (
                    <div className="space-y-2">
                        <div className="flex gap-3 text-[10px]">
                            <span className="text-emerald-400">{bulkStats.fetched} fetched</span>
                            <span className="text-blue-400">{bulkStats.existing} existed</span>
                            <span className="text-white/30">{bulkStats.notFound} not found</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                            {bulkResults.map((r, i) => (
                                <span key={i} className={`text-[10px] px-2 py-0.5 rounded-md ${
                                    r.status === 'ok' ? 'bg-emerald-500/15 text-emerald-400' :
                                    r.status === 'exists' ? 'bg-blue-500/15 text-blue-400' :
                                    'bg-white/5 text-white/30'
                                }`}>
                                    {r.name}{r.source ? ` (${r.source})` : ''}: {r.status === 'ok' ? '✓' : r.status === 'exists' ? '=' : '✗'}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── League Bulk Fetch ─────────────────────────────────── */}
                <div className="border-t border-white/[0.06] pt-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Database size={14} className="text-amber-400" />
                            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
                                Bulk Fetch by League
                            </span>
                            <span className="text-[10px] text-white/25">({leagues.length} leagues, ~1000+ teams)</span>
                        </div>
                        <button
                            onClick={() => setShowLeaguePanel(p => !p)}
                            className="text-white/30 hover:text-white/60"
                        >
                            {showLeaguePanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>

                    {showLeaguePanel && (
                        <div className="space-y-3">
                            <p className="text-[10px] text-white/25">
                                Fetches every team from selected leagues on TheSportsDB. Select specific leagues or leave empty for all.
                            </p>

                            {/* League selector grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                {leagues.map(l => (
                                    <button
                                        key={l.id}
                                        onClick={() => toggleLeague(l.id)}
                                        className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                                            selectedLeagues.has(l.id)
                                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:border-amber-500/20'
                                        }`}
                                    >
                                        <span className="block truncate">{l.name}</span>
                                        <span className="text-[9px] text-white/20">{l.sport}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleLeagueScrape}
                                    disabled={leagueFetching}
                                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/40 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors"
                                >
                                    {leagueFetching ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                                    {leagueFetching ? 'Fetching leagues…' : selectedLeagues.size > 0 ? `Fetch ${selectedLeagues.size} Leagues` : `Fetch All ${leagues.length} Leagues`}
                                </button>
                                {selectedLeagues.size > 0 && (
                                    <button
                                        onClick={() => setSelectedLeagues(new Set())}
                                        className="text-[10px] text-white/30 hover:text-white/60 underline"
                                    >
                                        Clear selection
                                    </button>
                                )}
                            </div>

                            {/* League results */}
                            {leagueStats && (
                                <div className="space-y-2">
                                    <div className="flex gap-3 text-[10px]">
                                        <span className="text-emerald-400">{leagueStats.fetched} new</span>
                                        <span className="text-blue-400">{leagueStats.existing} existed</span>
                                        <span className="text-red-400/50">{leagueStats.failed} failed</span>
                                        <span className="text-white/25">{leagueStats.total} total</span>
                                    </div>
                                    {leagueResults && (
                                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                            {leagueResults.filter(r => r.status === 'ok').map((r, i) => (
                                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400">
                                                    {r.name} ✓
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Team list from Redis */}
            <div className="bg-[#13151a] border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">
                        Teams from Live Events
                    </h2>
                    <div className="relative w-64">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
                        <input
                            type="text"
                            value={teamFilter}
                            onChange={e => setTeamFilter(e.target.value)}
                            placeholder="Filter teams…"
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
                        />
                    </div>
                </div>

                {teamNames.length === 0 ? (
                    <div className="text-center py-8 text-white/20 text-sm">Loading teams from events…</div>
                ) : (
                    <>
                        {/* Teams needing icons */}
                        {teamsWithoutIcon.length > 0 && (
                            <div className="mb-4">
                                <p className="text-[10px] text-amber-400/60 font-bold uppercase tracking-wider mb-2">
                                    ⚠ No Icon ({teamsWithoutIcon.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                    {teamsWithoutIcon.map(name => (
                                        <div key={name} className="flex items-center gap-0.5">
                                            <button
                                                onClick={() => setSelectedTeam(name)}
                                                className={`px-2.5 py-1.5 rounded-l-lg text-xs font-medium transition-all ${
                                                    selectedTeam === name
                                                        ? 'bg-violet-500/25 text-violet-300 border border-violet-500/40 ring-1 ring-violet-500/20'
                                                        : 'bg-white/[0.03] text-white/50 border border-white/[0.06] hover:border-amber-500/30 hover:text-white/70'
                                                }`}
                                            >
                                                {name}
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleAutoFetch(name); }}
                                                disabled={autoFetching === name}
                                                title="Auto-fetch from TheSportsDB"
                                                className="px-1.5 py-1.5 rounded-r-lg bg-violet-600/20 border border-violet-500/20 text-violet-400 hover:bg-violet-600/40 hover:text-violet-300 disabled:opacity-50 transition-all"
                                            >
                                                {autoFetching === name ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Teams with icons */}
                        {teamsWithIcon.length > 0 && (
                            <div>
                                <p className="text-[10px] text-emerald-400/60 font-bold uppercase tracking-wider mb-2">
                                    ✓ Has Icon ({teamsWithIcon.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                    {teamsWithIcon.map(name => {
                                        const entry = iconMap.get(name.toLowerCase());
                                        return (
                                            <button
                                                key={name}
                                                onClick={() => setSelectedTeam(name)}
                                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                    selectedTeam === name
                                                        ? 'bg-violet-500/25 text-violet-300 border border-violet-500/40'
                                                        : 'bg-emerald-500/5 text-emerald-400/70 border border-emerald-500/15 hover:border-emerald-500/30'
                                                }`}
                                            >
                                                {entry?.icon_url && (
                                                    <img src={entry.icon_url} alt="" className="w-4 h-4 rounded object-contain" />
                                                )}
                                                <CheckCircle size={10} className="text-emerald-400/50" />
                                                {name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Uploaded Icons Grid */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">All Uploaded Icons</h2>
                    <div className="relative w-56">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search icons…"
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 animate-pulse">
                                <div className="w-16 h-16 mx-auto rounded-xl bg-white/5 mb-3" />
                                <div className="h-3 w-20 bg-white/5 rounded mx-auto" />
                            </div>
                        ))}
                    </div>
                ) : icons.filter(i => i.display_name.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
                    <div className="text-center py-12 text-white/20">
                        <ImageIcon size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No icons uploaded yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {icons.filter(i => i.display_name.toLowerCase().includes(search.toLowerCase())).map(icon => (
                            <div
                                key={icon._id}
                                className="group relative bg-[#13151a] border border-white/[0.06] rounded-xl p-4 hover:border-violet-500/20 transition-all"
                            >
                                <button
                                    onClick={() => handleDelete(icon._id, icon.display_name)}
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-red-500/20 hover:bg-red-500/40 text-red-400 p-1.5 rounded-lg transition-all"
                                >
                                    <Trash2 size={12} />
                                </button>
                                <div className="w-16 h-16 mx-auto rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mb-3">
                                    <img
                                        src={icon.icon_url}
                                        alt={icon.display_name}
                                        className="w-full h-full object-contain p-1"
                                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                </div>
                                <p className="text-xs text-white/70 font-semibold text-center truncate">{icon.display_name}</p>
                                {icon.sport_id && (
                                    <p className="text-[10px] text-white/25 text-center mt-0.5">
                                        {SPORTS.find(s => s.id === icon.sport_id)?.label || `Sport ${icon.sport_id}`}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
