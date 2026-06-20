'use client';

import React, { useRef, useState } from 'react';
import { Play, Loader2, X, RefreshCw, Maximize2, Minimize2, ChevronLeft, ChevronRight, Heart, Star } from 'lucide-react';
import { casinoService } from '@/services/casino';
import { useAuth } from '@/context/AuthContext';
import { useModal } from '@/context/ModalContext';
import { useWallet } from '@/context/WalletContext';
import { getCasinoWalletModeFromSubWallet } from '@/utils/casinoWalletMode';
import { cfImage, cfImageSrcSet } from '@/utils/cfImages';

// ─── BC.GAME style card ──────────────────────────────────────────────────────
interface GameCardBCProps {
    game: any;
    onPlay: (game: any) => void;
}

function GameCardBC({ game, onPlay }: GameCardBCProps) {
    const [imgFailed, setImgFailed] = useState(false);
    const [loading, setLoading] = useState(false);
    const imgSrc = game.image || game.banner || '';
    const name = game.name || game.gameName || 'Game';
    const provider = (game.providerSlug || game.provider || game.providerCode || '').toString();

    return (
        <button
            type="button"
            aria-label={`Play ${name}`}
            onClick={() => { setLoading(true); onPlay(game); }}
            className="group relative block w-full cursor-pointer text-left outline-none active:scale-[0.97] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none motion-reduce:active:scale-100"
        >
            {/* Card — v2 tile: aspect-[3/4], rounded-2xl, hairline ring, orange-gradient fallback */}
            <div
                className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-white/[0.06] transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-y-1.5 motion-reduce:transform-none motion-reduce:transition-none"
                style={{ background: 'linear-gradient(160deg,#3a2566,#160c2c)' }}
            >
                {/* Game image — tiles are ~112/132/152px wide, serve 200w/400w responsive variants. */}
                {!imgFailed && imgSrc ? (
                    <img
                        src={cfImage(imgSrc, { width: 400 })}
                        srcSet={cfImageSrcSet(imgSrc, [200, 400, 600])}
                        sizes="(max-width: 640px) 112px, (max-width: 1024px) 132px, 152px"
                        alt={name}
                        onError={() => setImgFailed(true)}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                    />
                ) : (
                    <div className="absolute inset-0 grid place-items-center text-3xl">🎮</div>
                )}

                {/* orange inset ring on hover AND keyboard focus */}
                <div
                    className="absolute inset-0 opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:opacity-100 group-focus-visible:opacity-100"
                    style={{ boxShadow: 'inset 0 0 0 2px rgba(255,122,26,0.85)' }}
                />

                {/* Tag badge */}
                {game.tag && (
                    <div
                        className="absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow"
                        style={{ background: 'linear-gradient(135deg,#ff9a3d,#ff6a00)' }}
                    >
                        {game.tag}
                    </div>
                )}

                {/* Provider badge top-right */}
                {provider && (
                    <div className="absolute right-2 top-2 z-10 rounded-full border border-white/[0.06] bg-black/50 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wider text-white/60 backdrop-blur-md">
                        {provider.slice(0, 6)}
                    </div>
                )}

                {/* label scrim */}
                <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="truncate text-sm font-extrabold uppercase leading-tight text-white drop-shadow">{name}</p>
                    {provider && <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-white/55">{provider}</p>}
                </div>

                {/* hover / focus play (also shows spinner while launching) */}
                <div className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span
                        className="grid h-12 w-12 place-items-center rounded-full text-white shadow-lg"
                        style={{ background: 'linear-gradient(135deg,#ff9a3d,#ff6a00)' }}
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Play className="h-5 w-5" fill="currentColor" strokeWidth={0} />
                        )}
                    </span>
                </div>
            </div>
        </button>
    );
}

// ─── In-page Game Player Overlay ────────────────────────────────────────────
interface GamePlayerProps {
    game: { id: string; name: string; provider: string; url: string };
    onClose: () => void;
}

