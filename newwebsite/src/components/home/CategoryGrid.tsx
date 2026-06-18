'use client';

import React, { useEffect, useState } from 'react';
import { Gamepad2, Trophy, Target, Zap, Star, Dices, ArrowRight, Flag, Tags, Rocket, Circle, Spade } from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import { cfImage, cfImageSrcSet } from '@/utils/cfImages';

interface HomeCategory {
    _id: string;
    id?: string;
    title: string;
    subtitle?: string;
    description?: string;
    image?: string;
    link: string;
    isLarge: boolean;
    order: number;
    isActive: boolean;
    style?: any;
}

// Fixed mini categories like BC.GAME (Poker, Racing, Lottery, etc.)
const MINI_CATEGORIES = [
    { id: 'poker', name: 'Poker', Icon: Dices, path: '/casino?category=poker', color: 'from-green-900/50 to-green-800/30', iconColor: 'text-green-400' },
    { id: 'racing', name: 'Racing', Icon: Flag, path: '/casino?category=racing', color: 'from-blue-900/50 to-blue-800/30', iconColor: 'text-brand-gold' },
    { id: 'lottery', name: 'Lottery', Icon: Tags, path: '/casino?category=lottery', color: 'from-purple-900/50 to-purple-800/30', iconColor: 'text-accent-purple' },
    { id: 'crash', name: 'Crash', Icon: Rocket, path: '/casino?category=crash', color: 'from-orange-900/50 to-orange-800/30', iconColor: 'text-warning' },
    { id: 'bingo', name: 'Bingo', Icon: Circle, path: '/casino?category=bingo', color: 'from-red-900/50 to-red-800/30', iconColor: 'text-danger' },
];

