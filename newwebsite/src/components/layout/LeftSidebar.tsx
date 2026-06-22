"use client";

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import {
    Gamepad2, Trophy, Dices, Crown, Home,
    Zap, Users, Gift,
    ChevronRight, ChevronDown,
    MonitorPlay, Tv, Star, Disc, Gem,
    HelpCircle, Shield, Lock, FileText, BookOpen, MessageCircle, Sparkles,
    Swords, Flame
} from 'lucide-react';
import { casinoService } from '@/services/casino';
import { useLayout } from '@/context/LayoutContext';
import { useAuth } from '@/context/AuthContext';

// ── Premium v2 motion tokens (transform/opacity/colors only, custom ease-out) ──
const V2_EASE = 'ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none';
const ORANGE_PILL = 'linear-gradient(135deg,#ff9a3d,#ff6a00)';
const ORANGE_RING = 'inset 0 0 0 1.5px rgba(255,122,26,0.7)';

interface Category {
    id: string;
    name: string;
    path: string;
}

interface LeftSidebarProps {
    selectedSportId?: string | null;
    onSelectSport?: (id: string | null) => void;
    activeTab?: 'live' | 'line';
    onTabChange?: (tab: 'live' | 'line') => void;
    collapsedOnly?: boolean;
}

const getCasinoIcon = (id: string) => {
    if (id.includes('slots')) return <Dices size={13} />;
    if (id.includes('table')) return <Gamepad2 size={13} />;
    if (id.includes('original')) return <Star size={13} />;
    return <Dices size={13} />;
};

const getLiveIcon = (id: string) => {
    if (id.includes('blackjack')) return <Dices size={13} />;
    if (id.includes('roulette')) return <Disc size={13} />;
    if (id.includes('baccarat')) return <Gem size={13} />;
    if (id.includes('show')) return <Tv size={13} />;
    return <MonitorPlay size={13} />;
};

const SR_SPORTS: { id: string; emoji: string; label: string }[] = [
    { id: 'sr:sport:1',   emoji: '⚽', label: 'Soccer' },
    { id: 'sr:sport:21',  emoji: '🏏', label: 'Cricket' },
    { id: 'sr:sport:2',   emoji: '🏀', label: 'Basketball' },
    { id: 'sr:sport:5',   emoji: '🎾', label: 'Tennis' },
    { id: 'sr:sport:16',  emoji: '🏈', label: 'American Football' },
    { id: 'sr:sport:3',   emoji: '⚾', label: 'Baseball' },
    { id: 'sr:sport:4',   emoji: '🏒', label: 'Ice Hockey' },
    { id: 'sr:sport:117', emoji: '🥊', label: 'MMA' },
    { id: 'sr:sport:12',  emoji: '🏉', label: 'Rugby Union' },
    { id: 'sr:sport:6',   emoji: '🏉', label: 'Rugby League' },
    { id: 'sr:sport:20',  emoji: '🏓', label: 'Table Tennis' },
    { id: 'sr:sport:31',  emoji: '🏸', label: 'Badminton' },
    { id: 'sr:sport:23',  emoji: '🏐', label: 'Volleyball' },
    { id: 'sr:sport:19',  emoji: '🎱', label: 'Snooker' },
    { id: 'sr:sport:22',  emoji: '🎯', label: 'Darts' },
    { id: 'sr:sport:29',  emoji: '⚽', label: 'Futsal' },
    { id: 'sr:sport:138', emoji: '🤸', label: 'Kabaddi' },
    { id: 'sr:sport:7',   emoji: '⛳', label: 'Golf' },
    { id: 'sr:sport:9',   emoji: '🏎️', label: 'Motor Sports' },
    { id: 'sr:sport:14',  emoji: '🎮', label: 'Esports' },
    { id: 'sr:sport:17',  emoji: '🏊', label: 'Swimming' },
    { id: 'sr:sport:32',  emoji: '🥋', label: 'Boxing' },
];

