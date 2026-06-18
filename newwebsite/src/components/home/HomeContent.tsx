"use client";

import React, { useState, useEffect } from 'react';
import HomeHero from './HomeHero';
import RecentWinsTicker from './RecentWinsTicker';
import CategoryGrid from './CategoryGrid';
import HomeGameList from './HomeGameList';
import ZeeroOriginalsSection from './ZeeroOriginalsSection';
import { Flame, Star, Zap, Trophy, Crown, TrendingUp } from 'lucide-react';
import { casinoService } from '@/services/casino';

export default function HomeContent() {
    const [exclusiveGames, setExclusiveGames] = useState<any[]>([]);
    const [popularGames, setPopularGames] = useState<any[]>([]);
    const [topGames, setTopGames] = useState<any[]>([]);
    const [slotGames, setSlotGames] = useState<any[]>([]);
    const [liveGames, setLiveGames] = useState<any[]>([]);

    useEffect(() => {
        const fetchGames = async () => {
            try {
                // ── Home page 3 sections (admin-curated) ────────────────────────
                const [excl, pop, top, slots, live] = await Promise.allSettled([
                    casinoService.getSectionGames('exclusive'),
                    casinoService.getSectionGames('home'),
                    casinoService.getSectionGames('top'),
                    casinoService.getGames(undefined, 'slots', undefined, 1, 6),
                    casinoService.getGames(undefined, 'live', undefined, 1, 6),
                ]);

                // Section 1 — Exclusive Games
                const exclGames = excl.status === 'fulfilled' ? excl.value : [];
                if (exclGames.length > 0) {
                    setExclusiveGames(exclGames.slice(0, 6));
                }

                // Section 2 — Popular Games (home section, fallback to popular category)
                const popGames = pop.status === 'fulfilled' ? pop.value : [];
                if (popGames.length > 0) {
                    setPopularGames(popGames.slice(0, 6));
                } else {
                    const popRes = await casinoService.getGames(undefined, 'popular', undefined, 1, 6);
                    if (popRes.games) setPopularGames(popRes.games.slice(0, 6));
                }

                // Section 3 — Top Games
                const topG = top.status === 'fulfilled' ? top.value : [];
                if (topG.length > 0) {
                    setTopGames(topG.slice(0, 6));
                } else {
                    // Fallback: use high-playCount games
                    const topRes = await casinoService.getGames(undefined, 'popular', undefined, 1, 6);
                    if (topRes.games) setTopGames(topRes.games.slice(0, 6));
                }

                // Slots & Live rows
                if (slots.status === 'fulfilled' && slots.value.games)
                    setSlotGames(slots.value.games.slice(0, 6));
                if (live.status === 'fulfilled' && live.value.games)
                    setLiveGames(live.value.games.slice(0, 6));
            } catch (e) {
                console.error("Failed to load home games", e);
            }
        };
        fetchGames();
    }, []);

    return (
        <main className="flex-1 bg-bg-base pt-[60px] md:pt-[64px] min-h-screen pb-20 w-full max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8">
            <HomeHero />
            <RecentWinsTicker />
            <CategoryGrid />

            {/* Zeero Originals — in-house games section */}
            <ZeeroOriginalsSection />


            {/* Section 1 — Exclusive Games */}
            {exclusiveGames.length > 0 && (
                <HomeGameList
                    title="Exclusive Games"
                    games={exclusiveGames}
                    icon={<Crown size={20} className="text-pink-400" fill="currentColor" />}
                />
            )}

            {/* Section 2 — Popular Games */}
            {popularGames.length > 0 && (
                <HomeGameList
                    title="Popular Games"
                    games={popularGames}
                    icon={<Star size={20} className="text-brand-gold" fill="currentColor" />}
                />
            )}

            {/* Section 3 — Top Games */}
            {topGames.length > 0 && (
                <HomeGameList
                    title="Top Games"
                    games={topGames}
                    icon={<Trophy size={20} className="text-warning-bright" fill="currentColor" />}
                />
            )}

            {/* Bonus rows — Slots & Live */}
            {slotGames.length > 0 && (
                <HomeGameList
                    title="Top Slots"
                    games={slotGames}
                    icon={<Flame size={20} className="text-danger" fill="currentColor" />}
                />
            )}

            {liveGames.length > 0 && (
                <div className="bg-bg-elevated/40 p-6 -mx-6 md:-mx-8 rounded-3xl mt-12 mb-8">
                    <HomeGameList
                        title="Live Casino"
                        games={liveGames}
                        icon={<Zap size={20} className="text-jackpot" fill="currentColor" />}
                    />
                </div>
            )}
        </main>
    );
}
