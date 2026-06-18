"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
    getSports, getAllCompetitions,
    toggleSportVisibility, toggleCompetitionEvents,
} from '@/actions/sports';
import {
    Search, ChevronDown, ChevronRight,
    Eye, EyeOff, Trophy, Medal, Loader2, RefreshCcw,
    ToggleLeft, ToggleRight, Layers, LayoutTemplate
} from 'lucide-react';
import Link from 'next/link';

// ── Sportradar sport emoji map ──────────────────────────────────────────────
const SPORT_EMOJI: Record<string, string> = {
    'sr:sport:21':  '🏏', // Cricket
    'sr:sport:1':   '⚽', // Soccer
    'sr:sport:5':   '🎾', // Tennis
    'sr:sport:2':   '🏀', // Basketball
    'sr:sport:12':  '🏉', // Rugby
    'sr:sport:4':   '🏒', // Ice Hockey
    'sr:sport:3':   '⚾', // Baseball
    'sr:sport:16':  '🏈', // American Football
    'sr:sport:138': '🤼', // Kabaddi
    'sr:sport:31':  '🏸', // Badminton
    'sr:sport:20':  '🏓', // Table Tennis
    'sr:sport:23':  '🏐', // Volleyball
    'sr:sport:29':  '⚽', // Futsal
    'sr:sport:19':  '🎱', // Snooker
    'sr:sport:22':  '🎯', // Darts
    'sr:sport:117': '🥊', // MMA
};

type Sport = {
    _id: string;
    sportId: string;
    name: string;
    isActive: boolean;
    isTab: boolean;
    isDefault: boolean;
    sortOrder: number;
};

type Competition = {
    _id: string;
    competitionId: string;
    competitionName: string;
    sportId: string;
    eventCount: number;
    liveCount: number;
};

type Toast = { msg: string; type: 'success' | 'error' };