// ── Sub-item row (casino / live categories / sports) ─────────────────────────
function SubItem({
    href,
    label,
    active,
    accent = 'gold',
    icon,
    emoji,
    onClick,
}: {
    href: string;
    label: string;
    active: boolean;
    accent?: 'gold' | 'red';
    icon?: React.ReactNode;
    emoji?: string;
    onClick?: () => void;
}) {
    const isRed = accent === 'red';
    const activeAccentDot = isRed ? 'bg-danger' : 'bg-[#ff7a1a]';
    const activeIconStyle = isRed
        ? { background: 'linear-gradient(135deg,#ff5d5d,#d61f1f)', color: '#fff' }
        : { background: ORANGE_PILL, color: '#fff' };

    return (
        <Link
            href={href}
            onClick={onClick}
            className={`group ml-1.5 flex items-center gap-2 rounded-lg px-2 py-[7px] text-[11px] leading-none outline-none transition-colors duration-200 ${V2_EASE} active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-1 ${
                isRed ? 'focus-visible:ring-danger/70' : 'focus-visible:ring-[#ff7a1a]/70'
            } ${
                active
                    ? (isRed
                        ? 'bg-gradient-to-r from-danger-primary/18 to-transparent text-white'
                        : 'bg-gradient-to-r from-[#ff7a1a]/18 to-transparent text-white')
                    : 'text-text-secondary hover:bg-white/[0.05] hover:text-white'
            }`}
        >
            {emoji ? (
                <span
                    className={`flex h-6 w-6 items-center justify-center rounded-md text-[13px] flex-shrink-0 transition-colors duration-200 ${active ? '' : 'bg-white/[0.06] group-hover:bg-white/12'}`}
                    style={active ? activeIconStyle : undefined}
                >
                    {emoji}
                </span>
            ) : (
                <span
                    className={`flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0 transition-colors duration-200 ${active ? '' : 'bg-white/[0.06] text-white/50 group-hover:bg-white/12 group-hover:text-white/80'}`}
                    style={active ? activeIconStyle : undefined}
                >
                    {icon}
                </span>
            )}
            <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
            {active
                ? <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${activeAccentDot}`} />
                : <ChevronRight size={10} className="text-white/20 flex-shrink-0 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 motion-reduce:transition-none motion-reduce:translate-x-0" />
            }
        </Link>
    );
}

// ── Sports list ───────────────────────────────────────────────────────────────
function DesktopSportsList({ selectedSportId, pathname, onSelectSport }: {
    selectedSportId?: string | null;
    pathname: string;
    onSelectSport?: (id: string) => void;
}) {
    const [showAll, setShowAll] = useState(false);
    const INITIAL_COUNT = 10;
    const displayedSr = useMemo(() => showAll ? SR_SPORTS : SR_SPORTS.slice(0, INITIAL_COUNT), [showAll]);
    const isAllPage = pathname === '/sports';

    return (
        <div className="space-y-0.5">
            <SubItem href="/sports" label="All Sports" emoji="🏆" active={isAllPage} />
            {displayedSr.map((sport) => {
                const encodedId = encodeURIComponent(sport.id);
                const active = selectedSportId === sport.id || pathname.includes(encodedId + '/') || pathname.endsWith(encodedId);
                return (
                    <SubItem
                        key={`ds-${sport.id}`}
                        href={`/sports/league/${encodeURIComponent(sport.id)}`}
                        label={sport.label}
                        emoji={sport.emoji}
                        active={active}
                        onClick={() => onSelectSport?.(sport.id)}
                    />
                );
            })}
            {SR_SPORTS.length > INITIAL_COUNT && (
                <button
                    onClick={() => setShowAll(v => !v)}
                    className={`ml-1.5 flex w-[calc(100%-0.375rem)] items-center justify-between rounded-lg bg-[#ff7a1a]/[0.07] px-2.5 py-2 text-[11px] font-semibold text-[#ff7a1a]/80 outline-none transition-colors duration-200 ${V2_EASE} hover:bg-[#ff7a1a]/12 hover:text-[#ff7a1a] active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-1 focus-visible:ring-[#ff7a1a]/70`}
                >
                    <span>{showAll ? 'Show Less' : `Show All ${SR_SPORTS.length} Sports`}</span>
                    <ChevronDown size={11} className={`transition-transform duration-300 ${V2_EASE} ${showAll ? '' : '-rotate-90'}`} />
                </button>
            )}
        </div>
    );
}


