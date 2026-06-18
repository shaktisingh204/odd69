"use client";

import React, { useState } from 'react';
import { Loader2, Search, Star, User } from 'lucide-react';
import { searchFantasyPlayers, getFantasyPlayerProfile } from '@/actions/fantasy';

export default function FantasyPlayersPage() {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<any | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

    const handleSearch = async () => {
        if (!q.trim()) return;
        setLoading(true);
        setSelected(null);
        const res = await searchFantasyPlayers(q.trim());
        setLoading(false);
        if (res.success) {
            const payload = res.data as any;
            // Backend returns EntitySport shape — try common containers
            const list = payload?.response?.items || payload?.data || payload?.players || payload?.response || [];
            setResults(Array.isArray(list) ? list : []);
        } else {
            setResults([]);
        }
    };

    const handlePick = async (p: any) => {
        const id = p.pid || p.player_id || p.id || p.playerId;
        if (!id) return;
        setProfileLoading(true);
        const res = await getFantasyPlayerProfile(Number(id));
        setProfileLoading(false);
        if (res.success) setSelected(res.data);
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-4">

            <div>
                <h1 className="text-xl font-black text-white">Fantasy Players</h1>
                <p className="text-sm text-white/40 mt-0.5">Search player profiles from the roster.</p>
            </div>

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input value={q} onChange={e => setQ(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Search by player name (e.g. Virat Kohli)"
                        className="w-full bg-bg-elevated text-white text-sm font-medium rounded-xl border border-white/10 pl-9 pr-3 py-2 outline-none focus:border-brand-gold/50 placeholder:text-white/25" />
                </div>
                <button onClick={handleSearch} disabled={loading}
                    className="flex items-center gap-1.5 bg-brand-gold text-bg-base px-4 py-2 rounded-xl font-black text-sm hover:bg-brand-gold/90 disabled:opacity-50">
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    Search
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Results list */}
                <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-4 min-h-[240px]">
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-2">
                        Results ({results.length})
                    </h2>
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 size={20} className="animate-spin text-brand-gold" />
                        </div>
                    ) : results.length === 0 ? (
                        <p className="text-[12px] text-white/25 py-6 text-center">Type a name and press Enter.</p>
                    ) : (
                        <div className="space-y-1 max-h-[420px] overflow-y-auto">
                            {results.map((p, i) => {
                                const id = p.pid || p.player_id || p.id || p.playerId;
                                return (
                                    <button key={`${id}-${i}`} onClick={() => handlePick(p)}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.04] text-left">
                                        <div className="h-8 w-8 rounded-full bg-white/5 text-white/40 flex items-center justify-center flex-shrink-0">
                                            <User size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{p.title || p.name || p.short_name}</p>
                                            <p className="text-[10px] text-white/40 truncate">
                                                {p.playing_role || p.role} {p.nationality ? `• ${p.nationality}` : ''}
                                            </p>
                                        </div>
                                        <span className="text-[10px] text-white/30 font-mono">#{id}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Detail pane */}
                <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated p-4 min-h-[240px]">
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-2">Player profile</h2>
                    {profileLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 size={20} className="animate-spin text-brand-gold" />
                        </div>
                    ) : !selected ? (
                        <p className="text-[12px] text-white/25 py-6 text-center">Pick a player to see details.</p>
                    ) : (
                        <pre className="text-[10px] text-white/60 overflow-auto max-h-[420px] font-mono whitespace-pre-wrap">
{JSON.stringify(selected, null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
}
