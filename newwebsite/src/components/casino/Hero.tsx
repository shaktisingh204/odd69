"use client";

import React from 'react';
import { Play } from 'lucide-react';

const Hero = () => {
    return (
        <div className="relative w-full h-[200px] md:h-[320px] rounded-2xl overflow-hidden group">
            {/* Background Image (Mock based on reference) */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{
                    backgroundImage: 'url("https://images.unsplash.com/photo-1596838132731-3301c3fd4317?q=80&w=2940&auto=format&fit=crop")', // Casino/Chips generic image
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
            </div>

            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 z-10">
                <div className="animate-in fade-in slide-in-from-left-10 duration-700">
                    <h2 className="text-3xl md:text-5xl font-black text-text-primary italic uppercase tracking-tighter drop-shadow-lg mb-2">
                        JACKPOTS <br /> <span className="text-jackpot">START HERE!</span>
                    </h2>
                    <p className="text-text-secondary md:text-lg font-medium mb-6 max-w-[500px]">
                        Experience the thrill of over 5,000+ premium casino games. Sign up now and claim your welcome bonus.
                    </p>
                    <button className="flex items-center gap-2 bg-jackpot hover:bg-jackpot/90 text-text-inverse font-black uppercase tracking-wider px-6 py-3 rounded-xl transform hover:-translate-y-1 transition-all shadow-[0_4px_0_0_#b38b00]">
                        <Play size={20} fill="black" />
                        Play Now
                    </button>

                    {/* Pagination/Dots Mock */}
                    <div className="flex gap-2 mt-8">
                        <div className="w-8 h-1 bg-brand-gold rounded-full"></div>
                        <div className="w-2 h-1 bg-white/30 rounded-full hover:bg-white cursor-pointer"></div>
                        <div className="w-2 h-1 bg-white/30 rounded-full hover:bg-white cursor-pointer"></div>
                    </div>
                </div>
            </div>

            {/* Decorative Overlay */}
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none"></div>
        </div>
    );
};

export default Hero;
