"use client";

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Gamepad2, Flame, Dice5, House, Fish, Tickets, CircleDot, Drama, Trophy, ChevronRight, Star, Layers, Sparkles, Rocket, Target } from 'lucide-react';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import GameGrid from '@/components/casino/GameGrid';
import GamePlayInterface from '@/components/casino/GamePlayInterface';
import CasinoMobileView from '@/components/casino/CasinoMobileView';
import { casinoService } from '@/services/casino';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/context/WalletContext';
import MaintenanceState from '@/components/maintenance/MaintenanceState';
import { useSectionMaintenance } from '@/hooks/useSectionMaintenance';
import { getCasinoWalletModeFromSubWallet } from '@/utils/casinoWalletMode';
import PromoCardSlider from '@/components/home/PromoCardSlider';
import CasinoBrowserModal from '@/components/casino/CasinoBrowserModal';
import DynamicHeroSlider from '@/components/shared/DynamicHeroSlider';


interface LaunchableGame {
    id?: string;
    name?: string;
    gameName?: string;
    provider?: string;
    providerCode?: string;
    gameCode?: string;
    url?: string;
}

const CASINO_RAIL = [
    { key: 'all', label: 'Lobby', Icon: House },
    { key: 'providers', label: 'Providers', Icon: Layers },
    { key: 'popular', label: 'Hot Games', Icon: Flame },
    { key: 'slots', label: 'Slots', Icon: Tickets },
    { key: 'live', label: 'Live Casino', Icon: Star },
    { key: 'table', label: 'Table Games', Icon: Dice5 },
    { key: 'crash', label: 'Crash', Icon: Rocket },
    { key: 'new', label: 'New Games', Icon: Sparkles },
    { key: 'top-slots', label: 'Top Slots', Icon: Target },
    { key: 'fishing', label: 'Fishing', Icon: Fish },
    { key: 'blackjack', label: 'Blackjack', Icon: Drama },
    { key: 'roulette', label: 'Roulette', Icon: CircleDot },
    { key: 'baccarat', label: 'Baccarat', Icon: Trophy },
];

function CasinoContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const categoryParam = searchParams.get('category');
    const providerParam = searchParams.get('provider') || 'all';
    const selectedCategory = categoryParam || 'all';

    const { user } = useAuth();
    const { selectedSubWallet } = useWallet();
    const { blocked, loading: maintenanceLoading, message: maintenanceMessage } = useSectionMaintenance(
        'casino',
        'Casino is currently under maintenance. Game launches are temporarily unavailable.',
    );
    const [activeGame, setActiveGame] = useState<{ id: string; name: string; provider: string; url: string } | null>(null);
    const [launching, setLaunching] = useState(false);
    const [launchError, setLaunchError] = useState<string | null>(null);

    // Browser Modal State
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const [browserInitialCat, setBrowserInitialCat] = useState('all');
    const [browserInitialSearch, setBrowserInitialSearch] = useState('');


    // Sections shown as horizontal rows on the casino lobby
    const sectionConfigs = useMemo(() => ([
        { title: 'Hot Games', category: 'popular', icon: <Flame size={15} className="text-rose-400" /> },
        { title: 'Slots', category: 'slots', icon: <Dice5 size={15} className="text-brand-gold" /> },
        { title: 'Live Casino', category: 'live', icon: <CircleDot size={15} className="text-red-400" /> },
        { title: 'Table Games', category: 'table', icon: <Layers size={15} className="text-violet-400" /> },
        { title: 'Crash', category: 'crash', icon: <Rocket size={15} className="text-orange-400" /> },
        { title: 'New Games', category: 'new', icon: <Sparkles size={15} className="text-teal-400" /> },
        { title: 'Top Slots', category: 'top-slots', icon: <Star size={15} className="text-amber-400" /> },
    ]), []);

    // Auto-open browser modal when URL has a category param — must be before early returns
    useEffect(() => {
        if (categoryParam && categoryParam !== 'all') {
            setBrowserInitialCat(categoryParam);
            setBrowserInitialSearch('');
            setIsBrowserOpen(true);
        } else if (!categoryParam) {
            setIsBrowserOpen(false);
        }
    }, [categoryParam]);

    if (maintenanceLoading) {
        return <div className="min-h-screen bg-bg-base flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-gold" /></div>;
    }

    if (blocked) {
        return (
            <div className="h-screen overflow-hidden bg-bg-base flex flex-col">
                <Header />
                <div className="pt-[58px]">
                    <MaintenanceState title="Casino Maintenance" message={maintenanceMessage} backHref="/" backLabel="Back to Home" />
                </div>
            </div>
        );
    }

    const toActiveGame = (g: LaunchableGame, url: string) => ({
        id: g.id || g.gameCode || '',
        name: g.name || g.gameName || '',
        provider: g.providerCode || g.provider || '',
        url,
    });

    const handleCategoryClick = (cat: string) => {
        if (cat === 'all') {
            router.push('/casino');
            return;
        }
        router.push(`/casino?category=${cat}`);
    };

    const handleSearchClick = () => {
        setBrowserInitialCat('all');
        setIsBrowserOpen(true);
    };

    const handleGameLaunch = async (gameData: LaunchableGame) => {
        if (gameData.url) { setActiveGame(toActiveGame(gameData, gameData.url)); setLaunchError(null); return; }
        if (!user) { alert('Please login to play'); return; }
        const providerCode = gameData.providerCode || gameData.provider;
        const gameId = gameData.gameCode || gameData.id;
        if (!providerCode || !gameId) { setLaunchError('Game data is incomplete.'); return; }
        setLaunching(true); setLaunchError(null);
        try {
            const res = await casinoService.launchGame({
                username: user.username, provider: providerCode, gameId, isLobby: false,
                walletMode: getCasinoWalletModeFromSubWallet(selectedSubWallet),
            });
            if (res?.url) setActiveGame(toActiveGame(gameData, res.url));
            else setLaunchError('Could not get game URL.');
        } catch (error: unknown) {
            setLaunchError(error instanceof Error ? error.message : 'Failed to launch game.');
        } finally { setLaunching(false); }
    };

    return (
        <div className="h-screen overflow-hidden bg-bg-base flex flex-col">
            <Header />

            {/* Launching overlay */}
            {launching && (
                <div className="fixed inset-0 z-[600] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-3">
                    <div className="relative w-14 h-14">
                        <div className="w-14 h-14 rounded-full border-2 border-brand-gold/20 border-t-brand-gold animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center text-xl">🎰</div>
                    </div>
                    <p className="text-white/50 text-xs font-bold tracking-widest uppercase animate-pulse">Launching…</p>
                </div>
            )}

            {/* Error overlay */}
            {launchError && (
                <div className="fixed inset-0 z-[600] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-4 px-6">
                    <div className="w-14 h-14 rounded-2xl bg-danger-alpha-10 border border-danger/20 flex items-center justify-center text-2xl">⚠️</div>
                    <div className="text-center">
                        <h2 className="text-white font-bold text-base mb-1">Unable to Launch</h2>
                        <p className="text-white/40 text-sm">{launchError}</p>
                    </div>
                    <button
                        onClick={() => setLaunchError(null)}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.06] text-white font-bold text-sm active:scale-95 transition-transform"
                    >
                        <X size={14} /> Close
                    </button>
                </div>
            )}

            {/* Game overlay */}
            {activeGame && (
                <div className="fixed inset-0 z-[500] bg-bg-deep flex flex-col">
                    <GamePlayInterface game={activeGame} onClose={() => setActiveGame(null)} isEmbedded={false} onLaunch={handleGameLaunch} key={activeGame.id} />
                </div>
            )}

            <CasinoBrowserModal 
                isOpen={isBrowserOpen}
                onClose={() => {
                    setIsBrowserOpen(false);
                    router.push('/casino');
                }}
                initialCategory={browserInitialCat}
                initialSearch={browserInitialSearch}
                onLaunch={handleGameLaunch}
                categories={CASINO_RAIL}
            />

            <div className="md:hidden flex-1 overflow-y-auto pt-[58px] pb-[72px]">
                <CasinoMobileView
                    onLaunch={handleGameLaunch}
                />
            </div>

            {/* ── DESKTOP ── */}
            <div className="hidden md:flex flex-1 overflow-hidden pt-[58px]">
                {!activeGame && <LeftSidebar />}

                <main className={`flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-bg-base ${!activeGame ? 'border-l border-white/[0.04]' : ''}`}>
                    {activeGame ? (
                        <GamePlayInterface game={activeGame} onClose={() => setActiveGame(null)} isEmbedded={true} onLaunch={handleGameLaunch} key={activeGame.id} />
                    ) : (
                        <div className="p-4 md:p-5 space-y-5 max-w-[1600px] mx-auto">

                            {/* ── Hero banner — admin-controlled from CMS > Sliders ── */}
                            {selectedCategory === 'all' && (
                                <DynamicHeroSlider
                                    page="CASINO"
                                    className="w-full"
                                    onGameLaunch={handleGameLaunch}
                                    fallback={<PromoCardSlider onGameLaunch={handleGameLaunch} />}
                                />
                            )}


                            {/* ── Search bar ── */}
                            <div className="relative cursor-pointer" onClick={handleSearchClick}>
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                                <div className="h-11 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2.5 pl-11 pr-4 text-sm font-medium text-white/30 flex items-center transition-all hover:border-brand-gold/30 hover:bg-white/[0.04]">
                                    Search games...
                                </div>
                            </div>

                            {/* ── Category rail ── */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                {CASINO_RAIL.map(({ key, label, Icon }) => {
                                    const active = selectedCategory === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => handleCategoryClick(key)}
                                            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-semibold transition-all border ${
                                                active
                                                    ? 'bg-brand-gold/10 border-brand-gold/25 text-brand-gold'
                                                    : 'bg-white/[0.03] border-white/[0.06] text-white/45 hover:text-white/75 hover:border-white/[0.1] hover:bg-white/[0.05]'
                                            }`}
                                        >
                                            <Icon size={13} className={active ? 'text-brand-gold' : 'text-white/40'} />
                                            {label}
                                        </button>
                                    );
                                })}
                                <button className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/[0.1] transition-all">
                                    <ChevronRight size={15} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                                {sectionConfigs.map((section) => (
                                                    <GameGrid
                                                        key={section.category}
                                                        title={section.title}
                                                        icon={section.icon}
                                                        category={section.category}
                                                        layout="row"
                                                        onViewAll={() => handleCategoryClick(section.category)}
                                                        onLaunch={handleGameLaunch}
                                                    />
                                                ))}
                                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default function CasinoPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-bg-base flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-gold" /></div>}>
            <CasinoContent />
        </Suspense>
    );
}