export default function CategoryGrid() {
    const [categories, setCategories] = useState<HomeCategory[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await api.get('/home-category');
                // Normalize: API may return an array or a wrapped object { data: [...] }
                const raw = response.data;
                const arr: HomeCategory[] = Array.isArray(raw)
                    ? raw
                    : Array.isArray(raw?.data)
                        ? raw.data
                        : Array.isArray(raw?.categories)
                            ? raw.categories
                            : [];
                setCategories(arr.filter((c: HomeCategory) => c.isActive));
            } catch (error) {
                console.error("Failed to load home categories", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCategories();
    }, []);

    if (loading) {
        return (
            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <div className="h-[140px] md:h-[180px] bg-white/[0.04] rounded-2xl animate-pulse" />
                    <div className="h-[140px] md:h-[180px] bg-white/[0.04] rounded-2xl animate-pulse" />
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-[80px] md:h-[100px] bg-white/[0.04] rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    // Use admin categories if available, else fallback
    const hasAdminCats = categories.length > 0;
    const largeCats = hasAdminCats
        ? categories.filter(c => c.isLarge).slice(0, 2)
        : null;
    const hasTwoLarge = largeCats && largeCats.length >= 2;

    return (
        <div className="space-y-2">
            {/* Row 1: Two large cards - Casino & Sports style */}
            <div className="grid grid-cols-2 gap-2">
                {/* Casino Large Card */}
                <Link
                    href={hasTwoLarge ? largeCats![0].link : '/casino'}
                    className="relative h-[140px] md:h-[180px] rounded-2xl overflow-hidden group cursor-pointer border border-white/[0.04] hover:border-brand-gold/20 transition-all hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] block"
                    style={{ background: 'linear-gradient(135deg, #141824 0%, #0C0D14 100%)' }}
                >
                    {/* Background pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/8 via-transparent to-transparent" />

                    {/* Image — above-the-fold Category card, eager + high
                        priority so it's in the LCP critical path. */}
                    {hasTwoLarge && largeCats![0].image ? (
                        <img
                            src={cfImage(largeCats![0].image, { width: 600, fit: 'contain' })}
                            srcSet={cfImageSrcSet(largeCats![0].image, [300, 600, 900], { fit: 'contain' })}
                            sizes="(max-width: 768px) 50vw, 400px"
                            alt={largeCats![0].title}
                            loading="eager"
                            fetchPriority="high"
                            decoding="async"
                            className="absolute right-0 bottom-0 h-[85%] w-auto object-contain object-right-bottom group-hover:scale-105 transition-transform duration-500 drop-shadow-xl"
                        />
                    ) : (
                        <div className="absolute right-2 bottom-2 opacity-20 group-hover:opacity-30 transition-opacity">
                            <Dices size={80} className="text-brand-gold" />
                        </div>
                    )}

                    {/* Label */}
                    <div className="absolute top-4 left-4 z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-lg bg-brand-gold/20 flex items-center justify-center">
                                <Gamepad2 size={13} className="text-brand-gold" />
                            </div>
                        </div>
                        <h3 className="text-white font-black text-xl uppercase leading-tight tracking-tight drop-shadow">
                            {hasTwoLarge ? largeCats![0].title : 'CASINO'}
                        </h3>
                        {hasTwoLarge && largeCats![0].subtitle && (
                            <p className="text-white/60 text-[10px] font-medium mt-0.5">{largeCats![0].subtitle}</p>
                        )}
                    </div>
                    <div className="absolute bottom-3 left-4 z-10">
                        <span className="text-brand-gold text-[10px] font-bold uppercase flex items-center gap-1">
                            Play Now <ArrowRight size={10} />
                        </span>
                    </div>
                </Link>

                {/* Sports Large Card */}
                <Link
                    href={hasTwoLarge ? largeCats![1].link : '/sports'}
                    className="relative h-[140px] md:h-[180px] rounded-2xl overflow-hidden group cursor-pointer border border-white/[0.04] hover:border-teal-400/20 transition-all hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] block"
                    style={{ background: 'linear-gradient(135deg, #0F1A20 0%, #0C0D14 100%)' }}
                >
                    {/* Background pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-500/8 via-transparent to-transparent" />

                    {/* Image — second above-the-fold Category card, eager +
                        high priority for LCP critical path. */}
                    {hasTwoLarge && largeCats![1].image ? (
                        <img
                            src={cfImage(largeCats![1].image, { width: 600, fit: 'contain' })}
                            srcSet={cfImageSrcSet(largeCats![1].image, [300, 600, 900], { fit: 'contain' })}
                            sizes="(max-width: 768px) 50vw, 400px"
                            alt={largeCats![1].title}
                            loading="eager"
                            fetchPriority="high"
                            decoding="async"
                            className="absolute right-0 bottom-0 h-[85%] w-auto object-contain object-right-bottom group-hover:scale-105 transition-transform duration-500 drop-shadow-xl"
                        />
                    ) : (
                        <div className="absolute right-2 bottom-2 opacity-20 group-hover:opacity-30 transition-opacity">
                            <Trophy size={80} className="text-teal-400" />
                        </div>
                    )}

                    {/* Label */}
                    <div className="absolute top-4 left-4 z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-lg bg-teal-500/20 flex items-center justify-center">
                                <Trophy size={13} className="text-teal-400" />
                            </div>
                        </div>
                        <h3 className="text-white font-black text-xl uppercase leading-tight tracking-tight drop-shadow">
                            {hasTwoLarge ? largeCats![1].title : 'SPORTS'}
                        </h3>
                        {hasTwoLarge && largeCats![1].subtitle && (
                            <p className="text-white/60 text-[10px] font-medium mt-0.5">{largeCats![1].subtitle}</p>
                        )}
                    </div>
                    <div className="absolute bottom-3 left-4 z-10">
                        <span className="text-teal-400 text-[10px] font-bold uppercase flex items-center gap-1">
                            Bet Now <ArrowRight size={10} />
                        </span>
                    </div>
                </Link>
            </div>

            {/* Row 2: 5 Mini Category Icons */}
            <div className="grid grid-cols-5 gap-1.5">
                {MINI_CATEGORIES.map((cat) => {
                    const IconComp = cat.Icon;
                    return (
                        <Link
                            key={cat.id}
                            href={cat.path}
                            className={`relative flex flex-col items-center justify-center gap-2 h-[80px] md:h-[100px] rounded-xl border border-white/[0.04] hover:border-white/[0.1] transition-all group overflow-hidden bg-gradient-to-b ${cat.color}`}
                        >
                            <div className="absolute inset-0 bg-bg-modal/70" />
                            <IconComp size={20} className={`${cat.iconColor} z-10 group-hover:scale-110 transition-transform duration-300`} />
                            <span className="text-[10px] md:text-[11px] font-bold text-white/80 uppercase tracking-wide z-10 text-center leading-none">
                                {cat.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
