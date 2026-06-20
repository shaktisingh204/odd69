"use client";

import { casinoService } from '@/services/casino';
import React, { useState, useEffect } from 'react';
import {
    LayoutGrid, Dices, Trophy, Disc, Clapperboard,
    MonitorPlay, Spade, Gem, Video, TrendingUp
} from 'lucide-react';

interface SidebarProps {
    selectedCategory: string;
    onSelectCategory: (category: string) => void;
    context?: 'live' | 'casino';
}

const Sidebar: React.FC<SidebarProps> = ({ selectedCategory, onSelectCategory, context }) => {
    const [categories, setCategories] = useState<any[]>([]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                // Pass context to API
                const data = await casinoService.getCategories(context);
                // Map icons based on category name or id if possible, else use default LayoutGrid
                let mappedData = Array.isArray(data) ? data.map((c: any) => {
                    // Simple icon mapping logic (can be expanded)
                    let Icon = LayoutGrid;
                    const lowerName = c.name.toLowerCase();
                    let isHot = false;

                    if (lowerName.includes('slot')) Icon = Dices;
                    else if (lowerName.includes('live')) {
                        Icon = Video;
                        isHot = true; // Add HOT tag for Live Dealers
                    }
                    else if (lowerName.includes('roulette')) Icon = Disc;
                    else if (lowerName.includes('blackjack')) Icon = Spade;
                    else if (lowerName.includes('poker')) Icon = Gem;
                    else if (lowerName.includes('baccarat')) Icon = Clapperboard;
                    else if (lowerName.includes('crash')) Icon = TrendingUp;
                    else if (lowerName.includes('virtual')) Icon = MonitorPlay;

                    return { ...c, icon: Icon, isHot };
                }) : [];

                if (context === 'live') {
                    mappedData = mappedData.filter(c => {
                        const n = c.name.toLowerCase();
                        return n.includes('live') || n.includes('table') || n.includes('blackjack') || n.includes('roulette') || n.includes('baccarat') || n.includes('poker') || n.includes('dragon') || n.includes('andar') || n.includes('teen');
                    });
                } else if (context === 'casino') {
                    mappedData = mappedData.filter(c => {
                        const n = c.name.toLowerCase();
                        // Show slots, crash, etc. maybe hide live? Or show everything for Casino
                        return !n.includes('live');
                    });
                }


                // Backend now returns 'All Games' as the first item with correct total count
                setCategories(mappedData);
            } catch (error) {
                console.error("Failed to fetch categories", error);
            }
        };
        fetchCategories();
    }, [context]);

    return (
        <aside className="hidden md:flex flex-col w-[260px] h-[calc(100vh-60px)] bg-[#1a1510] border-r border-white/[0.06] overflow-y-auto sticky top-[60px]">

            <div className="p-4">
                <h3 className="text-[10px] font-black text-white/55 uppercase tracking-widest mb-4 px-2">Categories</h3>
                <div className="flex flex-col gap-1">
                    {categories.map((cat) => {
                        const isActive = selectedCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => onSelectCategory(cat.id)}
                                className={`flex items-center justify-between px-3 py-3 rounded-xl group transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 ${isActive
                                    ? 'bg-[#ff7a1a]/15 ring-1 ring-[#ff7a1a]/40 text-[#ff7a1a]'
                                    : 'text-white/60 hover:bg-white/[0.04] hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <cat.icon size={18} className={isActive ? 'text-[#ff7a1a]' : 'text-white/55 group-hover:text-white'} />
                                    <span className="font-semibold text-sm">{cat.name}</span>
                                    {cat.isHot && (
                                        <span className="ml-2 text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full animate-pulse motion-reduce:animate-none" style={{ background: 'linear-gradient(135deg,#ff9a3d,#ff6a00)' }}>
                                            HOT
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[10px] font-bold ${isActive ? 'text-[#ff7a1a]/80' : 'text-white/40 group-hover:text-white/55'
                                    }`}>
                                    {cat.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-auto p-4 m-4 bg-[#1f1812] ring-1 ring-white/[0.06] rounded-2xl relative overflow-hidden group transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:ring-[#ff7a1a]/30 motion-reduce:transform-none motion-reduce:transition-none">
                <div className="relative z-10">
                    <h4 className="font-bold text-white mb-1">VIP Club</h4>
                    <p className="text-xs text-white/55 mb-3">Join now for exclusive rewards!</p>
                    <button className="text-xs font-bold text-white px-3 py-1.5 rounded-lg transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100" style={{ background: 'linear-gradient(135deg,#ff9a3d,#ff6a00)' }}>
                        View Details
                    </button>
                </div>
                <div className="absolute -right-2 -bottom-2 opacity-20 group-hover:opacity-30 transition-opacity">
                    <Trophy size={60} className="text-[#ff7a1a]" />
                </div>
            </div>

        </aside>
    );
};

export default Sidebar;