// ── Main card (nav item with optional expand) ─────────────────────────────────
function NavCard({
    id, label, href, icon: Icon, iconClass, active, expandable, isOpen,
    onNavigate, onToggle, children,
}: {
    id: string; label: string; href: string;
    icon: React.ElementType; iconClass: string; active: boolean;
    expandable: boolean; isOpen: boolean;
    onNavigate: () => void; onToggle: () => void;
    children?: React.ReactNode;
}) {
    const highlighted = active || isOpen;
    return (
        <div className={`group/nav relative overflow-hidden rounded-xl transition-colors duration-200 ${V2_EASE} ${
            highlighted
                ? 'bg-gradient-to-r from-[#ff7a1a]/[0.16] via-[#ff7a1a]/[0.05] to-transparent'
                : 'hover:bg-white/[0.04]'
        }`}>
            {/* left orange accent bar on active/open */}
            <span
                className={`pointer-events-none absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity duration-200 ${highlighted ? 'opacity-100' : 'opacity-0'}`}
                style={{ background: ORANGE_PILL, boxShadow: '0 0 10px rgba(255,122,26,0.55)' }}
            />
            <div className="flex items-center gap-2.5 px-2.5 py-2">
                <Link
                    href={href}
                    onClick={onNavigate}
                    className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg outline-none transition-transform duration-200 ${V2_EASE} active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-1 focus-visible:ring-[#ff7a1a]/70`}
                >
                    <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 transition-colors duration-200 ${
                            highlighted ? 'text-white shadow-[0_6px_16px_-7px_rgba(255,106,0,0.85)]' : 'bg-white/[0.05] text-white/55 group-hover/nav:bg-white/[0.09] group-hover/nav:text-white/80'
                        }`}
                        style={highlighted ? { background: ORANGE_PILL } : undefined}
                    >
                        <Icon size={15} strokeWidth={2.2} />
                    </span>
                    <span className={`truncate text-[12.5px] font-semibold tracking-[-0.01em] transition-colors duration-200 ${highlighted ? 'text-white' : 'text-white/70 group-hover/nav:text-white'}`}>
                        {label}
                    </span>
                </Link>

                {expandable ? (
                    <button
                        type="button"
                        onClick={onToggle}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 outline-none transition-colors duration-200 ${V2_EASE} active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-1 focus-visible:ring-[#ff7a1a]/70 ${
                            isOpen ? 'text-[#ff7a1a]' : 'text-white/35 hover:text-[#ff7a1a]'
                        }`}
                        aria-label={`Toggle ${label}`}
                        aria-expanded={isOpen}
                    >
                        <ChevronDown size={13} strokeWidth={2.4} className={`transition-transform duration-300 ${V2_EASE} ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                ) : (
                    <ChevronRight size={13} strokeWidth={2.4} className={`mr-1 flex-shrink-0 transition-all duration-200 ${V2_EASE} motion-reduce:transition-none ${
                        active ? 'text-[#ff7a1a] opacity-100' : 'text-white/25 opacity-0 -translate-x-1 group-hover/nav:opacity-100 group-hover/nav:translate-x-0'
                    }`} />
                )}
            </div>

            {expandable && isOpen && (
                <div className="px-1.5 pb-2 pt-0">
                    <div className="mx-1.5 mb-1.5 h-px bg-white/[0.06]" />
                    {children}
                </div>
            )}
        </div>
    );
}

// ── Utility row (inside big card) ────────────────────────────────────────────
function UtilityCard({
    href, label, icon: Icon, iconClass, active, badge, onNavigate,
}: {
    href: string; label: string;
    icon: React.ElementType; iconClass: string; active: boolean;
    badge?: string; onNavigate: () => void;
}) {
    return (
        <Link
            href={href}
            onClick={onNavigate}
            className={`group/util flex items-center gap-2.5 rounded-lg px-2.5 py-2 outline-none transition-colors duration-200 ${V2_EASE} active:scale-[0.98] motion-reduce:transform-none focus-visible:ring-1 focus-visible:ring-[#ff7a1a]/70 ${
                active
                    ? 'bg-gradient-to-r from-[#ff7a1a]/14 to-transparent text-white'
                    : 'text-white/70 hover:bg-white/[0.05] hover:text-white'
            }`}
        >
            <span className={`flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0 transition-colors duration-200 ${iconClass}`}>
                <Icon size={12} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium tracking-[-0.01em]">{label}</span>
            {badge ? (
                <span className="flex items-center gap-1 rounded-full bg-success-primary/90 px-1.5 py-px text-[8px] font-black uppercase text-text-inverse flex-shrink-0 leading-none">
                    <span className="h-1 w-1 rounded-full bg-white animate-pulse motion-reduce:animate-none" />
                    {badge}
                </span>
            ) : (
                <ChevronRight size={10} className={`flex-shrink-0 transition-all duration-200 ${V2_EASE} motion-reduce:transition-none ${active ? 'text-[#ff7a1a] opacity-100' : 'text-white/20 opacity-0 -translate-x-1 group-hover/util:opacity-100 group-hover/util:translate-x-0'}`} />
            )}
        </Link>
    );
}

// ── Inner sidebar ─────────────────────────────────────────────────────────────
function LeftSidebarWithSearchParams({ selectedSportId, onSelectSport, collapsedOnly = false }: LeftSidebarProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentCategory = searchParams.get('category');

    const { user } = useAuth();
    const fantasyAllowed = !!user;

    const [activeRailItem, setActiveRailItem] = useState<string>('casino');
    const [isSubRailOpen, setIsSubRailOpen] = useState(!collapsedOnly);
    const [casinoCategories, setCasinoCategories] = useState<Category[]>([]);
    const [liveCategories, setLiveCategories] = useState<Category[]>([]);
    const [dailyRewardsHidden, setDailyRewardsHidden] = useState(false);

    useEffect(() => {
        fetch('/api/daily-checkin/config', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => { if (d?.hidden === true) setDailyRewardsHidden(true); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                try {
                    const catRes = await fetch('/api/sidebar-categories');
                    if (catRes.ok) {
                        const { categories } = await catRes.json();
                        if (Array.isArray(categories) && categories.length > 0) {
                            setCasinoCategories(categories.slice(0, 8).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name, path: `/casino?category=${c.id}` })));
                        } else throw new Error('empty');
                    } else throw new Error('api-unavailable');
                } catch {
                    try {
                        const cats = await casinoService.getCategories('casino');
                        if (cats && Array.isArray(cats)) {
                            setCasinoCategories(
                                cats.map((c: string | { id: string; name?: string }) => {
                                    const name = typeof c === 'string' ? c : c.name || c.id || 'Category';
                                    const id = typeof c === 'string' ? c : c.id;
                                    return { id, name, path: `/casino?category=${id}` };
                                }).filter((c: Category) => c.id !== 'live').slice(0, 8)
                            );
                        } else throw new Error('no-cats');
                    } catch {
                        setCasinoCategories([
                            { id: 'slots',     name: 'Slots',       path: '/casino?category=slots' },
                            { id: 'live',      name: 'Live Casino', path: '/casino?category=live' },
                            { id: 'table',     name: 'Table Games', path: '/casino?category=table' },
                            { id: 'crash',     name: 'Crash',       path: '/casino?category=crash' },
                            { id: 'originals', name: 'Originals',   path: '/casino?category=originals' },
                            { id: 'popular',   name: 'Popular',     path: '/casino?category=popular' },
                            { id: 'new',       name: 'New Games',   path: '/casino?category=new' },
                            { id: 'jackpot',   name: 'Jackpot',     path: '/casino?category=jackpot' },
                        ]);
                    }
                }
                try {
                    const liveCats = await casinoService.getCategories('live');
                    if (liveCats && Array.isArray(liveCats)) {
                        setLiveCategories(liveCats.map((c: string | { id: string; name?: string }) => {
                            const name = typeof c === 'string' ? c : c.name || c.id || 'Category';
                            const id = typeof c === 'string' ? c : c.id;
                            return { id, name, path: `/live-dealers?category=${id}` };
                        }));
                    } else throw new Error('no-live');
                } catch {
                    setLiveCategories([
                        { id: 'blackjack', name: 'Blackjack',  path: '/live-dealers?category=blackjack' },
                        { id: 'roulette',  name: 'Roulette',   path: '/live-dealers?category=roulette' },
                        { id: 'baccarat',  name: 'Baccarat',   path: '/live-dealers?category=baccarat' },
                        { id: 'shows',     name: 'Game Shows', path: '/live-dealers?category=shows' },
                    ]);
                }
            } catch (e) { console.error('Sidebar fetch error', e); }
        };
        fetchData();
    }, []);

    useEffect(() => {
        let newItem = activeRailItem;
        let shouldClose = false;
        if (pathname === '/') { newItem = 'home'; shouldClose = true; }
        else if (pathname.includes('/odd69-games')) { newItem = 'originals'; shouldClose = true; }
        else if (pathname.includes('/casino') && !pathname.includes('type=live')) newItem = 'casino';
        else if (pathname.includes('/live-dealers') || (pathname.includes('/casino') && pathname.includes('type=live'))) newItem = 'live';
        else if (pathname.includes('/sports') || selectedSportId) newItem = 'sports';
        else if (pathname.includes('/fantasy')) { newItem = 'fantasy'; shouldClose = true; }
        else if (pathname.includes('/promotions')) newItem = 'promotions';
        else if (pathname.includes('/daily-rewards')) newItem = 'daily-rewards';
        else if (pathname.includes('/vip')) newItem = 'vip';
        else if (pathname.includes('/referral')) newItem = 'referral';
        else if (pathname.includes('/support') || pathname.includes('/fairness') || pathname.includes('/legal')) newItem = 'support';

        if (newItem !== activeRailItem) {
            setTimeout(() => {
                setActiveRailItem(newItem);
                if (shouldClose || collapsedOnly) setIsSubRailOpen(false);
                else if (newItem !== 'home' && !isSubRailOpen) setIsSubRailOpen(true);
            }, 0);
        } else if ((newItem === 'home' || collapsedOnly) && isSubRailOpen) {
            setTimeout(() => setIsSubRailOpen(false), 0);
        }
    }, [pathname, selectedSportId, activeRailItem, isSubRailOpen, collapsedOnly]);

    const [openDesktopSection, setOpenDesktopSection] = useState<string | null>('casino');
    useEffect(() => {
        if (collapsedOnly) return;
        if (['casino', 'sports', 'live'].includes(activeRailItem)) setOpenDesktopSection(activeRailItem);
        else if (activeRailItem === 'home') setOpenDesktopSection(null);
    }, [activeRailItem, collapsedOnly]);

    const { isMobileSidebarOpen, closeMobileSidebar, isIconRail } = useLayout();
    useEffect(() => { closeMobileSidebar(); }, [pathname, closeMobileSidebar]);

    // ── Sub-content renderer ──────────────────────────────────────────────────
    const [showAllCasino, setShowAllCasino] = useState(false);
    const CASINO_INITIAL = 10;
    const displayedCasino = useMemo(
        () => showAllCasino ? casinoCategories : casinoCategories.slice(0, CASINO_INITIAL),
        [showAllCasino, casinoCategories]
    );

    const renderExpanded = (sectionId: string) => {
        if (sectionId === 'casino') {
            return (
                <div className="space-y-0.5">
                    {displayedCasino.map((cat) => (
                        <SubItem
                            key={`dc-${cat.id}`}
                            href={`/casino?category=${cat.id}`}
                            label={cat.name}
                            icon={getCasinoIcon(cat.id)}
                            active={pathname === '/casino' && currentCategory === cat.id}
                        />
                    ))}
                    {casinoCategories.length > CASINO_INITIAL && (
                        <button
                            onClick={() => setShowAllCasino(v => !v)}
                            className={`ml-1.5 flex w-[calc(100%-0.375rem)] items-center justify-between rounded-lg bg-[#ff7a1a]/[0.07] px-2.5 py-2 text-[11px] font-semibold text-[#ff7a1a]/80 outline-none transition-colors duration-200 ${V2_EASE} hover:bg-[#ff7a1a]/12 hover:text-[#ff7a1a] active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-1 focus-visible:ring-[#ff7a1a]/70`}
                        >
                            <span>{showAllCasino ? 'Show Less' : `Show All ${casinoCategories.length} Categories`}</span>
                            <ChevronDown size={11} className={`transition-transform duration-300 ${V2_EASE} ${showAllCasino ? '' : '-rotate-90'}`} />
                        </button>
                    )}
                    <SubItem
                        href="/casino"
                        label="View All Casino"
                        icon={<ChevronRight size={10} />}
                        active={pathname === '/casino' && !currentCategory}
                    />
                </div>
            );
        }
        if (sectionId === 'sports') {
            return <DesktopSportsList selectedSportId={selectedSportId} pathname={pathname} onSelectSport={onSelectSport ?? undefined} />;
        }
        if (sectionId === 'live') {
            // Static categories always shown first
            const STATIC_LIVE = [
                { id: 'all',        name: 'All Games',  path: '/live-dealers' },
                { id: 'roulette',   name: 'Roulette',   path: '/live-dealers?category=roulette' },
                { id: 'blackjack',  name: 'Blackjack',  path: '/live-dealers?category=blackjack' },
                { id: 'baccarat',   name: 'Baccarat',   path: '/live-dealers?category=baccarat' },
                { id: 'game_shows', name: 'Game Shows', path: '/live-dealers?category=game_shows' },
                { id: 'poker',      name: 'Poker',      path: '/live-dealers?category=poker' },
            ];
            // Merge in any extra dynamic categories not already in static list
            const staticIds = new Set(STATIC_LIVE.map(c => c.id));
            const extraDynamic = liveCategories.filter(c => !staticIds.has(c.id));
            const allLiveCats = [...STATIC_LIVE, ...extraDynamic];
            return (
                <div className="space-y-0.5">
                    {allLiveCats.map((cat) => {
                        const isActive = cat.id === 'all'
                            ? pathname === '/live-dealers' && !currentCategory
                            : pathname === '/live-dealers' && currentCategory === cat.id;
                        return (
                            <SubItem
                                key={`dl-${cat.id}`}
                                href={cat.path}
                                label={cat.name}
                                icon={getLiveIcon(cat.id)}
                                accent="red"
                                active={isActive}
                            />
                        );
                    })}
                </div>
            );
        }
        return null;
    };

    // ── Icon rail ─────────────────────────────────────────────────────────────
    if (collapsedOnly || isIconRail) {
        return (
            <>
                {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 md:hidden" onClick={closeMobileSidebar} />}
                <aside className="hidden md:flex md:sticky md:top-[64px] h-[calc(100vh-64px)] flex-shrink-0 border-r border-white/[0.04] bg-bg-section/80 backdrop-blur-md" style={{ width: 60 }}>
                    <div className="flex w-full flex-col items-center gap-1.5 overflow-y-auto px-2 py-3 scrollbar-none">
                        <Link href="/" className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-[0_5px_14px_-4px_rgba(255,106,0,0.8)] outline-none transition-transform duration-200 ${V2_EASE} hover:-translate-y-0.5 active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-1 focus-visible:ring-[#ff7a1a]/70`} style={{ background: ORANGE_PILL }} title="ODD69">
                            <Sparkles size={16} strokeWidth={2.4} />
                        </Link>
                        {[
                            { href: '/',             label: 'Home',   icon: Home,        active: pathname === '/',               onClick: () => { setActiveRailItem('home'); setIsSubRailOpen(false); } },
                            { href: '/casino',       label: 'Casino', icon: Gamepad2,    active: activeRailItem === 'casino',    onClick: () => { setActiveRailItem('casino'); setIsSubRailOpen(true); } },
                            { href: '/sports',       label: 'Sports', icon: Trophy,      active: activeRailItem === 'sports',    onClick: () => { setActiveRailItem('sports'); setIsSubRailOpen(true); } },
                            ...(fantasyAllowed ? [{ href: '/fantasy', label: 'Fantasy', icon: Swords, active: activeRailItem === 'fantasy', onClick: () => { setActiveRailItem('fantasy'); setIsSubRailOpen(false); } }] : []),
                            { href: '/live-dealers', label: 'Live',   icon: MonitorPlay, active: activeRailItem === 'live',      onClick: () => { setActiveRailItem('live'); setIsSubRailOpen(true); } },
                            { href: '/promotions',   label: 'Offers', icon: Zap,         active: activeRailItem === 'promotions', onClick: () => setActiveRailItem('promotions') },
                            ...(!dailyRewardsHidden ? [{ href: '/daily-rewards', label: 'Rewards', icon: Sparkles,  active: pathname.startsWith('/daily-rewards'), onClick: () => setActiveRailItem('daily-rewards') }] : []),
                            { href: '/vip',          label: 'VIP',    icon: Crown,       active: pathname.startsWith('/vip'),   onClick: () => setActiveRailItem('vip') },
                        ].map(({ href, label, icon: Icon, active, onClick }) => (
                            <Link key={href} href={href} onClick={onClick} title={label}
                                className={`group relative flex h-10 w-10 items-center justify-center rounded-xl outline-none transition-colors duration-200 ${V2_EASE} active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-1 focus-visible:ring-[#ff7a1a]/70 ${
                                    active
                                        ? 'text-white shadow-[0_6px_16px_-7px_rgba(255,106,0,0.85)]'
                                        : 'bg-white/[0.03] text-white/65 hover:bg-white/[0.08] hover:text-white'
                                }`}
                                style={active ? { background: ORANGE_PILL } : undefined}
                            >
                                <span className={`pointer-events-none absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`} style={{ background: ORANGE_PILL }} />
                                <Icon size={17} strokeWidth={2.2} />
                                <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-bg-elevated px-3 py-1.5 text-[12px] font-semibold text-white opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100 z-50">{label}</span>
                            </Link>
                        ))}
                    </div>
                </aside>
            </>
        );
    }

    // ── Full sidebar ──────────────────────────────────────────────────────────
    // "Account" group — rewards / referral / support (richer, secondary)
    const accountItems: { href: string; label: string; icon: React.ElementType; iconClass: string; active: boolean; badge?: string }[] = [
        { href: '/vip',              label: 'VIP Club',         icon: Crown,         iconClass: 'bg-[#ff7a1a]/18 text-[#ff7a1a]',          active: pathname.startsWith('/vip') },
        { href: '/referral',         label: 'Refer & Earn',     icon: Gift,          iconClass: 'bg-success-alpha-12 text-success-bright', active: pathname === '/referral' },
        { href: '/profile/referral', label: 'My Referrals',     icon: Users,         iconClass: 'bg-[#ff7a1a]/12 text-[#ff7a1a]',          active: pathname === '/profile/referral' },
    ];
    // Highlighted support row (kept separate so it reads as a "help" affordance)
    const supportItem = { href: '/support', label: 'Live Support', icon: MessageCircle, iconClass: 'bg-success-alpha-12 text-success-bright', active: pathname === '/support', badge: 'ONLINE' };
    // "More" group — help / fairness
    const moreItems: { href: string; label: string; icon: React.ElementType; iconClass: string; active: boolean; badge?: string }[] = [
        { href: '/support/help-center', label: 'Help Center',   icon: HelpCircle,    iconClass: 'bg-white/[0.06] text-white/60',           active: pathname === '/support/help-center' },
        { href: '/fairness',         label: 'Provably Fair',    icon: Shield,        iconClass: 'bg-white/[0.06] text-white/60',           active: pathname === '/fairness' },
    ];
    // Legal links — tighter, smaller, muted at the very bottom
    const legalItems: { href: string; label: string; icon: React.ElementType; active: boolean }[] = [
        { href: '/legal/privacy-policy', label: 'Privacy Policy', icon: Lock,        active: pathname === '/legal/privacy-policy' },
        { href: '/legal/terms',      label: 'Terms of Service', icon: FileText,      active: pathname === '/legal/terms' },
        { href: '/legal/rules',      label: 'Betting Rules',    icon: BookOpen,      active: pathname === '/legal/rules' },
    ];
    const utilNavigate = (href: string) => () => setActiveRailItem(
        href.includes('/referral') ? 'referral'
            : href.includes('/support') || href.includes('/fairness') || href.includes('/legal') ? 'support'
                : href.includes('/vip') ? 'vip'
                    : activeRailItem
    );

    return (
        <>
            {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 md:hidden" onClick={closeMobileSidebar} />}

            <aside className="hidden md:block md:sticky md:top-[64px] h-[calc(100vh-64px)] w-[240px] flex-shrink-0 border-r border-white/[0.04] bg-bg-section/80 backdrop-blur-md">
                <div className="h-full overflow-y-auto py-3 scrollbar-none">

                    {/* ── Logo ── */}
                    <Link href="/" className={`group flex items-center gap-3 px-4 pb-5 outline-none transition-transform duration-200 ${V2_EASE} active:scale-[0.98] motion-reduce:transform-none`}>
                        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl text-white flex-shrink-0 shadow-[0_6px_18px_-4px_rgba(255,106,0,0.7)] transition-transform duration-300 ${V2_EASE} group-hover:-translate-y-0.5 motion-reduce:transform-none`} style={{ background: ORANGE_PILL }}>
                            <Flame size={18} strokeWidth={2.4} />
                        </span>
                        <span className="text-[20px] font-black leading-none tracking-[-0.04em]">
                            <span className="text-white">ODD</span>
                            <span style={{ color: '#ff7a1a' }}>69</span>
                        </span>
                    </Link>

                    <div className="px-2.5 space-y-1">

                        {/* ── GIFT / REWARDS cards ── */}
                        <div className="grid grid-cols-2 gap-3 pb-1.5">
                            {[
                                { label: 'GIFT',    sub: 'Bonuses', icon: 'gift',   href: '/promotions', grad: 'linear-gradient(145deg,#ff8a3d 0%,#e0530a 55%,#b23a00 100%)', glow: 'radial-gradient(circle, rgba(255,138,61,0.7) 0%, transparent 68%)' },
                                { label: 'REWARDS', sub: 'VIP perks', icon: 'trophy', href: '/vip',        grad: 'linear-gradient(145deg,#ffc14d 0%,#e08a12 55%,#a85f00 100%)', glow: 'radial-gradient(circle, rgba(255,193,77,0.7) 0%, transparent 68%)' },
                            ].map((c) => (
                                <Link
                                    key={c.label}
                                    href={c.href}
                                    className={`group relative flex h-[96px] flex-col justify-end overflow-hidden rounded-2xl p-2.5 ring-1 ring-white/[0.10] outline-none transition-transform duration-300 ${V2_EASE} hover:-translate-y-0.5 active:scale-[0.97] motion-reduce:transform-none`}
                                    style={{ background: c.grad }}
                                >
                                    {/* top sheen */}
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.18] to-transparent" />
                                    {/* glow blob behind icon */}
                                    <div className="pointer-events-none absolute -right-5 -top-5 h-24 w-24 rounded-full opacity-60 blur-xl transition-opacity duration-300 group-hover:opacity-90 motion-reduce:transition-none" style={{ background: c.glow }} />
                                    {/* 3D icon, fully visible top-right */}
                                    <div className={`pointer-events-none absolute right-1 top-1 transition-transform duration-300 ${V2_EASE} group-hover:scale-110 motion-reduce:transform-none`}>
                                        <Image src={`/odd69/icons-3d/${c.icon}.png`} alt="" aria-hidden="true" width={52} height={52} style={{ width: 52, height: 52, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))' }} />
                                    </div>
                                    <span className="relative text-[13px] font-black uppercase leading-none tracking-wide text-white drop-shadow-sm">{c.label}</span>
                                    <span className="relative mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/70 leading-none">{c.sub}</span>
                                    {/* orange ring on hover/focus */}
                                    <div className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" style={{ boxShadow: ORANGE_RING }} />
                                </Link>
                            ))}
                        </div>

                        {/* ── Primary Nav ── */}
                        <p className="px-2.5 pb-1 pt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Menu</p>
                        <div className="space-y-0.5">
                            {[
                                { id: 'home',       label: 'Home',         href: '/',             icon: Home,        iconClass: 'bg-white/[0.08] text-white',             expandable: false, active: pathname === '/' },
                                { id: 'casino',     label: 'Casino',       href: '/casino',       icon: Gamepad2,    iconClass: 'bg-brand-gold/20 text-brand-gold',   expandable: true,  active: activeRailItem === 'casino' },
                                { id: 'sports',     label: 'Sports',       href: '/sports',       icon: Trophy,      iconClass: 'bg-brand-gold/20 text-brand-gold',   expandable: true,  active: activeRailItem === 'sports' },
                                ...(fantasyAllowed ? [{ id: 'fantasy', label: 'Fantasy', href: '/fantasy', icon: Swords, iconClass: 'bg-teal-500/20 text-teal-400', expandable: false, active: activeRailItem === 'fantasy' }] : []),
                                { id: 'live',       label: 'Live Dealers', href: '/live-dealers', icon: MonitorPlay, iconClass: 'bg-danger-alpha-16 text-danger',           expandable: true,  active: activeRailItem === 'live' },
                                ...(!dailyRewardsHidden ? [{ id: 'daily-rewards', label: 'Daily Rewards', href: '/daily-rewards', icon: Sparkles, iconClass: 'bg-amber-500/16 text-amber-400',       expandable: false, active: pathname.startsWith('/daily-rewards') }] : []),
                            ].map(({ id, label, href, icon, iconClass, active, expandable }) => (
                                <NavCard
                                    key={id}
                                    id={id} label={label} href={href}
                                    icon={icon} iconClass={iconClass} active={active}
                                    expandable={expandable} isOpen={openDesktopSection === id}
                                    onNavigate={() => {
                                        setActiveRailItem(id);
                                        if (expandable) setOpenDesktopSection(id);
                                        else setOpenDesktopSection(null);
                                    }}
                                    onToggle={() => setOpenDesktopSection(prev => prev === id ? null : id)}
                                >
                                    {renderExpanded(id)}
                                </NavCard>
                            ))}

                            {/* ── Promotions — standalone card with accent ── */}
                            <Link
                                href="/promotions"
                                onClick={() => { setActiveRailItem('promotions'); setOpenDesktopSection(null); }}
                                className={`group/promo relative mt-0.5 flex items-center gap-2.5 overflow-hidden rounded-xl px-2.5 py-2 ring-1 ring-[#ff7a1a]/25 outline-none transition-transform duration-200 ${V2_EASE} hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none focus-visible:ring-[1.5px] focus-visible:ring-[#ff7a1a]/70`}
                                style={{ background: 'linear-gradient(135deg, rgba(255,122,26,0.16), rgba(255,122,26,0.04))' }}
                            >
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 text-white shadow-[0_6px_16px_-7px_rgba(255,106,0,0.85)]" style={{ background: ORANGE_PILL }}>
                                    <Zap size={15} strokeWidth={2.4} />
                                </span>
                                <span className={`flex-1 truncate text-[12.5px] font-bold tracking-[-0.01em] ${activeRailItem === 'promotions' ? 'text-white' : 'text-white/90'}`}>Promotions</span>
                                <span className="rounded-full bg-[#ff7a1a]/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#ff7a1a] leading-none flex-shrink-0">Hot</span>
                            </Link>
                        </div>

                        {/* ── Account section ── */}
                        <p className="px-2.5 pb-1 pt-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Account</p>
                        <div className="space-y-0.5">
                            {accountItems.map(({ href, label, icon, iconClass, active, badge }) => (
                                <UtilityCard
                                    key={href}
                                    href={href} label={label}
                                    icon={icon} iconClass={iconClass} active={active} badge={badge}
                                    onNavigate={utilNavigate(href)}
                                />
                            ))}
                            {/* highlighted support row */}
                            <Link
                                href={supportItem.href}
                                onClick={utilNavigate(supportItem.href)}
                                className={`group/sup flex items-center gap-2.5 rounded-xl px-2.5 py-2 ring-1 outline-none transition-transform duration-200 ${V2_EASE} active:scale-[0.98] motion-reduce:transform-none focus-visible:ring-[1.5px] focus-visible:ring-[#ff7a1a]/70 ${
                                    supportItem.active ? 'ring-success-bright/40' : 'ring-success-bright/20 hover:ring-success-bright/40'
                                }`}
                                style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.03))' }}
                            >
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 bg-success-alpha-12 text-success-bright">
                                    <MessageCircle size={13} strokeWidth={2.2} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[11.5px] font-semibold tracking-[-0.01em] text-white leading-tight">Live Support</span>
                                    <span className="block text-[9px] font-medium text-success-bright/80 leading-tight">We reply in minutes</span>
                                </span>
                                <span className="flex items-center gap-1 rounded-full bg-success-primary/90 px-1.5 py-px text-[8px] font-black uppercase text-text-inverse flex-shrink-0 leading-none">
                                    <span className="h-1 w-1 rounded-full bg-white animate-pulse motion-reduce:animate-none" />
                                    {supportItem.badge}
                                </span>
                            </Link>
                        </div>

                        {/* ── More section ── */}
                        <p className="px-2.5 pb-1 pt-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">More</p>
                        <div className="space-y-0.5">
                            {moreItems.map(({ href, label, icon, iconClass, active, badge }) => (
                                <UtilityCard
                                    key={href}
                                    href={href} label={label}
                                    icon={icon} iconClass={iconClass} active={active} badge={badge}
                                    onNavigate={utilNavigate(href)}
                                />
                            ))}
                        </div>

                        {/* ── Legal links — tight, muted ── */}
                        <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-white/[0.05] px-2 pt-2.5">
                            {legalItems.map(({ href, label, icon: Icon, active }, i) => (
                                <React.Fragment key={href}>
                                    <Link
                                        href={href}
                                        onClick={utilNavigate(href)}
                                        className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[9.5px] font-medium outline-none transition-colors duration-200 ${V2_EASE} focus-visible:ring-1 focus-visible:ring-[#ff7a1a]/70 ${
                                            active ? 'text-[#ff7a1a]' : 'text-white/35 hover:text-white/70'
                                        }`}
                                    >
                                        <Icon size={9} strokeWidth={2} />
                                        {label}
                                    </Link>
                                    {i < legalItems.length - 1 && <span className="text-white/15">·</span>}
                                </React.Fragment>
                            ))}
                        </div>

                    </div>
                    <div className="h-4" />
                </div>
            </aside>
        </>
    );
}

export default function LeftSidebar(props: LeftSidebarProps) {
    return (
        <Suspense fallback={null}>
            <LeftSidebarWithSearchParams {...props} />
        </Suspense>
    );
}
