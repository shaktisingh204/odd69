'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Search, X, PlayCircle, Coffee, Dice5, Gamepad2,
    Tv, Layers, House, ChevronRight, Users, Play
} from 'lucide-react';
import { casinoService } from '@/services/casino';
import GameGrid from '@/components/casino/GameGrid';
import ProviderLogo from '@/components/casino/ProviderLogo';
import PromoCardSlider from '@/components/home/PromoCardSlider';

const LIVE_CATEGORIES = [
    { key: 'all',         label: 'Lobby',      Icon: House },
    { key: 'providers',   label: 'Providers',  Icon: Layers },
    { key: 'blackjack',   label: 'Blackjack',  Icon: Dice5 },
    { key: 'roulette',    label: 'Roulette',   Icon: PlayCircle },
    { key: 'baccarat',    label: 'Baccarat',   Icon: Coffee },
    { key: 'game_shows',  label: 'Game Shows', Icon: Tv },
    { key: 'poker',       label: 'Poker',      Icon: Gamepad2 },
];

const LIVE_SECTIONS = [
    { title: 'Popular Live',  icon: <PlayCircle size={14} className="text-danger"    />, category: 'popular',   sectionKey: 'live' },
    { title: 'Live Roulette', icon: <PlayCircle size={14} className="text-warning" />, category: 'roulette',  sectionKey: 'roulette' },
    { title: 'Live Blackjack',icon: <Dice5      size={14} className="text-brand-gold"   />, category: 'blackjack', sectionKey: 'blackjack' },
    { title: 'Live Baccarat', icon: <Coffee     size={14} className="text-accent-purple" />, category: 'baccarat',  sectionKey: 'baccarat' },
    { title: 'Game Shows',    icon: <Tv         size={14} className="text-pink-400"   />, category: 'game_shows',sectionKey: 'shows' },
    { title: 'Live Poker',    icon: <Gamepad2   size={14} className="text-teal-400"   />, category: 'poker',     sectionKey: 'poker' },
];

interface LiveCasinoMobileViewProps {
    onLaunch: (game: any) => void;
}

export default function LiveCasinoMobileView({ onLaunch }: LiveCasinoMobileViewProps) {
    const [activeCat, setActiveCat]       = useState('all');
    const [search, setSearch]             = useState('');
    const [searchInput, setSearchInput]   = useState('');
    const [providers, setProviders]       = useState<any[]>([]);
    const [providersLoading, setProvidersLoading] = useState(false);
    const [activeProvider, setActiveProvider] = useState<string | null>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const handleSearchChange = (val: string) => {
        setSearchInput(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setSearch(val), 350);
    };
    const clearSearch = () => { setSearchInput(''); setSearch(''); };

    useEffect(() => {
        if (activeCat === 'providers' && providers.length === 0) {
            setProvidersLoading(true);
            casinoService.getProviders('live')
                .then(data => setProviders(Array.isArray(data) ? data.filter(Boolean) : []))
                .catch(() => {})
                .finally(() => setProvidersLoading(false));
        }
    }, [activeCat, providers.length]);

    const handleCatSelect = (key: string) => { setActiveCat(key); setActiveProvider(null); clearSearch(); };
    const handleProviderClick = (code: string) => { setActiveProvider(code); setActiveCat('all'); clearSearch(); };

    const isSearching = !!search.trim();

    return (
        <div className="flex flex-col bg-bg-base min-h-full pb-24">


            <div className="px-3 mt-3 sticky top-0 z-10 pb-2 bg-bg-base">
                <div className={`flex items-center gap-3 bg-bg-elevated px-4 py-3 rounded-2xl border transition-colors ${searchInput ? 'border-red-400/50' : 'border-white/[0.06]'}`}>
                    <Search size={16} className={`flex-shrink-0 transition-colors ${searchInput ? 'text-danger' : 'text-white/30'}`} />
                    <input
                        type="text"
                        placeholder="Search live games…"
                        value={searchInput}
                        onChange={e => handleSearchChange(e.target.value)}
                        className="flex-1 bg-transparent text-white text-[13px] font-semibold outline-none placeholder:text-white/30"
                    />
                    {searchInput && (
                        <button onClick={clearSearch} className="p-1 rounded-lg bg-white/[0.04] text-white/40">
                            <X size={13} />
                        </button>
                    )}
                </div>
            </div>


            {activeProvider && !isSearching && (
                <div className="px-3 mt-2 flex items-center gap-2">
                    <button onClick={() => { setActiveProvider(null); setActiveCat('providers'); }} className="flex items-center gap-1 text-[11px] text-danger font-bold">
                        <Layers size={12} /> Providers <ChevronRight size={11} className="text-white/30" />
                    </button>
                    <span className="text-[11px] text-white/60 font-bold">{activeProvider}</span>
                </div>
            )}

            {/* Main content */}
            <div className="mt-4 px-1">
                {isSearching ? (
                    <div className="px-2">
                        <GameGrid title={`Results for "${search}"`} category="all" search={search} layout="grid" onLaunch={onLaunch} type="live" />
                    </div>
                ) : activeCat === 'providers' && !activeProvider ? (
                    <div className="px-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3 px-1">Live Providers</p>
                        <div className="grid grid-cols-3 gap-2">
                            {providersLoading
                                ? Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-white/[0.04] animate-pulse" />)
                                : providers.map((p, idx) => {
                                    const code = p.providerCode || p.provider || p.code || '';
                                    const name = p.name || code;
                                    return (
                                        <button key={code || idx} onClick={() => handleProviderClick(code)}
                                            className="flex h-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-bg-elevated px-3 transition-all active:scale-95 hover:border-red-400/40">
                                            <ProviderLogo provider={{ image: p.image, provider: code, code }} alt={name}
                                                className="max-h-8 w-auto max-w-[90px] object-contain"
                                                fallbackClassName="text-[10px] font-black text-white/60"
                                                fallbackText={name} />
                                        </button>
                                    );
                                })
                            }
                        </div>
                    </div>
                ) : activeCat !== 'all' || activeProvider ? (
                    <div className="px-2">
                        <GameGrid
                            title={activeProvider ? `${activeProvider} Live` : (LIVE_CATEGORIES.find(c => c.key === activeCat)?.label || 'Live Games')}
                            category={activeCat === 'all' ? 'all' : activeCat}
                            provider={activeProvider || undefined}
                            layout="grid" onLaunch={onLaunch} type="live"
                        />
                    </div>
                ) : (
                    <div className="space-y-5">
                        {LIVE_SECTIONS.map(section => (
                            <GameGrid
                                key={section.sectionKey}
                                title={section.title}
                                icon={section.icon}
                                sectionKey={section.sectionKey}
                                category={section.category}
                                layout="row"
                                onViewAll={() => handleCatSelect(section.category)}
                                onLaunch={onLaunch}
                                type="live"
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
