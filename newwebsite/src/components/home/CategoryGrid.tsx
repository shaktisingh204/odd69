'use client';

import React, { useEffect, useState } from 'react';
import { Gamepad2, Trophy, ArrowRight, Dices, Flag, Tags, Rocket, Circle, Spade } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
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

const V2_EASE = 'transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none';
const ORANGE_PILL = 'linear-gradient(135deg,#ff9a3d,#ff6a00)';

const MINI_CATEGORIES = [
    { id: 'poker', name: 'Poker', Icon: Spade, path: '/casino?category=poker' },
    { id: 'racing', name: 'Racing', Icon: Flag, path: '/casino?category=racing' },
    { id: 'lottery', name: 'Lottery', Icon: Tags, path: '/casino?category=lottery' },
    { id: 'crash', name: 'Crash', Icon: Rocket, path: '/casino?category=crash' },
    { id: 'bingo', name: 'Bingo', Icon: Circle, path: '/casino?category=bingo' },
];

// ── Large hero category card ────────────────────────────────────────────────
function BigCard({
    href, title, subtitle, cta, image, icon3d, ChipIcon, glow,
}: {
    href: string; title: string; subtitle: string; cta: string;
    image?: string; icon3d: string; ChipIcon: React.ElementType; glow: string;
}) {
    return (
        <Link
            href={href}
            className={`group relative block h-[150px] cursor-pointer overflow-hidden rounded-3xl ring-1 ring-white/[0.07] md:h-[200px] hover:-translate-y-1.5 active:scale-[0.985] motion-reduce:transform-none ${V2_EASE}`}
            style={{ background: 'linear-gradient(140deg,#241710 0%,#19110b 55%,#130d0a 100%)' }}
        >
            {/* warm base wash */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff7a1a]/[0.10] via-transparent to-transparent" />
            {/* color glow blob behind the icon */}
            <div
                className={`pointer-events-none absolute -bottom-10 -right-8 h-48 w-48 rounded-full opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100`}
                style={{ background: glow }}
            />
            {/* top sheen */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.05] to-transparent" />

            {/* art: admin image if present, else a 3D game icon */}
            {image ? (
                <img
                    src={cfImage(image, { width: 600, fit: 'contain' })}
                    srcSet={cfImageSrcSet(image, [300, 600, 900], { fit: 'contain' })}
                    sizes="(max-width: 768px) 50vw, 400px"
                    alt={title}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className={`absolute bottom-0 right-0 h-[88%] w-auto object-contain object-right-bottom drop-shadow-xl group-hover:scale-105 ${V2_EASE}`}
                />
            ) : (
                <Image
                    src={`/odd69/icons-3d/${icon3d}.png`}
                    alt=""
                    aria-hidden="true"
                    width={150}
                    height={150}
                    className={`absolute -bottom-2 right-1 h-[120px] w-[120px] select-none group-hover:scale-110 md:h-[150px] md:w-[150px] ${V2_EASE}`}
                    style={{ filter: 'drop-shadow(0 16px 34px rgba(0,0,0,0.45))' }}
                />
            )}

            {/* orange ring on hover / focus */}
            <div
                className="absolute inset-0 z-20 rounded-3xl opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                style={{ boxShadow: 'inset 0 0 0 2px rgba(255,122,26,0.85)' }}
            />

            {/* content */}
            <div className="absolute inset-0 z-10 flex flex-col justify-between p-4 md:p-5">
                <div>
                    <span className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-[0_8px_20px_-6px_rgba(255,106,0,0.7)]" style={{ background: ORANGE_PILL }}>
                        <ChipIcon size={18} strokeWidth={2.4} />
                    </span>
                    <h3 className="mt-3 text-2xl font-extrabold uppercase leading-none tracking-tight text-white drop-shadow md:text-3xl">{title}</h3>
                    <p className="mt-1.5 max-w-[60%] text-[11px] font-medium leading-snug text-white/55 md:text-xs">{subtitle}</p>
                </div>
                <span
                    className="inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white shadow-[0_8px_22px_-8px_rgba(255,106,0,0.75)] transition-transform duration-200 group-hover:translate-x-0.5 group-active:scale-95 motion-reduce:transition-none"
                    style={{ background: ORANGE_PILL }}
                >
                    {cta} <ArrowRight size={13} strokeWidth={2.6} />
                </span>
            </div>
        </Link>
    );
}