function GamePlayerOverlay({ game, onClose }: GamePlayerProps) {
    const [iframeKey, setIframeKey] = useState(0);
    const [isFavorite, setIsFavorite] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col animate-in fade-in duration-200">
            {/* Header bar */}
            <div className="flex items-center gap-3 px-4 py-3 bg-bg-deep border-b border-white/[0.04] flex-shrink-0">
                <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-sm truncate">{game.name}</p>
                    <p className="text-text-muted text-[10px] font-bold uppercase">{game.provider}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setIsFavorite(!isFavorite)} className={`p-2 rounded-lg transition-colors ${isFavorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-text-muted hover:text-white bg-white/[0.04]'}`}>
                        <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={() => setIframeKey(k => k + 1)} className="p-2 rounded-lg text-text-muted hover:text-white bg-white/[0.04] transition-colors">
                        <RefreshCw size={16} />
                    </button>
                    <button onClick={toggleFullscreen} className="p-2 rounded-lg text-text-muted hover:text-white bg-white/[0.04] transition-colors hidden md:flex">
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    <button onClick={onClose} className="p-2 rounded-lg text-danger hover:text-white bg-danger-alpha-10 hover:bg-danger-alpha-16 transition-colors">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Game iframe */}
            <div className="flex-1 relative overflow-hidden">
                <iframe
                    key={iframeKey}
                    src={game.url}
                    className="w-full h-full border-0"
                    allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture"
                    sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                />
            </div>
        </div>
    );
}

// ─── Main HomeGameList ───────────────────────────────────────────────────────
interface HomeGameListProps {
    title?: string;
    games: any[];
    icon?: React.ReactNode;
    viewAllHref?: string;
    isLoading?: boolean;
}

export default function HomeGameList({ title, games, icon, viewAllHref, isLoading }: HomeGameListProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [localGames, setLocalGames] = React.useState<any[]>(games);
    const [activeGame, setActiveGame] = useState<{ id: string; name: string; provider: string; url: string } | null>(null);
    const { user } = useAuth();
    const { openLogin } = useModal();
    const { selectedSubWallet } = useWallet();

    React.useEffect(() => { setLocalGames(games); }, [games]);

    // Show shimmer skeleton (v2 tile shape) while parent is loading data
    if (isLoading) {
        return (
            <div>
                {(title || icon) && (
                    <div className="mb-3 flex items-center justify-between px-0.5">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                            {icon ?? <Star className="h-4 w-4 text-[#ff7a1a]" fill="currentColor" strokeWidth={0} />}
                            {title}
                        </h2>
                    </div>
                )}
                <div className="v2-no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div
                            key={i}
                            className="aspect-[3/4] w-[112px] shrink-0 snap-start rounded-2xl skeleton-block sm:w-[132px] lg:w-[152px]"
                        />
                    ))}
                </div>
            </div>
        );
    }

    const scroll = (dir: 'left' | 'right') => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
        }
    };

    const handlePlay = async (game: any) => {
        if (!user) {
            openLogin();
            return;
        }
        try {
            const gameId = game.gameCode || game.id || game.gameId;
            const provider = game.providerCode || game.provider || '';
            const res = await casinoService.launchGame({
                username: user.username,
                provider,
                gameId,
                walletMode: getCasinoWalletModeFromSubWallet(selectedSubWallet),
            });
            const url = res?.url || res?.launch_url || res?.gameUrl || '';
            if (url) {
                setActiveGame({ id: gameId, name: game.name || game.gameName, provider, url });
                document.body.style.overflow = 'hidden';
            }
        } catch (err) {
            console.error('Failed to launch game', err);
        }
    };

    const handleClose = () => {
        setActiveGame(null);
        document.body.style.overflow = '';
    };

    if (localGames.length === 0) return null;

    return (
        <>
            {/* In-page game overlay */}
            {activeGame && <GamePlayerOverlay game={activeGame} onClose={handleClose} />}

            <div>
                {/* Section header — only if title given */}
                {(title || icon) && (
                    <div className="mb-3 flex items-center justify-between px-0.5">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                            {icon ?? <Star className="h-4 w-4 text-[#ff7a1a]" fill="currentColor" strokeWidth={0} />}
                            {title}
                        </h2>
                        <div className="flex items-center gap-2">
                            {viewAllHref && (
                                <a
                                    href={viewAllHref}
                                    className="flex items-center gap-1 text-sm font-semibold text-white/55 transition-colors hover:text-white"
                                >
                                    View all <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
                                </a>
                            )}
                            <button
                                type="button"
                                aria-label="Scroll left"
                                onClick={() => scroll('left')}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.04] text-white/55 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-white/[0.08] hover:text-white active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
                            >
                                <ChevronLeft size={15} />
                            </button>
                            <button
                                type="button"
                                aria-label="Scroll right"
                                onClick={() => scroll('right')}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.04] text-white/55 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-white/[0.08] hover:text-white active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
                            >
                                <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Single horizontal line of v2 game tiles */}
                <div
                    ref={scrollRef}
                    className="v2-no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
                >
                    {localGames.map((game, i) => (
                        <div
                            key={game.id || game.gameCode || i}
                            className="w-[112px] shrink-0 snap-start sm:w-[132px] lg:w-[152px]"
                        >
                            <GameCardBC game={game} onPlay={handlePlay} />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
