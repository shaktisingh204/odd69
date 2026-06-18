
"use client";

import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const BANNERS = [
    {
        id: 1,
        title: "SIGN UP & GET UP TO $20,000",
        subtitle: "Stay Untamed",
        cta: "JOIN NOW",
        image: "/banner-bg-1.jpg", // Placeholder, we'll use a gradient for now
        gradient: "from-purple-900 to-indigo-900",
        accent: "text-brand-gold"
    },
    {
        id: 2,
        title: "VIP TRANSFERS ARE LIVE",
        subtitle: "Level Up Instantly",
        cta: "LEARN MORE",
        image: "/banner-bg-2.jpg",
        gradient: "from-blue-900 to-cyan-900",
        accent: "text-text-primary"
    }
];

export default function HomeHero() {
    const [active, setActive] = React.useState(0);

    const next = () => setActive((p) => (p + 1) % BANNERS.length);
    const prev = () => setActive((p) => (p - 1 + BANNERS.length) % BANNERS.length);

    return (
        <div className="relative w-full aspect-[2.5/1] md:aspect-[3/1] lg:aspect-[4/1] max-h-[400px] bg-bg-card rounded-2xl overflow-hidden mb-6 group">
            {BANNERS.map((banner, idx) => (
                <div
                    key={banner.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ${idx === active ? 'opacity-100 z-10' : 'opacity-0 z-0'
                        } bg-gradient-to-r ${banner.gradient} flex items-center px-10 md:px-20`}
                >
                    <div className="max-w-2xl animate-fade-in-up">
                        <span className={`inline-block py-1 px-3 rounded bg-white/[0.08] text-xs font-bold mb-4 ${banner.accent} uppercase tracking-wider`}>
                            {banner.subtitle}
                        </span>
                        <h2 className="text-4xl md:text-6xl font-black text-text-primary italic mb-6 leading-tight">
                            {banner.title}
                        </h2>
                        <button className="bg-brand-gold text-text-inverse font-black uppercase px-8 py-3 rounded hover:scale-105 transition-transform shadow-glow-gold">
                            {banner.cta}
                        </button>
                    </div>
                </div>
            ))}

            {/* Navigation */}
            <button
                onClick={prev}
                className="absolute left-4 top-1/2 -translate-y-1/2 size-10 bg-black/30 hover:bg-black/50 text-text-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-md"
            >
                <ArrowLeft size={20} />
            </button>
            <button
                onClick={next}
                className="absolute right-4 top-1/2 -translate-y-1/2 size-10 bg-black/30 hover:bg-black/50 text-text-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-md"
            >
                <ArrowRight size={20} />
            </button>

            {/* Indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                {BANNERS.map((_, i) => (
                    <div
                        key={i}
                        className={`h-1 rounded-full transition-all duration-300 ${i === active ? 'w-8 bg-text-primary' : 'w-2 bg-text-primary/30'}`}
                    />
                ))}
            </div>
        </div>
    );
}