export default function CategoryGrid() {
    const [categories, setCategories] = useState<HomeCategory[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await api.get('/home-category');
                const raw = response.data;
                const arr: HomeCategory[] = Array.isArray(raw)
                    ? raw
                    : Array.isArray(raw?.data) ? raw.data
                    : Array.isArray(raw?.categories) ? raw.categories
                    : [];
                setCategories(arr.filter((c: HomeCategory) => c.isActive));
            } catch (error) {
                console.error('Failed to load home categories', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCategories();
    }, []);

    if (loading) {
        return (
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div className="h-[150px] rounded-3xl bg-white/[0.04] skeleton-block md:h-[200px]" />
                    <div className="h-[150px] rounded-3xl bg-white/[0.04] skeleton-block md:h-[200px]" />
                </div>
                <div className="grid grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-[88px] rounded-2xl bg-white/[0.04] skeleton-block md:h-[104px]" />)}
                </div>
            </div>
        );
    }

    const largeCats = categories.filter((c) => c.isLarge).slice(0, 2);
    const hasTwoLarge = largeCats.length >= 2;
    const casino = hasTwoLarge ? largeCats[0] : null;
    const sports = hasTwoLarge ? largeCats[1] : null;

    return (
        <div className="space-y-3">
            {/* Two hero category cards */}
            <div className="grid grid-cols-2 gap-3">
                <BigCard
                    href={casino?.link || '/casino'}
                    title={casino?.title || 'Casino'}
                    subtitle={casino?.subtitle || 'Slots, live tables & originals'}
                    cta="Play now"
                    image={casino?.image}
                    icon3d="dice"
                    ChipIcon={Gamepad2}
                    glow="radial-gradient(circle, rgba(255,122,26,0.55) 0%, transparent 68%)"
                />
                <BigCard
                    href={sports?.link || '/sports'}
                    title={sports?.title || 'Sports'}
                    subtitle={sports?.subtitle || 'Live odds on every match'}
                    cta="Bet now"
                    image={sports?.image}
                    icon3d="trophy"
                    ChipIcon={Trophy}
                    glow="radial-gradient(circle, rgba(255,166,61,0.5) 0%, transparent 68%)"
                />
            </div>

            {/* Mini category tiles */}
            <div className="grid grid-cols-5 gap-3">
                {MINI_CATEGORIES.map((cat) => {
                    const Icon = cat.Icon;
                    return (
                        <Link
                            key={cat.id}
                            href={cat.path}
                            className={`group relative flex h-[88px] flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-bg-card ring-1 ring-white/[0.07] hover:-translate-y-1 active:scale-[0.97] motion-reduce:transform-none md:h-[104px] ${V2_EASE}`}
                        >
                            <div className="pointer-events-none absolute inset-x-0 -top-8 mx-auto h-16 w-16 rounded-full opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" style={{ background: 'radial-gradient(circle, rgba(255,122,26,0.5), transparent 70%)' }} />
                            <span
                                className={`z-10 grid h-10 w-10 place-items-center rounded-xl text-white shadow-[0_8px_18px_-8px_rgba(255,106,0,0.7)] group-hover:scale-110 group-active:scale-95 ${V2_EASE}`}
                                style={{ background: ORANGE_PILL }}
                            >
                                <Icon size={18} strokeWidth={2.4} />
                            </span>
                            <span className="z-10 text-center text-[10px] font-bold uppercase leading-none tracking-wide text-white/80 md:text-[11px]">{cat.name}</span>
                            <div className="absolute inset-0 z-20 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" style={{ boxShadow: 'inset 0 0 0 2px rgba(255,122,26,0.85)' }} />
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
