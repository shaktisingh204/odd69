import Link from 'next/link';
import { casinoService } from '@/services/casino';
import React, { useEffect, useMemo, useState } from 'react';
import ProviderLogo from './ProviderLogo';

interface ProviderListItem {
    id: string | number;
    name: string;
    provider: string;
    code: string;
    image?: string;
    count: number;
}

interface ProviderListProps {
    selectedCategory: string;
    selectedProvider: string;
    onSelectProvider: (provider: string) => void;
    previewLimit?: number;
    viewAllHref?: string;
}

const ProviderList: React.FC<ProviderListProps> = ({
    selectedCategory,
    selectedProvider,
    onSelectProvider,
    previewLimit,
    viewAllHref,
}) => {
    const [providers, setProviders] = useState<ProviderListItem[]>([]);

    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const cat = selectedCategory === 'all' ? undefined : selectedCategory;
                const data = await casinoService.getProviders(cat);
                setProviders(Array.isArray(data) ? data as ProviderListItem[] : []);
            } catch (error) {
                console.error("Failed to fetch providers", error);
            }
        };
        fetchProviders();
    }, [selectedCategory]);

    const providersWithGames = useMemo(() => providers.filter(p => p.count > 0), [providers]);

    const visibleProviders = useMemo(() => {
        if (!previewLimit || previewLimit <= 0 || providersWithGames.length <= previewLimit) return providersWithGames;
        const preview = providersWithGames.slice(0, previewLimit);
        if (selectedProvider === 'all') return preview;
        const selected = providersWithGames.find(p => p.provider === selectedProvider);
        if (!selected || preview.some(p => p.provider === selectedProvider)) return preview;
        return [...preview.slice(0, Math.max(previewLimit - 1, 0)), selected];
    }, [previewLimit, providersWithGames, selectedProvider]);

    const hiddenCount = Math.max(providersWithGames.length - visibleProviders.length, 0);

    return (
        <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Providers</span>
                {viewAllHref && hiddenCount > 0 && (
                    <Link href={viewAllHref} className="text-[10px] font-bold text-brand-gold hover:text-brand-gold-hover transition-colors">
                        All +{hiddenCount}
                    </Link>
                )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {/* All pill */}
                <button
                    onClick={() => onSelectProvider('all')}
                    className={`flex-shrink-0 h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                        selectedProvider === 'all'
                            ? 'bg-brand-gold/15 border-brand-gold/40 text-brand-gold'
                            : 'bg-bg-elevated border-white/[0.04] text-text-muted hover:border-brand-gold/30 hover:text-text-primary'
                    }`}
                >
                    All Games
                </button>

                {visibleProviders.map(provider => (
                    <button
                        key={provider.id}
                        onClick={() => onSelectProvider(provider.provider)}
                        className={`relative flex-shrink-0 h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all border ${
                            selectedProvider === provider.provider
                                ? 'bg-bg-elevated border-brand-gold/40 shadow-glow-gold'
                                : 'bg-bg-elevated border-white/[0.04] grayscale hover:grayscale-0 hover:border-white/[0.06]'
                        }`}
                    >
                        <ProviderLogo
                            provider={provider}
                            alt={provider.name}
                            className={`h-5 w-auto max-w-[72px] object-contain transition-all ${selectedProvider === provider.provider ? '' : 'grayscale'}`}
                            fallbackClassName="text-[10px] font-bold text-text-muted"
                            fallbackText={provider.name}
                        />
                        {provider.count > 0 && (
                            <span className="text-[9px] font-bold text-text-muted">{provider.count}</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ProviderList;
