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
        <aside className="hidden md:flex flex-col w-[260px] h-[calc(100vh-60px)] bg-bg-section overflow-y-auto sticky top-[60px]">

            <div className="p-4">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 px-2">Categories</h3>
                <div className="flex flex-col gap-1">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => onSelectCategory(cat.id)}
                            className={`flex items-center justify-between px-3 py-3 rounded-lg transition-all group ${selectedCategory === cat.id
                                ? 'bg-brand-gold text-text-inverse shadow-lg shadow-glow-gold'
                                : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <cat.icon size={18} className={selectedCategory === cat.id ? 'text-text-inverse' : 'text-text-muted group-hover:text-text-primary'} />
                                <span className="font-medium text-sm">{cat.name}</span>
                                {cat.isHot && (
                                    <span className="ml-2 text-[8px] font-bold bg-gradient-to-r from-orange-500 to-red-600 text-white px-1.5 py-0.5 rounded-sm animate-pulse">
                                        HOT
                                    </span>
                                )}
                            </div>
                            <span className={`text-[10px] font-bold ${selectedCategory === cat.id ? 'text-text-inverse/80' : 'text-text-muted group-hover:text-text-muted'
                                }`}>
                                {cat.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-auto p-4 m-4 bg-gradient-to-br from-brand-gold/20 to-purple-600/20 rounded-xl relative overflow-hidden group shadow-lg">
                <div className="relative z-10">
                    <h4 className="font-bold text-text-primary mb-1">VIP Club</h4>
                    <p className="text-xs text-text-muted mb-3">Join now for exclusive rewards!</p>
                    <button className="text-xs font-bold bg-brand-gold text-text-inverse px-3 py-1.5 rounded-md hover:bg-brand-gold-hover transition-colors">
                        View Details
                    </button>
                </div>
                <div className="absolute -right-2 -bottom-2 opacity-20 group-hover:opacity-30 transition-opacity">
                    <Trophy size={60} className="text-brand-gold" />
                </div>
            </div>

        </aside>
    );
};

export default Sidebar;