export default function SportsbookPage() {
    const [sports, setSports] = useState<Sport[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSport, setExpandedSport] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [toggling, setToggling] = useState<string | null>(null);
    const [toast, setToast] = useState<Toast | null>(null);

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [sportsRes, compsRes] = await Promise.all([
                getSports(),
                getAllCompetitions(),
            ]);
            if (sportsRes.success) setSports(sportsRes.data as Sport[]);
            if (compsRes.success) setCompetitions(compsRes.data as Competition[]);
        } catch (error) {
            console.error('Failed to fetch sports data', error);
            showToast('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleToggleSport = async (sportId: string, current: boolean, e: React.MouseEvent) => {
        e.stopPropagation();
        setToggling(`sport_${sportId}`);
        try {
            const res = await toggleSportVisibility(sportId, !current);
            if (res.success) {
                setSports(prev => prev.map(s =>
                    s.sportId === sportId ? { ...s, isActive: !current } : s
                ));
                showToast(!current ? 'Sport enabled' : 'Sport disabled', 'success');
            } else {
                showToast('Failed to update sport', 'error');
            }
        } catch {
            showToast('Error updating sport', 'error');
        } finally {
            setToggling(null);
        }
    };

    const handleToggleCompetition = async (competitionId: string, currentVisible: boolean, e: React.MouseEvent) => {
        e.stopPropagation();
        setToggling(`comp_${competitionId}`);
        try {
            const res = await toggleCompetitionEvents(competitionId, !currentVisible);
            if (res.success) {
                showToast(!currentVisible ? 'Competition events shown' : 'Competition events hidden', 'success');
            } else {
                showToast('Failed to update competition', 'error');
            }
        } catch {
            showToast('Error updating competition', 'error');
        } finally {
            setToggling(null);
        }
    };

    const filteredSports = sports.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 relative">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl border text-sm font-medium animate-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-200' : 'bg-red-900/90 border-red-500/40 text-red-200'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Sportsbook Management</h1>
                    <p className="text-slate-400 mt-1 text-sm">
                        Manage Sportradar sports and competitions.&nbsp;
                        <span className="text-amber-400 font-semibold">{sports.length} sports</span>
                        &nbsp;·&nbsp;
                        <span className="text-indigo-400 font-semibold">{competitions.length} competitions</span>
                        &nbsp;·&nbsp;
                        <span className="text-emerald-400 font-semibold">
                            {sports.filter(s => s.isActive).length} active
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard/sports/live-builder"
                        className="flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-4 py-2 text-sm text-indigo-300 hover:bg-indigo-500/25 transition-colors font-medium"
                    >
                        <LayoutTemplate size={14} /> Live Builder
                    </Link>
                    <Link
                        href="/dashboard/sports/events"
                        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                        <Trophy size={14} /> Manage Events
                    </Link>
                    <Link
                        href="/dashboard/sports/leagues"
                        className="flex items-center gap-2 rounded-lg border border-indigo-700/50 bg-indigo-900/30 px-4 py-2 text-sm text-indigo-300 hover:bg-indigo-900/60 transition-colors"
                    >
                        <Layers size={14} /> Leagues &amp; Images
                    </Link>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search sports..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-indigo-400" size={32} />
                    <p className="ml-3 text-slate-400">Loading Sportradar sports…</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredSports.map(sport => {
                        const sportComps = competitions.filter(c => c.sportId === sport.sportId);
                        const isExpanded = expandedSport === sport.sportId;
                        const emoji = SPORT_EMOJI[sport.sportId] || '🏟️';

                        return (
                            <div key={sport.sportId} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                                <div
                                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-700/50 transition-colors"
                                    onClick={() => setExpandedSport(isExpanded ? null : sport.sportId)}
                                >
                                    <div className="flex items-center gap-3">
                                        <button className="p-1 rounded hover:bg-slate-600 text-slate-400">
                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </button>
                                        <span className="text-xl">{emoji}</span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-white">{sport.name}</h3>
                                                {sport.isDefault && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full font-bold">DEFAULT</span>
                                                )}
                                                {sport.isTab && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full font-bold">TAB</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {sportComps.length} competitions
                                                {sportComps.some(c => c.liveCount > 0) && (
                                                    <span className="ml-1 text-red-400">
                                                        · 🔴 {sportComps.reduce((a, c) => a + c.liveCount, 0)} live
                                                    </span>
                                                )}
                                                &nbsp;· <span className="text-slate-600 font-mono text-[10px]">{sport.sportId}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/dashboard/sports/events?sportId=${encodeURIComponent(sport.sportId)}`}
                                            className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline px-3 py-1"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            Events
                                        </Link>
                                        <button
                                            onClick={(e) => handleToggleSport(sport.sportId, sport.isActive, e)}
                                            disabled={toggling === `sport_${sport.sportId}`}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${sport.isActive
                                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                                : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}
                                        >
                                            {toggling === `sport_${sport.sportId}`
                                                ? <Loader2 size={12} className="animate-spin" />
                                                : sport.isActive
                                                    ? <><ToggleRight size={14} /> Active</>
                                                    : <><ToggleLeft size={14} /> Disabled</>}
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-slate-700 bg-slate-900/30 p-3 space-y-1.5">
                                        {sportComps.length === 0 ? (
                                            <p className="text-slate-500 text-sm text-center py-3">
                                                No competitions found. Events may still be syncing.
                                            </p>
                                        ) : (
                                            sportComps.map(comp => (
                                                <div
                                                    key={comp.competitionId}
                                                    className="flex items-center justify-between p-2.5 bg-slate-800 border border-slate-700/50 rounded hover:bg-slate-700/30 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <Medal size={13} className="text-slate-500 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-slate-200 text-sm font-medium leading-snug">{comp.competitionName}</p>
                                                            <p className="text-xs text-slate-500">
                                                                {comp.eventCount} events
                                                                {comp.liveCount > 0 && (
                                                                    <span className="text-red-400 ml-1 animate-pulse">· 🔴 {comp.liveCount} live</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleToggleCompetition(comp.competitionId, true, e)}
                                                        disabled={!!toggling}
                                                        className="p-1.5 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-red-400 disabled:opacity-50"
                                                        title="Hide all events in this competition"
                                                    >
                                                        {toggling === `comp_${comp.competitionId}`
                                                            ? <Loader2 size={14} className="animate-spin" />
                                                            : <EyeOff size={14} />}
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {filteredSports.length === 0 && !loading && (
                        <div className="text-center py-16 text-slate-500">
                            <Trophy size={40} className="mx-auto mb-3 opacity-20" />
                            <p>No sports found. Check the Sportradar sync to populate data.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
