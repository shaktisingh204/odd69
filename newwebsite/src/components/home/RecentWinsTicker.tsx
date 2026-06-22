'use client';

import React, { useEffect, useState, useRef } from 'react';
import { TrendingUp } from 'lucide-react';
import { casinoService } from '@/services/casino';
import { useWallet } from '@/context/WalletContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getRandomAmount = (symbol = '$') => {
    const amount = (Math.random() * 500000) + 1000;
    if (amount > 100000) return `${symbol}${(amount / 100000).toFixed(2)}L`;
    if (amount > 1000) return `${symbol}${(amount / 1000).toFixed(2)}K`;
    return `${symbol}${Math.floor(amount).toLocaleString('en-US')}`;
};

const ADJECTIVES = ['Lucky', 'King', 'Ace', 'Star', 'Pro', 'Elite', 'Golden', 'Royal', 'Big', 'Ultra'];
const NOUNS = ['Player', 'Winner', 'Hunter', 'Shark', 'Tiger', 'Eagle', 'Wolf', 'Bull', 'Falcon'];
const getRandomUser = () => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj}${noun}${Math.floor(Math.random() * 999)}`;
};

const CARD_COLORS = [
    'from-orange-700 to-orange-900',
    'from-blue-600 to-blue-900',
    'from-teal-600 to-teal-900',
    'from-red-700 to-red-900',
    'from-orange-600 to-orange-900',
    'from-pink-600 to-pink-900',
    'from-orange-600 to-orange-900',
    'from-green-600 to-green-900',
];

interface WinItem {
    game: string;
    user: string;
    amount: string;
    color: string;
    image: string;
}

/** Build a WinItem from a real DB game object */
function gameToWinItem(game: any, idx: number): WinItem {
    return {
        game: game.gameName || game.name || 'Casino Game',
        user: getRandomUser(),
        amount: getRandomAmount(),
        color: CARD_COLORS[idx % CARD_COLORS.length],
        image: game.image || game.thumbnail || game.imageUrl || '',
    };
}

// ── Ticker item card ──────────────────────────────────────────────────────────

function TickerItem({ win }: { win: WinItem }) {
    const [imgFailed, setImgFailed] = useState(false);
    const hasImage = !imgFailed && !!win.image;

    return (
        <div className="flex-shrink-0 w-[78px] mx-1 group cursor-pointer">
            <div
                className={`relative w-full h-[96px] rounded-xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.3)] border border-white/[0.06]
                    mb-1.5 group-hover:border-brand-gold/40 transition-all group-hover:scale-105 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]
                    bg-gradient-to-b ${win.color}`}
            >
                {hasImage ? (
                    <img
                        src={win.image}
                        alt={win.game}
                        onError={() => setImgFailed(true)}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-3xl">🎮</span>
                    </div>
                )}

                {/* game name overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-1.5 z-10 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-[9px] text-white/90 font-bold truncate text-center leading-tight drop-shadow">
                        {win.game}
                    </p>
                </div>
            </div>
            <p className="text-[10px] text-text-muted font-medium truncate text-center leading-tight mt-1">{win.user}</p>
            <p className="text-[11px] font-black text-brand-gold text-center leading-tight">{win.amount}</p>
        </div>
    );
}

// ── Skeleton placeholder (shown before DB games load) ────────────────────────

function TickerSkeleton() {
    return (
        <div className="flex-shrink-0 w-[78px] mx-1">
            <div className="w-full h-[96px] rounded-xl skeleton-block mb-1.5" />
            <div className="w-2/3 h-2 rounded skeleton-block mx-auto mb-1" />
            <div className="w-1/2 h-2.5 rounded skeleton-block mx-auto" />
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecentWinsTicker() {
    const { activeSymbol } = useWallet();
    const [wins, setWins] = useState<WinItem[]>([]);
    const [loading, setLoading] = useState(true);
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        const load = async () => {
            try {
                // Fetch a diverse set of games from different categories in parallel
                const [slotsRes, liveRes, crashRes] = await Promise.all([
                    casinoService.getGames(undefined, 'slots', undefined, 1, 15),
                    casinoService.getGames(undefined, 'live', undefined, 1, 10),
                    casinoService.getGames(undefined, 'crash', undefined, 1, 5),
                ]);

                const raw = [
                    ...(slotsRes.games || []),
                    ...(liveRes.games || []),
                    ...(crashRes.games || []),
                ];

                if (raw.length === 0) {
                    setLoading(false);
                    return;
                }

                // Shuffle so the ticker order is different each load
                const shuffled = [...raw].sort(() => Math.random() - 0.5);

                // Build win items — duplicate to fill the scroll seamlessly
                const items = shuffled.map((g, i) => gameToWinItem(g, i));
                // Re-apply symbol to amounts
                const withSymbol = items.map(item => ({
                    ...item,
                    amount: getRandomAmount(activeSymbol),
                }));
                setWins([...withSymbol, ...withSymbol]); // doubled for infinite scroll
            } catch (e) {
                console.error('RecentWinsTicker: failed to load games', e);
                // On error, leave wins empty — component will show nothing gracefully
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    return (
        <div className="w-full bg-bg-section py-3">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)] animate-pulse" />
                <span className="text-sm font-black text-white uppercase tracking-tight">Recent Big Wins</span>
                <TrendingUp size={14} className="text-green-500 ml-auto" />
            </div>

            {/* Scrolling Row */}
            <div className="overflow-hidden relative">
                {loading ? (
                    // Skeleton shimmer while DB games are loading
                    <div className="flex px-4 gap-0">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <TickerSkeleton key={i} />
                        ))}
                    </div>
                ) : wins.length > 0 ? (
                    <div className="flex animate-scroll hover:[animation-play-state:paused] w-max px-4 gap-0">
                        {wins.map((win, i) => (
                            <TickerItem key={i} win={win} />
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
