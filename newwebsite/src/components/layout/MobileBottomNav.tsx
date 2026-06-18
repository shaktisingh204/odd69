'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Menu, Trophy, Gamepad2, Tv2, MessageCircle,
    X, Home, Crown, User, Settings, LogOut,
    ChevronRight, Headphones, Gift, Send, Smile, Users, Ticket,
    HelpCircle, Shield, Lock, FileText, BookOpen, AlignJustify,
    CalendarCheck, UserCheck, Swords
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useModal } from '@/context/ModalContext';
import { useBets } from '@/context/BetContext';

function useDailyRewardsHidden() {
    const [hidden, setHidden] = useState(false);
    useEffect(() => {
        fetch('/api/daily-checkin/config', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => { if (d?.hidden === true) setHidden(true); })
            .catch(() => {});
    }, []);
    return hidden;
}

type ChatRole = 'admin' | 'mod' | 'user';

interface ChatMessage {
    id: string;
    user: string;
    content: string;
    time: string;
    role: ChatRole;
    level: number;
}

interface BottomNavItem {
    id: string;
    label: string;
    icon: React.ElementType;
    path: string;
    requiresAuth?: boolean;
}

// ─── Full-Page Menu Overlay ────────────────────────────────────────────────
function FullPageMenu({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const { user, logout } = useAuth();
    const dailyRewardsHidden = useDailyRewardsHidden();

    const sections = [
        {
            title: 'Games',
            items: [
                { label: 'Casino', icon: Gamepad2, path: '/casino', color: 'text-brand-gold' },
                { label: 'Sports', icon: Trophy, path: '/sports', color: 'text-teal-400' },
                ...(user
                    ? [{ label: 'Fantasy', icon: Swords, path: '/fantasy', color: 'text-emerald-400' }]
                    : []),
                { label: 'Live Casino', icon: Tv2, path: '/live-dealers', color: 'text-accent-purple' },
            ],
        },
        {
            title: 'Account',
            items: [
                { label: 'Profile', icon: User, path: '/profile', color: 'text-green-400' },
                { label: 'VIP Club', icon: Crown, path: '/vip', color: 'text-yellow-400' },
                { label: 'Promotions', icon: Gift, path: '/promotions', color: 'text-pink-400' },
                ...(!dailyRewardsHidden ? [{ label: 'Daily Rewards', icon: CalendarCheck, path: '/daily-rewards', color: 'text-brand-gold' }] : []),
                { label: 'Refer & Earn', icon: Users, path: '/referral', color: 'text-warning' },
                { label: 'My Referrals', icon: UserCheck, path: '/profile/referral', color: 'text-teal-400' },
                { label: 'Settings', icon: Settings, path: '/settings', color: 'text-brand-gold' },
            ],
        },
        {
            title: 'Support',
            items: [
                { label: 'Live Support', icon: Headphones, path: '/support', color: 'text-warning' },
                { label: 'Help Center', icon: HelpCircle, path: '/support/help-center', color: 'text-brand-gold' },
                { label: 'Fairness & Provably Fair', icon: Shield, path: '/fairness', color: 'text-green-400' },
            ],
        },
        {
            title: 'Legal',
            items: [
                { label: 'Privacy Policy', icon: Lock, path: '/legal/privacy-policy', color: 'text-accent-purple' },
                { label: 'Terms of Service', icon: FileText, path: '/legal/terms', color: 'text-brand-gold' },
                { label: 'Betting Rules', icon: BookOpen, path: '/legal/rules', color: 'text-brand-gold' },
            ],
        },
    ];

    const handleNav = (path: string) => {
        router.push(path);
        onClose();
    };

    return (
        <div
            className="fixed inset-x-0 top-0 z-[200] flex flex-col bg-bg-deep/95 backdrop-blur-xl animate-in slide-in-from-bottom-full duration-300"
            style={{ bottom: 'var(--mobile-nav-height)' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-safe pt-5 pb-4 border-b border-white/[0.04]">
                <span className="text-lg font-extrabold text-white uppercase tracking-tight">Menu</span>
                <button
                    onClick={onClose}
                    className="flex items-center gap-2 text-text-muted hover:text-white transition-colors bg-white/[0.04] rounded-full px-4 py-2 text-sm font-bold"
                >
                    <X size={16} />
                    Hide
                </button>
            </div>

            {/* User card */}
            {user ? (
                <div className="mx-4 mt-4 p-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-brand-gold/20 flex items-center justify-center text-brand-gold font-black text-lg">
                        {user.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-text-white font-bold text-sm truncate">{user.username}</p>
                        <p className="text-text-muted text-xs">Member</p>
                    </div>
                    <ChevronRight size={18} className="text-text-muted flex-shrink-0" />
                </div>
            ) : (
                <div className="mx-4 mt-4 flex gap-2">
                    <button
                        onClick={() => { router.push('/'); onClose(); }}
                        className="flex-1 py-3 rounded-xl border border-brand-gold text-brand-gold font-black text-sm uppercase"
                    >
                        Log In
                    </button>
                    <button
                        onClick={() => { router.push('/'); onClose(); }}
                        className="flex-1 py-3 rounded-xl bg-brand-gold text-text-inverse font-black text-sm uppercase shadow-glow-gold"
                    >
                        Register
                    </button>
                </div>
            )}

            {/* Nav Sections */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-5">
                {sections.map((section) => (
                    <div key={section.title}>
                        <p className="text-[10px] font-black text-text-muted/60 uppercase tracking-widest mb-2 px-1">
                            {section.title}
                        </p>
                        <div className="rounded-2xl overflow-hidden divide-y divide-white/[0.04] bg-white/[0.03] border border-white/[0.04]">
                            {section.items.map((item) => (
                                <button
                                    key={item.label}
                                    onClick={() => handleNav(item.path)}
                                    className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.05] transition-colors"
                                >
                                    <div className={`w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center ${item.color}`}>
                                        <item.icon size={18} />
                                    </div>
                                    <span className="text-text-white font-bold text-sm">{item.label}</span>
                                    <ChevronRight size={16} className="text-text-muted ml-auto" />
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Home shortcut */}
                <button
                    onClick={() => handleNav('/')}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-bg-elevated/40 border border-white/[0.04] hover:bg-white/[0.05] transition-colors"
                >
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center text-text-muted">
                        <Home size={18} />
                    </div>
                    <span className="text-text-white font-bold text-sm">Home</span>
                    <ChevronRight size={16} className="text-text-muted ml-auto" />
                </button>

                {/* Logout */}
                {user && (
                    <button
                        onClick={() => { logout?.(); onClose(); }}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-danger-alpha-10 border border-danger-alpha-25 hover:bg-danger-alpha-16 transition-colors"
                    >
                        <div className="w-9 h-9 rounded-xl bg-danger-alpha-10 flex items-center justify-center text-danger">
                            <LogOut size={18} />
                        </div>
                        <span className="text-danger font-bold text-sm">Log Out</span>
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Embedded Live Chat Panel ──────────────────────────────────────────────
function MobileChatPanel({ onClose }: { onClose: () => void }) {
    const { user } = useAuth();
    const [input, setInput] = useState('');
    const [onlineUsers] = useState(1243);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: '1', user: 'CryptoKing', content: 'BTC looking bullish today! 🚀', time: '5m ago', role: 'user', level: 12 },
        { id: '2', user: 'Admin', content: 'Welcome! Please be respectful.', time: '1h ago', role: 'admin', level: 99 },
        { id: '3', user: 'LuckyStriker', content: 'Just hit a 500x on Sweet Bonanza! 🍬', time: '2m ago', role: 'user', level: 5 },
        { id: '4', user: 'SpeedyGonzales', content: 'Anyone betting on the IPL game?', time: '30s ago', role: 'user', level: 8 },
    ]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || !user) return;
        setMessages(prev => [...prev, {
            id: Date.now().toString(), user: user.username || 'You',
            content: input.trim(), time: 'now', role: 'user', level: 1
        }]);
        setInput('');
    };

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-bg-deep animate-in slide-in-from-bottom-full duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-safe pt-5 pb-4 border-b border-white/[0.04] shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-alpha-20 p-2 rounded-lg text-brand-gold relative">
                        <MessageCircle size={18} />
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-success-vivid rounded-full border border-bg-deep-2 animate-pulse" />
                    </div>
                    <div>
                        <p className="text-white font-black text-sm uppercase tracking-tight">Live Chat</p>
                        <p className="text-text-white text-[10px] font-bold flex items-center gap-1">
                            <Users size={10} /> {onlineUsers.toLocaleString()} Online
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-text-muted hover:text-white transition-colors bg-white/[0.04] rounded-full p-2"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-bg-deep-4/50">
                {messages.map((msg) => (
                    <div key={msg.id} className="flex flex-col gap-0.5">
                        <div className="flex items-baseline gap-2">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${msg.role === 'admin' ? 'bg-danger-primary text-badge-win-text' : msg.role === 'mod' ? 'bg-success-primary text-badge-win-text' : 'bg-white/[0.08] text-text-muted'}`}>
                                {msg.role === 'admin' ? 'ADM' : msg.role === 'mod' ? 'MOD' : `LVL ${msg.level}`}
                            </span>
                            <span className={`text-xs font-bold ${msg.role === 'admin' ? 'text-danger' : msg.role === 'mod' ? 'text-success' : 'text-text-secondary'}`}>{msg.user}</span>
                            <span className="text-[9px] text-text-disabled ml-auto">{msg.time}</span>
                        </div>
                        <div className="bg-bg-modal p-2.5 rounded-xl rounded-tl-none border border-white/[0.04] text-[13px] text-text-primary leading-snug break-words">
                            {msg.content}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="p-3 bg-bg-deep border-t border-white/[0.04] relative pb-[env(safe-area-inset-bottom)] shrink-0">
                {!user && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-10 rounded-t-2xl">
                        <button className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-hover text-text-inverse font-black text-xs uppercase rounded-full shadow-glow-gold">
                            Login to Chat
                        </button>
                    </div>
                )}
                <form onSubmit={handleSend} className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <input
                            type="text" value={input} onChange={e => setInput(e.target.value)}
                            placeholder="Type a message..."
                            disabled={!user}
                            className="w-full bg-bg-modal text-text-primary text-sm px-4 py-3 pr-10 rounded-xl outline-none border border-white/[0.04] focus:border-brand-gold/50 transition-all placeholder:text-text-disabled"
                        />
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-brand-gold transition-colors p-1" disabled={!user}>
                            <Smile size={16} />
                        </button>
                    </div>
                    <button
                        type="submit" disabled={!input.trim() || !user}
                        className={`p-3 rounded-xl transition-all flex-shrink-0 ${input.trim() && user ? 'bg-brand-gold text-text-inverse shadow-glow-gold hover:bg-brand-gold-hover' : 'bg-white/[0.04] text-text-disabled cursor-not-allowed'}`}
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}

// ─── Main Bottom Nav ────────────────────────────────────────────────────────
export default function MobileBottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const { isAuthenticated } = useAuth();
    const { openLogin } = useModal();
    const { toggleBetslip, bets, isBetslipOpen } = useBets();
    const dailyRewardsHidden = useDailyRewardsHidden();

    const handleMenuPress = () => {
        if (menuOpen) {
            setMenuOpen(false);

            if (pathname !== '/') {
                router.push('/');
            }

            return;
        }

        setMenuOpen(true);
    };

    const isActive = (path: string) => {
        if (path === '/') return pathname === '/';
        return pathname.startsWith(path);
    };

    const navItems: BottomNavItem[] = [
        { id: 'sports', label: 'Sports', icon: Trophy, path: '/sports' },
        { id: 'casino', label: 'Casino', icon: Gamepad2, path: '/casino' },
        { id: 'promos', label: 'Promos', icon: Gift, path: '/promotions' },
        { id: 'fantasy', label: 'Fantasy', icon: Crown, path: '/fantasy' },
        { id: 'bets', label: 'Bets', icon: AlignJustify, path: '#betslip' },
    ];

    const MenuButtonIcon = menuOpen ? Home : Menu;
    const menuButtonLabel = menuOpen ? 'Home' : 'Menu';

    const renderNavLink = (item: BottomNavItem) => {
        const isBetsTab = item.id === 'bets';
        const active = isBetsTab ? isBetslipOpen : isActive(item.path);
        const Icon = item.icon;

        const content = (
            <div className={`flex flex-col items-center justify-center flex-1 gap-1 relative transition-all h-[64px] ${active ? 'text-brand-gold' : 'text-white/40'}`}>
                {active && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-gradient-to-r from-brand-gold to-brand-gold-hover rounded-b-full shadow-[0_0_8px_rgba(139,92,246,0.02)]" />
                )}
                <div className="relative flex items-center justify-center">
                    <Icon size={21} className={active ? 'drop-shadow-[0_0_10px_rgba(139,92,246,0.08)]' : ''} />
                    {isBetsTab && bets.length > 0 && (
                        <span className="absolute -top-1.5 -right-2 bg-brand-gold text-text-inverse text-[9px] font-black h-[14px] min-w-[14px] px-0.5 rounded-full flex items-center justify-center shadow-glow-gold">
                            {bets.length}
                        </span>
                    )}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wide leading-none ${active ? 'text-brand-gold' : ''}`}>
                    {item.label}
                </span>
            </div>
        );

        if (isBetsTab) {
            return (
                <button
                    key={item.id}
                    onClick={() => {
                        if (menuOpen) setMenuOpen(false);
                        toggleBetslip();
                    }}
                    className="flex-1 flex"
                >
                    {content}
                </button>
            );
        }

        return (
            <Link
                key={item.id}
                href={item.path!}
                className="flex-1 flex"
                onClick={(event) => {
                    if (item.requiresAuth && !isAuthenticated) {
                        event.preventDefault();
                        setMenuOpen(false);
                        openLogin();
                        return;
                    }
                    if (menuOpen) setMenuOpen(false);
                }}
            >
                {content}
            </Link>
        );
    };

    return (
        <>
            {menuOpen && <FullPageMenu onClose={() => setMenuOpen(false)} />}

            {/* Bottom nav bar */}
            <nav
                className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex items-stretch shadow-[0_-4px_32px_rgba(0,0,0,0.5)] border-t border-white/[0.04]"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', background: 'rgba(9, 10, 16, 0.88)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)' }}
            >
                {/* Menu */}
                <button onClick={handleMenuPress} className="flex flex-1">
                    <div className={`flex flex-1 flex-col items-center justify-center gap-1 relative transition-all h-[64px] ${menuOpen ? 'text-brand-gold' : 'text-white/40'}`}>
                        {menuOpen && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-gradient-to-r from-brand-gold to-brand-gold-hover rounded-b-full shadow-[0_0_8px_rgba(139,92,246,0.02)]" />
                        )}
                        <MenuButtonIcon size={21} className={menuOpen ? 'drop-shadow-[0_0_10px_rgba(139,92,246,0.08)]' : ''} />
                        <span className={`text-[10px] font-bold uppercase tracking-wide leading-none ${menuOpen ? 'text-brand-gold' : ''}`}>
                            {menuButtonLabel}
                        </span>
                    </div>
                </button>

                {/* Nav items */}
                {navItems.map(renderNavLink)}
            </nav>
        </>
    );
}
