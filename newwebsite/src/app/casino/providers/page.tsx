"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronLeft, Search } from 'lucide-react';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import ProviderLogo from '@/components/casino/ProviderLogo';
import { casinoService } from '@/services/casino';

interface CasinoProviderDirectoryItem {
    id?: string | number;
    name: string;
    provider: string;
    code: string;
    image?: string;
    count: number;
}

function ProvidersDirectory() {
    const [providers, setProviders] = useState<CasinoProviderDirectoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const data = await casinoService.getProviders();
                const providerList = Array.isArray(data)
                    ? (data as CasinoProviderDirectoryItem[]).filter((provider) => provider?.count > 0)
                    : [];
                setProviders(providerList);
            } catch (error) {
                console.error('Failed to fetch casino providers', error);
                setProviders([]);
            } finally {
                setLoading(false);
            }
        };

        fetchProviders();
    }, []);

    const filteredProviders = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return providers;
        }

        return providers.filter((provider) => {
            const providerName = String(provider.name || '').toLowerCase();
            const providerCode = String(provider.provider || provider.code || '').toLowerCase();
            return providerName.includes(query) || providerCode.includes(query);
        });
    }, [providers, searchQuery]);

    return (
        <div className="p-3 sm:p-4 md:p-6 space-y-5 md:space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                    <Link
                        href="/casino"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-bg-elevated px-3 py-2 text-xs font-bold uppercase tracking-widest text-text-secondary transition-colors hover:text-text-primary"
                    >
                        <ChevronLeft size={14} />
                        Back To Casino
                    </Link>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-gold/80">Provider Directory</p>
                        <h1 className="mt-2 text-2xl font-black text-text-primary md:text-4xl">All Casino Providers</h1>
                        <p className="mt-2 max-w-2xl text-sm text-text-secondary md:text-base">
                            Search any studio and open the casino page already filtered to that provider.
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-bg-elevated px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">Visible Providers</p>
                    <div className="mt-1 flex items-end gap-2">
                        <span className="text-2xl font-black text-text-primary">{filteredProviders.length}</span>
                        <span className="pb-1 text-xs text-text-muted">of {providers.length}</span>
                    </div>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                <input
                    type="text"
                    placeholder="Search providers..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full rounded-2xl border border-white/[0.06] bg-bg-elevated py-3 pl-10 pr-4 text-text-primary outline-none transition-all focus:border-brand-gold/40"
                />
            </div>

            {loading ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <div
                            key={index}
                            className="h-[176px] animate-pulse rounded-2xl border border-white/[0.04] bg-bg-elevated"
                        />
                    ))}
                </div>
            ) : filteredProviders.length === 0 ? (
                <div className="rounded-3xl border border-white/[0.06] bg-bg-elevated px-6 py-14 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gold/10 text-brand-gold">
                        <Search size={22} />
                    </div>
                    <h2 className="mt-4 text-lg font-bold text-text-primary">No providers found</h2>
                    <p className="mt-2 text-sm text-text-secondary">
                        Try a different provider name or code.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {filteredProviders.map((provider) => {
                        const providerCode = provider.provider || provider.code;

                        return (
                            <Link
                                key={provider.id || providerCode}
                                href={`/casino?provider=${encodeURIComponent(providerCode)}`}
                                className="group rounded-2xl border border-white/[0.06] bg-bg-elevated p-4 transition-all hover:border-brand-gold/30 hover:shadow-glow-gold"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                                        {provider.count} Games
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                                        Open
                                        <ArrowUpRight size={12} />
                                    </span>
                                </div>

                                <div className="mt-4 flex h-[88px] items-center justify-center rounded-2xl border border-white/[0.04] bg-black/20 p-4">
                                    <ProviderLogo
                                        provider={provider}
                                        alt={provider.name}
                                        className="max-h-14 w-auto max-w-full object-contain"
                                        fallbackClassName="text-xl font-black text-text-secondary"
                                        fallbackText={provider.name}
                                    />
                                </div>

                                <div className="mt-4">
                                    <h2 className="text-sm font-bold text-text-primary md:text-base">{provider.name}</h2>
                                    <p className="mt-1 line-clamp-1 text-[11px] font-mono uppercase tracking-widest text-text-muted">
                                        {providerCode}
                                    </p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function CasinoProvidersPage() {
    return (
        <div className="h-screen overflow-hidden bg-bg-base flex flex-col">
            <Header />

            <div className="flex-1 overflow-hidden pt-[60px] md:pt-[64px] max-w-[1920px] mx-auto w-full md:flex">
                <div className="hidden md:block">
                    <LeftSidebar />
                </div>

                <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-[72px] md:pb-0 md:border-l md:border-r md:border-white/[0.04]">
                    <ProvidersDirectory />
                </main>
            </div>
        </div>
    );
}
