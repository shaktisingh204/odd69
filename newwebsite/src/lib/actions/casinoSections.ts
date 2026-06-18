'use server';

import path from 'path';
import fs from 'fs';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'casino-sections.json');

export interface SectionConfig {
    section: string;
    label: string;
    icon: string;           // Lucide icon name, e.g. 'Flame'
    pageType: 'casino' | 'live';
    isVisible: boolean;
    isCustom: boolean;
    order: number;
}

const DEFAULT_SECTIONS: SectionConfig[] = [
    // Casino lobby
    { section: 'popular',  label: 'Hot Games',     icon: 'Flame',      pageType: 'casino', isVisible: true,  isCustom: false, order: 0  },
    { section: 'slots',    label: 'Slots',          icon: 'Dice5',      pageType: 'casino', isVisible: true,  isCustom: false, order: 1  },
    { section: 'new',      label: 'New Arrivals',   icon: 'Sparkles',   pageType: 'casino', isVisible: true,  isCustom: false, order: 2  },
    { section: 'trending', label: 'Trending Now',   icon: 'TrendingUp', pageType: 'casino', isVisible: true,  isCustom: false, order: 3  },
    { section: 'table',    label: 'Table Games',    icon: 'Coffee',     pageType: 'casino', isVisible: true,  isCustom: false, order: 4  },
    { section: 'crash',    label: 'Crash Games',    icon: 'Zap',        pageType: 'casino', isVisible: true,  isCustom: false, order: 5  },
    { section: 'top-slots',label: 'Top Slots',      icon: 'Target',     pageType: 'casino', isVisible: true,  isCustom: false, order: 6  },
    { section: 'fishing',  label: 'Fishing',        icon: 'Fish',       pageType: 'casino', isVisible: true,  isCustom: false, order: 7  },
    { section: 'arcade',   label: 'Arcade',         icon: 'Gamepad2',   pageType: 'casino', isVisible: true,  isCustom: false, order: 8  },
    { section: 'virtual',  label: 'Virtual Sports', icon: 'Trophy',     pageType: 'casino', isVisible: true,  isCustom: false, order: 9  },
    { section: 'exclusive',label: 'Exclusive',      icon: 'Star',       pageType: 'casino', isVisible: true,  isCustom: false, order: 10 },
    { section: 'top',      label: 'Top Picks',      icon: 'Crown',      pageType: 'casino', isVisible: true,  isCustom: false, order: 11 },
    // Live casino
    { section: 'live',     label: 'Popular Live',   icon: 'PlayCircle', pageType: 'live',   isVisible: true,  isCustom: false, order: 0  },
    { section: 'roulette', label: 'Live Roulette',  icon: 'Circle',     pageType: 'live',   isVisible: true,  isCustom: false, order: 1  },
    { section: 'blackjack',label: 'Live Blackjack', icon: 'Layers',     pageType: 'live',   isVisible: true,  isCustom: false, order: 2  },
    { section: 'baccarat', label: 'Live Baccarat',  icon: 'Coffee',     pageType: 'live',   isVisible: true,  isCustom: false, order: 3  },
    { section: 'shows',    label: 'Game Shows',     icon: 'Tv',         pageType: 'live',   isVisible: true,  isCustom: false, order: 4  },
    { section: 'poker',    label: 'Live Poker',     icon: 'Gamepad2',   pageType: 'live',   isVisible: true,  isCustom: false, order: 5  },
];

function readConfig(): SectionConfig[] {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch { /* fallthrough */ }
    return DEFAULT_SECTIONS;
}

export async function getCasinoSections(limit?: number): Promise<SectionConfig[]> {
    const all = readConfig()
        .filter(s => s.pageType === 'casino' && s.isVisible)
        .sort((a, b) => a.order - b.order);
    return limit ? all.slice(0, limit) : all;
}

export async function getLiveSections(limit?: number): Promise<SectionConfig[]> {
    const all = readConfig()
        .filter(s => s.pageType === 'live' && s.isVisible)
        .sort((a, b) => a.order - b.order);
    return limit ? all.slice(0, limit) : all;
}

export async function getAllSections(): Promise<SectionConfig[]> {
    return readConfig().sort((a, b) => {
        if (a.pageType !== b.pageType) return a.pageType === 'casino' ? -1 : 1;
        return a.order - b.order;
    });
}

export async function saveSectionConfigs(sections: SectionConfig[]): Promise<{ ok: boolean }> {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(sections, null, 2), 'utf-8');
        return { ok: true };
    } catch {
        return { ok: false };
    }
}
