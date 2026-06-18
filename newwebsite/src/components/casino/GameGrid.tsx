import React, { useRef } from 'react';
import { ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import SkeletonGameRow from '@/components/shared/SkeletonGameRow';
import SkeletonGameGrid from '@/components/shared/SkeletonGameGrid';
import GameCard from './GameCard';
import { useAuth } from '@/context/AuthContext';
import { casinoService, type CasinoGame } from '@/services/casino';

interface GameGridProps {
    title: string;
    icon?: React.ReactNode;
    category: string;
    sectionKey?: string; // if set, loads admin-curated games from this section
    provider?: string;
    search?: string;
    layout?: 'grid' | 'row';
    onViewAll?: () => void;
    onLaunch?: (game: { id: string; name: string; provider: string; url: string }) => void;
    type?: string;
}

const GameGrid: React.FC<GameGridProps> = ({ title, icon, category, sectionKey, provider, search, layout = 'grid', onViewAll, onLaunch, type }) => {
    const { user } = useAuth();
    const [games, setGames] = React.useState<CasinoGame[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [totalGames, setTotalGames] = React.useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const fetchGames = async () => {
            try {
                setLoading(true);
                // If sectionKey is set, first try curated games from admin
                if (sectionKey) {
                    const curated = await casinoService.getSectionGames(sectionKey);
                    if (curated && curated.length > 0) {
                        setGames(curated as CasinoGame[]);
                        setTotalPages(1);
                        setTotalGames(curated.length);
                        return;
                    }
                }
                // Fall back to category filter
                const cat = category === 'all' ? undefined : category;
                const prov = provider === 'all' ? undefined : provider;
                const data = await casinoService.getGames(prov, cat, search, page, undefined, type);
                if (data && Array.isArray(data.games)) {
                    setGames(data.games as CasinoGame[]);
                    setTotalPages(data.totalPages);
                    setTotalGames(data.totalCount || 0);
                } else {
                    setGames([]);
                }
            } catch (error) {
                console.error("Failed to fetch games", error);
            } finally {
                setLoading(false);
            }
        };
        fetchGames();
    }, [category, sectionKey, provider, search, page, type]);

    const handleLaunchGame = async (game: CasinoGame) => {
        if (!user) { alert("Please login to play"); return; }
        const gameData = {
            id: game.gameCode || game.id,
            name: game.gameName || game.name,
            provider: game.providerCode || game.provider,
            url: ''
        };
        if (onLaunch) {
            onLaunch(gameData);
        } else {
            window.location.href = `/casino/play/${gameData.id}?provider=${encodeURIComponent(gameData.provider)}&name=${encodeURIComponent(gameData.name)}`;
        }
    };

    const removeGame = (idToRemove: string) => {
        setGames(prev => prev.filter(g => (g.id || g.gameCode) !== idToRemove));
    };

    const scroll = (dir: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const amt = dir === 'left' ? -scrollContainerRef.current.offsetWidth * 0.75 : scrollContainerRef.current.offsetWidth * 0.75;
            scrollContainerRef.current.scrollBy({ left: amt, behavior: 'smooth' });
        }
    };

    if (loading) return layout === 'row' ? <SkeletonGameRow count={8} /> : <SkeletonGameGrid count={18} />;
    if (games.length === 0) return null;

    return (
        <section className="animate-in fade-in duration-500 w-full">
            {/* Section header — branded icon box style */}
            <div className="mb-3 flex items-center justify-between px-3">
                <div className="flex items-center gap-2.5">
                    {icon && (
                        <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                            {icon}
                        </div>
                    )}
                    <div>
                        <h3 className="text-[15px] font-adx-bold text-white md:text-[16px] leading-none">{title}</h3>
                        <p className="text-[10px] text-white/40 mt-0.5">{totalGames} games</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {layout === 'row' && (
                        <>
                            <button onClick={() => scroll('left')} className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated border border-white/[0.04] text-white/50 transition-all hover:bg-white/[0.05] hover:text-white hover:border-white/[0.06]">
                                <ChevronLeft size={14} />
                            </button>
                            <button onClick={() => scroll('right')} className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-elevated border border-white/[0.04] text-white/50 transition-all hover:bg-white/[0.05] hover:text-white hover:border-white/[0.06]">
                                <ChevronRight size={14} />
                            </button>
                        </>
                    )}
                    {onViewAll && (
                        <button onClick={onViewAll} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.04] bg-bg-elevated px-3 text-[11px] font-bold text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white">
                            All <ArrowRight size={11} />
                        </button>
                    )}
                </div>
            </div>

            {layout === 'row' ? (
                <div
                    ref={scrollContainerRef}
                    className="flex gap-1.5 overflow-x-auto pb-2 pl-3"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {games.map((game, idx) => (
                        <GameCard
                            key={game.id || idx}
                            name={game.gameName || game.name || 'Unknown'}
                            image={game.banner || game.image || ''}
                            provider={game.providerCode || game.provider}
                            tag={game.tag}
                            layout="row"
                            onClick={() => handleLaunchGame(game)}
                            onError={() => removeGame(game.id || game.gameCode)}
                        />
                    ))}
                    {/* Right-side padding spacer */}
                    <div className="min-w-3 flex-shrink-0" />
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
                    {games.map((game, idx) => (
                        <GameCard
                            key={game.id || idx}
                            name={game.gameName || game.name || 'Unknown'}
                            image={game.banner || game.image || ''}
                            provider={game.providerCode || game.provider}
                            tag={game.tag}
                            layout="grid"
                            onClick={() => handleLaunchGame(game)}
                            onError={() => removeGame(game.id || game.gameCode)}
                        />
                    ))}
                </div>
            )}

            {/* Pagination (grid only) */}
            {layout === 'grid' && totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 mt-6 pb-4">
                    <button
                        disabled={page === 1}
                        onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-bg-elevated border border-white/[0.04] hover:border-brand-gold/40 disabled:opacity-30 disabled:cursor-not-allowed text-text-primary text-sm font-bold transition-all"
                    >
                        <ChevronLeft size={14} /> Prev
                    </button>
                    <span className="text-text-muted text-xs font-medium px-2">{page} / {totalPages}</span>
                    <button
                        disabled={page === totalPages}
                        onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-bg-elevated border border-white/[0.04] hover:border-brand-gold/40 disabled:opacity-30 disabled:cursor-not-allowed text-text-primary text-sm font-bold transition-all"
                    >
                        Next <ChevronRight size={14} />
                    </button>
                </div>
            )}
        </section>
    );
};

export default GameGrid;
