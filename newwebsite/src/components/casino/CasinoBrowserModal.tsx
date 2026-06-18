"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Search, X, ChevronRight, Layers, LayoutGrid } from 'lucide-react';
import { casinoService } from '@/services/casino';
import GameGrid from '@/components/casino/GameGrid';
import ProviderLogo from '@/components/casino/ProviderLogo';

interface CasinoBrowserModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialCategory: string;
    initialSearch: string;
    onLaunch: (game: any) => void;
    categories: Array<{ key: string; label: string; Icon: any }>;
}

export default function CasinoBrowserModal({ isOpen, onClose, initialCategory, initialSearch, onLaunch, categories }: CasinoBrowserModalProps) {
    const [searchQuery, setSearchQuery] = useState(initialSearch);
    const [activeCat, setActiveCat] = useState(initialCategory || 'all');
    const [activeProvider, setActiveProvider] = useState<string | null>(null);
    const [providers, setProviders] = useState<any[]>([]);
    
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Synchronize initial state when opened
    useEffect(() => {
        if (isOpen) {
            setSearchQuery(initialSearch);
            // If they clicked "Providers" pill specifically on main page:
            if (initialCategory === 'providers') {
                setActiveCat('providers');
                setActiveProvider(null);
            } else {
                setActiveCat(initialCategory || 'all');
                setActiveProvider(null);
            }
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen, initialCategory, initialSearch]);

    useEffect(() => {
        if (isOpen && activeCat === 'providers' && providers.length === 0) {
            casinoService.getProviders()
                .then(data => setProviders(Array.isArray(data) ? data : []))
                .catch(() => {});
        }
    }, [isOpen, activeCat, providers.length]);

    if (!isOpen) return null;

    const handleCatSelect = (key: string) => {
        setActiveCat(key);
        if (key !== 'providers') setActiveProvider(null);
        setSearchQuery('');
    };

    const handleProviderClick = (providerCode: string) => {
        setActiveProvider(providerCode);
        setActiveCat('all'); // Shift internally to all games, but filtered by provider
        setSearchQuery('');
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex justify-center items-start pt-4 sm:pt-16 pb-4 px-4 overflow-y-auto animate-in fade-in duration-200">
            <div ref={wrapperRef} className="w-full max-w-[1200px] bg-bg-base border border-white/[0.04] rounded-3xl shadow-xl overflow-hidden flex flex-col min-h-[600px]">
                
                {/* ── HEADER ── */}
                <div className="p-4 md:p-6 border-b border-white/[0.04] flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center">
                                <Search size={20} className="text-brand-gold" />
                            </div>
                            <h2 className="text-xl font-black text-white">Browser</h2>
                        </div>
                        <button onClick={onClose} className="p-2.5 rounded-xl bg-bg-elevated hover:bg-white/[0.08] transition-colors text-white/50 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/45" size={20} />
                        <input
                            type="text"
                            placeholder="Search among 1000+ games..."
                            value={searchQuery}
                            onChange={(e) => { 
                                setSearchQuery(e.target.value); 
                                if (e.target.value && activeCat === 'providers') setActiveCat('all'); 
                            }}
                            className="h-14 w-full rounded-2xl border border-white/[0.06] bg-bg-zeero py-2.5 pl-12 pr-4 text-sm font-bold text-white outline-none transition-colors placeholder:text-white/45 focus:border-brand-gold/50"
                            autoFocus
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45 hover:text-white bg-bg-elevated p-1 rounded-md">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Categories Rail */}
                    {!searchQuery && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none mt-2">
                            {/* Explicit All/Lobby pill inside modal? */}
                            <button
                                onClick={() => handleCatSelect('all')}
                                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all border border-transparent ${
                                    activeCat === 'all' && !activeProvider
                                        ? 'bg-brand-gold/15 border-brand-gold/40 text-brand-gold'
                                        : 'bg-bg-elevated border-white/[0.04] text-white/50 hover:text-white/80 hover:border-white/[0.06]'
                                }`}
                            >
                                <LayoutGrid size={14} className={activeCat === 'all' && !activeProvider ? 'text-brand-gold' : 'text-white/50'} />
                                All Games
                            </button>

                            {categories.filter(c => c.key !== 'all').map(({ key, label, Icon }) => {
                                const active = activeCat === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => handleCatSelect(key)}
                                        className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all border border-transparent ${
                                            active
                                                ? 'bg-brand-gold/15 border-brand-gold/40 text-brand-gold'
                                                : 'bg-bg-elevated border-white/[0.04] text-white/50 hover:text-white/80 hover:border-white/[0.06]'
                                        }`}
                                    >
                                        <Icon size={14} className={active ? 'text-brand-gold' : 'text-white/50'} />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── CONTENT BODY ── */}
                <div className="flex-1 p-4 md:p-6 bg-bg-deep overflow-y-auto">
                    {searchQuery ? (
                        <GameGrid title={`Search Results for "${searchQuery}"`} category="all" search={searchQuery} layout="grid" onLaunch={onLaunch} />
                    ) : activeCat === 'providers' ? (
                        <div className="animate-in fade-in">
                            <h3 className="text-sm font-black text-white mb-4">All Providers <span className="text-white/40 text-xs ml-2">({providers.length})</span></h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {providers.map((p, idx) => {
                                    const code = p.providerCode || p.provider || p.code || '';
                                    const name = p.name || code;
                                    return (
                                        <button
                                            key={code || idx}
                                            onClick={() => handleProviderClick(code)}
                                            className="flex h-16 items-center justify-center rounded-xl border border-white/[0.04] bg-bg-elevated px-4 transition-all hover:bg-white/[0.08] hover:border-brand-gold/40 group"
                                        >
                                            <ProviderLogo
                                                provider={{ image: p.image, provider: code, code }}
                                                alt={name}
                                                className="max-h-8 w-auto max-w-[100px] object-contain transition-transform group-hover:scale-105"
                                                fallbackClassName="text-sm font-black text-white/60 group-hover:text-white"
                                                fallbackText={name}
                                            />
                                        </button>
                                    );
                                })}
                                {providers.length === 0 && (
                                    Array.from({length: 12}).map((_, i) => (
                                        <div key={i} className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <GameGrid 
                            title={activeProvider ? `Games by Provider` : `Browsing ${categories.find(c => c.key === activeCat)?.label || 'All Games'}`}
                            category={activeCat} 
                            provider={activeProvider || undefined} 
                            layout="grid" 
                            onLaunch={onLaunch} 
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
