"use client";

import React, { useState, useRef, useEffect, Suspense } from 'react';
import {
    Search, X, PlayCircle, Dice5, Coffee, Gamepad2,
    Tv, Layers, ChevronRight
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import GameGrid from '@/components/casino/GameGrid';
import GamePlayInterface from '@/components/casino/GamePlayInterface';
import LiveCasinoMobileView from '@/components/casino/LiveCasinoMobileView';

// ─── Live sections ─────────────────────────────────────────────────────────────
const LIVE_SECTIONS = [
    { title: 'Popular Live',   icon: <PlayCircle size={15} className="text-red-400"      />, category: 'popular',    sectionKey: 'live'      },
    { title: 'Live Roulette',  icon: <PlayCircle size={15} className="text-amber-400"    />, category: 'roulette',   sectionKey: 'roulette'  },
    { title: 'Live Blackjack', icon: <Dice5      size={15} className="text-brand-gold"   />, category: 'blackjack',  sectionKey: 'blackjack' },
    { title: 'Live Baccarat',  icon: <Coffee     size={15} className="text-violet-400"   />, category: 'baccarat',   sectionKey: 'baccarat'  },
    { title: 'Game Shows',     icon: <Tv         size={15} className="text-pink-400"     />, category: 'game_shows', sectionKey: 'shows'     },
    { title: 'Live Poker',     icon: <Gamepad2   size={15} className="text-teal-400"     />, category: 'poker',      sectionKey: 'poker'     },
];

const LIVE_CATS = [
    { key: 'all',        label: 'All Games'  },
    { key: 'roulette',   label: 'Roulette'   },
    { key: 'blackjack',  label: 'Blackjack'  },
    { key: 'baccarat',   label: 'Baccarat'   },
    { key: 'game_shows', label: 'Game Shows' },
    { key: 'poker',      label: 'Poker'      },
];

function LiveDealersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const categoryParam = searchParams.get('category');

    const [activeCat, setActiveCat]       = useState(categoryParam || 'all');
    const [searchInput, setSearchInput]   = useState('');
    const [search, setSearch]             = useState('');
    const [activeGame, setActiveGame]     = useState<{ id: string; name: string; provider: string; url: string } | null>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Sync activeCat with URL param
    useEffect(() => {
        setActiveCat(categoryParam || 'all');
    }, [categoryParam]);

    const handleSearchChange = (val: string) => {
        setSearchInput(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setSearch(val), 350);
    };
    const clearSearch = () => { setSearchInput(''); setSearch(''); };
    const handleCatSelect = (key: string) => {
        clearSearch();
        if (key === 'all') {
            router.push('/live-dealers');
        } else {
            router.push(`/live-dealers?category=${key}`);
        }
    };
    const handleGameLaunch = (gameData: any) => setActiveGame(gameData);

    const isSearching = !!search.trim();
    const showLobby   = !isSearching && activeCat === 'all';

    return (
        <div className="h-screen overflow-hidden bg-bg-base flex flex-col">
            <Header />

            {/* ── MOBILE ─────────────────────────────────────────────────── */}
            <div className="md:hidden flex-1 overflow-y-auto pt-[70px] pb-[80px]">
                {activeGame ? (
                    <div className="h-full bg-bg-base">
                        <GamePlayInterface
                            game={activeGame}
                            onClose={() => setActiveGame(null)}
                            isEmbedded
                            onLaunch={handleGameLaunch}
                            key={activeGame.id}
                        />
                    </div>
                ) : (
                    <LiveCasinoMobileView onLaunch={handleGameLaunch} />
                )}
            </div>

            {/* ── DESKTOP ────────────────────────────────────────────────── */}
            <div className="hidden md:flex flex-1 overflow-hidden pt-[60px] md:pt-[64px] max-w-[1920px] mx-auto w-full">
                <LeftSidebar />

                <main className="flex-1 min-w-0 border-l border-white/[0.04] border-r border-white/[0.04] bg-bg-base overflow-y-auto overflow-x-hidden">
                    {activeGame ? (
                        <div className="h-full bg-bg-base">
                            <GamePlayInterface
                                game={activeGame}
                                onClose={() => setActiveGame(null)}
                                isEmbedded
                                onLaunch={handleGameLaunch}
                                key={activeGame.id}
                            />
                        </div>
                    ) : (
                        <div className="p-4 md:p-5 space-y-5">

                            {/* ── Search bar ── */}
                            <div className={`flex items-center gap-3 bg-bg-elevated px-4 py-3 rounded-2xl border transition-colors ${searchInput ? 'border-red-400/50' : 'border-white/[0.06]'}`}>
                                <Search size={16} className={`flex-shrink-0 transition-colors ${searchInput ? 'text-danger' : 'text-white/30'}`} />
                                <input
                                    type="text"
                                    placeholder="Search live games…"
                                    value={searchInput}
                                    onChange={e => handleSearchChange(e.target.value)}
                                    className="flex-1 bg-transparent text-white text-sm font-semibold outline-none placeholder:text-white/30"
                                />
                                {searchInput && (
                                    <button onClick={clearSearch} className="p-1 rounded-lg bg-white/[0.04] text-white/40 hover:text-white/70 transition-colors">
                                        <X size={13} />
                                    </button>
                                )}
                            </div>

                            {/* ── Category pills ── */}
                            {!isSearching && (
                                <div className="flex gap-2 flex-wrap">
                                    {LIVE_CATS.map(({ key, label }) => {
                                        const active = activeCat === key;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => handleCatSelect(key)}
                                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-black tracking-wide transition-all ${
                                                    active
                                                        ? 'bg-danger-alpha-10 border-red-400/40 text-danger'
                                                        : 'bg-bg-elevated border-white/[0.06] text-white/50 hover:text-white hover:border-white/[0.1]'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ── Content ── */}
                            {isSearching ? (
                                <GameGrid
                                    title={`Results for "${search}"`}
                                    category="all"
                                    search={search}
                                    layout="grid"
                                    onLaunch={handleGameLaunch}
                                    type="live"
                                />
                            ) : showLobby ? (
                                <div className="space-y-6">
                                    {LIVE_SECTIONS.map(section => (
                                        <GameGrid
                                            key={section.sectionKey}
                                            title={section.title}
                                            icon={section.icon}
                                            sectionKey={section.sectionKey}
                                            category={section.category}
                                            layout="row"
                                            onViewAll={() => handleCatSelect(section.category)}
                                            onLaunch={handleGameLaunch}
                                            type="live"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <GameGrid
                                    title={LIVE_CATS.find(c => c.key === activeCat)?.label || 'Live Games'}
                                    category={activeCat}
                                    layout="grid"
                                    onLaunch={handleGameLaunch}
                                    type="live"
                                />
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default function LiveDealersPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-bg-base flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold" />
            </div>
        }>
            <LiveDealersContent />
        </Suspense>
    );
}
