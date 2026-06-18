"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    X, RefreshCw, Heart, Maximize2, Minimize2,
    ChevronLeft, Volume2, VolumeX, Share2, Info,
    Loader2, AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GamePlayInterfaceProps {
    game: {
        id: string;
        name: string;
        provider: string;
        url: string;
    };
    onClose: () => void;
    isEmbedded?: boolean;
    onLaunch: (game: any) => void;
}

const GamePlayInterface: React.FC<GamePlayInterfaceProps> = ({
    game,
    onClose,
    isEmbedded = false,
    onLaunch,
}) => {
    const router = useRouter();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [iframeKey, setIframeKey] = useState(0);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [iframeError, setIframeError] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    /* ── detect mobile ── */
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    /* ── fullscreen API ── */
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(console.error);
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    /* ── helpers ── */
    const handleRefresh = () => {
        setIframeLoaded(false);
        setIframeError(false);
        setIframeKey(k => k + 1);
    };

    const handleShare = async () => {
        try {
            await navigator.share({ title: game.name, url: window.location.href });
        } catch {
            await navigator.clipboard.writeText(window.location.href);
        }
    };

    /* ─────────────────────────────────────────────────────── */
    /*  MOBILE LAYOUT  (< 768 px)                              */
    /* ─────────────────────────────────────────────────────── */
    if (isMobile) {
        return (
            <div
                ref={containerRef}
                className="fixed inset-0 z-[200] bg-black flex flex-col"
                style={{ touchAction: 'none' }}
            >
                {/* ── TOP HEADER BAR ── */}
                <div
                    className="absolute top-0 left-0 right-0 z-[201] flex items-center gap-2 px-3 py-2"
                    style={{
                        background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
                        paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)',
                    }}
                >
                    {/* Back */}
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center w-9 h-9 rounded-xl bg-black/60 backdrop-blur-md border border-white/[0.06] text-white active:scale-95 transition-transform"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    {/* Game info */}
                    <div className="flex-1 min-w-0 px-1">
                        <p className="text-white font-bold text-sm leading-tight truncate">{game.name}</p>
                        <p className="text-brand-gold text-[10px] font-semibold uppercase tracking-wider truncate">
                            {game.provider}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setIsFavorite(f => !f)}
                            className={`flex items-center justify-center w-9 h-9 rounded-xl backdrop-blur-md border transition-all active:scale-95 ${
                                isFavorite
                                    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                                    : 'bg-black/60 border-white/[0.06] text-white'
                            }`}
                        >
                            <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                        </button>

                        <button
                            onClick={handleRefresh}
                            className="flex items-center justify-center w-9 h-9 rounded-xl bg-black/60 backdrop-blur-md border border-white/[0.06] text-white active:scale-95 transition-transform"
                        >
                            <RefreshCw size={16} />
                        </button>

                        <button
                            onClick={toggleFullscreen}
                            className="flex items-center justify-center w-9 h-9 rounded-xl bg-black/60 backdrop-blur-md border border-white/[0.06] text-white active:scale-95 transition-transform"
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                    </div>
                </div>

                {/* ── IFRAME ── */}
                <div className="flex-1 relative">
                    {/* Error state */}
                    {iframeError && (
                        <div className="absolute inset-0 bg-bg-deep z-20 flex flex-col items-center justify-center gap-4 px-6">
                            <div className="w-14 h-14 rounded-2xl bg-danger-alpha-10 border border-danger/20 flex items-center justify-center text-3xl">⚠️</div>
                            <div className="text-center">
                                <p className="text-white font-bold text-base">Failed to load game</p>
                                <p className="text-white/40 text-xs mt-1">The game could not be loaded. Try refreshing.</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleRefresh} className="px-4 py-2 rounded-xl bg-brand-gold text-text-inverse text-sm font-bold active:scale-95 transition-transform">Retry</button>
                                <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white/[0.08] border border-white/[0.06] text-white text-sm font-bold active:scale-95 transition-transform">Close</button>
                            </div>
                        </div>
                    )}

                    {!iframeLoaded && !iframeError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-bg-deep z-10">
                            <div className="flex flex-col items-center gap-3">
                                <div className="relative w-14 h-14">
                                    <div className="w-14 h-14 rounded-full border-2 border-[#8B5CF6]/20 border-t-[#8B5CF6] animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center text-xl">🎰</div>
                                </div>
                                <p className="text-white/50 text-xs font-semibold tracking-widest uppercase animate-pulse">
                                    Loading...
                                </p>
                            </div>
                        </div>
                    )}
                    <iframe
                        key={iframeKey}
                        src={game.url}
                        className="w-full h-full border-0"
                        allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture"
                        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                        onLoad={() => setIframeLoaded(true)}
                        onError={() => { setIframeLoaded(true); setIframeError(true); }}
                        style={{ display: 'block' }}
                    />
                </div>
            </div>
        );
    }

    /* ─────────────────────────────────────────────────────── */
    /*  DESKTOP / TABLET LAYOUT  (≥ 768 px)                    */
    /* ─────────────────────────────────────────────────────── */
    return (
        <div
            ref={containerRef}
            className={`${
                isEmbedded
                    ? 'w-full flex flex-col'
                    : 'fixed inset-0 z-[100] bg-bg-deep flex flex-col animate-in fade-in duration-300'
            }`}
            style={{ padding: isEmbedded ? '12px 12px 0' : '0' }}
        >

            {/* ── TOP GAME HEADER (desktop) ── */}
            <div
                className={`flex items-center gap-3 px-4 py-3 ${
                    isEmbedded
                        ? 'bg-bg-zeero border border-white/[0.04] rounded-t-2xl mb-0'
                        : 'bg-bg-zeero border-b border-white/[0.04]'
                }`}
            >
                {/* Back / close */}
                <button
                    onClick={onClose}
                    className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-white/[0.05] border border-white/[0.04] hover:border-white/[0.06] active:scale-95"
                >
                    <ChevronLeft size={16} />
                    <span>Back</span>
                </button>

                {/* Divider */}
                <div className="h-5 w-px bg-white/[0.08]" />

                {/* Provider badge */}
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8B5CF6]/20 to-[#D4AF37]/10 border border-[#8B5CF6]/20 flex items-center justify-center text-xs font-black text-brand-gold">
                        {game.provider.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm leading-tight">{game.name}</p>
                        <p className="text-brand-gold text-[10px] font-semibold uppercase tracking-wider">
                            {game.provider}
                        </p>
                    </div>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Action buttons */}
                <div className="flex items-center gap-2">

                    {/* Info toggle */}
                    <button
                        onClick={() => setShowInfo(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                            showInfo
                                ? 'bg-brand-gold/10 border-brand-gold/40 text-brand-gold'
                                : 'bg-white/[0.03] border-white/[0.05] text-white/50 hover:text-white hover:bg-white/[0.05]'
                        }`}
                        title="Game Info"
                    >
                        <Info size={14} />
                        <span>Info</span>
                    </button>

                    {/* Share */}
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-white/50 hover:text-white hover:bg-white/[0.05] text-xs font-semibold transition-all"
                        title="Share"
                    >
                        <Share2 size={14} />
                        <span>Share</span>
                    </button>

                    {/* Favorite */}
                    <button
                        onClick={() => setIsFavorite(f => !f)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                            isFavorite
                                ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400'
                                : 'bg-white/[0.03] border-white/[0.05] text-white/50 hover:text-white hover:bg-white/[0.05]'
                        }`}
                        title={isFavorite ? 'Remove from Favourites' : 'Add to Favourites'}
                    >
                        <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                        <span>{isFavorite ? 'Saved' : 'Favourite'}</span>
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-white/50 hover:text-white hover:bg-white/[0.05] text-xs font-semibold transition-all"
                        title="Reload Game"
                    >
                        <RefreshCw size={14} />
                        <span>Reload</span>
                    </button>

                    {/* Fullscreen */}
                    <button
                        onClick={toggleFullscreen}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-white/50 hover:text-white hover:bg-white/[0.05] text-xs font-semibold transition-all"
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        <span className="hidden xl:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
                    </button>

                </div>
            </div>

            {/* ── IFRAME CONTAINER ── */}
            <div
                className={`relative flex-1 bg-black overflow-hidden ${
                    isEmbedded ? 'rounded-b-2xl border-x border-b border-white/[0.04]' : ''
                } ${isFullscreen ? 'rounded-none border-0' : ''}`}
                style={
                    !isFullscreen && isEmbedded
                        ? { height: 'calc(100dvh - 180px)', minHeight: '420px' }
                        : !isFullscreen
                        ? { height: 'calc(100dvh - 120px)', minHeight: '420px' }
                        : { position: 'fixed', inset: 0, zIndex: 1000 }
                }
            >
                {/* Loading overlay */}
                {!iframeLoaded && !iframeError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-deep z-10 gap-4">
                        <div className="relative w-16 h-16">
                            <div className="w-16 h-16 rounded-full border-2 border-[#8B5CF6]/20 border-t-[#8B5CF6] animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center text-2xl">🎰</div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <p className="text-white font-bold text-sm">{game.name}</p>
                            <p className="text-white/40 text-xs font-semibold tracking-widest uppercase animate-pulse">
                                Launching game…
                            </p>
                        </div>
                        {/* Shimmer bar */}
                        <div className="w-48 h-1 bg-white/[0.04] rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#D4AF37] rounded-full animate-[shimmerBar_1.6s_ease-in-out_infinite]" />
                        </div>
                    </div>
                )}

                {/* Error overlay (desktop) */}
                {iframeError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-deep z-10 gap-4 px-6">
                        <div className="w-16 h-16 rounded-2xl bg-danger-alpha-10 border border-danger/20 flex items-center justify-center text-3xl">⚠️</div>
                        <div className="text-center">
                            <p className="text-white font-bold text-base">Failed to load game</p>
                            <p className="text-white/40 text-sm mt-1">The game could not be loaded in the iframe.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleRefresh} className="px-5 py-2.5 rounded-xl bg-brand-gold text-text-inverse font-bold text-sm hover:brightness-110 transition-all">Retry</button>
                            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white font-bold text-sm hover:bg-white/[0.08] transition-all">Close</button>
                        </div>
                    </div>
                )}

                <iframe
                    key={iframeKey}
                    src={game.url}
                    className="w-full h-full border-0"
                    allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture"
                    sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                    onLoad={() => setIframeLoaded(true)}
                    onError={() => { setIframeLoaded(true); setIframeError(true); }}
                    style={{ display: 'block' }}
                />

                {/* Fullscreen exit button overlay */}
                {isFullscreen && (
                    <button
                        onClick={toggleFullscreen}
                        className="absolute top-4 right-4 z-[1001] bg-black/70 backdrop-blur-md text-white px-4 py-2 rounded-xl flex items-center gap-2 border border-white/[0.06] hover:bg-black/90 transition-all text-sm font-semibold"
                    >
                        <Minimize2 size={16} />
                        Exit Fullscreen
                    </button>
                )}

                {/* Info panel overlay */}
                {showInfo && !isFullscreen && (
                    <div className="absolute top-0 right-0 h-full w-72 bg-bg-zeero/95 backdrop-blur-xl border-l border-white/[0.04] z-20 flex flex-col p-5 gap-4 animate-in slide-in-from-right duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-bold text-sm">Game Info</h3>
                            <button
                                onClick={() => setShowInfo(false)}
                                className="text-white/40 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                                <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Game</p>
                                <p className="text-white font-bold text-sm">{game.name}</p>
                            </div>
                            <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                                <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Provider</p>
                                <p className="text-brand-gold font-bold text-sm">{game.provider}</p>
                            </div>
                            <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                                <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Game ID</p>
                                <p className="text-white/70 font-mono text-xs break-all">{game.id}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── BOTTOM STATUS BAR (desktop only, non-fullscreen) ── */}
            {!isFullscreen && (
                <div className={`flex items-center justify-between px-4 py-2 mt-0 ${
                    isEmbedded ? 'mt-2' : 'border-t border-white/[0.04] bg-bg-deep'
                }`}>
                    <div className="flex items-center gap-2">
                        {/* Live indicator */}
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-400 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            Live
                        </span>
                        <span className="text-white/20 text-xs">·</span>
                        <span className="text-white/30 text-[10px]">RNG Certified · Provably Fair</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-white/20 uppercase tracking-widest font-semibold">
                        <span>18+ Only</span>
                        <span>·</span>
                        <span>Gamble Responsibly</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GamePlayInterface;
