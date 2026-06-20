"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserCircle, LogOut, ChevronDown, Wallet, ChevronLeft, Menu, X } from 'lucide-react';
import { useModal } from '@/context/ModalContext';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/context/WalletContext';
import type { SubWalletType } from '@/context/WalletContext';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationBell from '@/components/NotificationBell';
import DailyCheckInButton from '@/components/DailyCheckIn/DailyCheckInButton';
import { useLayout } from '@/context/LayoutContext';
import api from '@/services/api';
import { cfImage, cfImageSrcSet } from '@/utils/cfImages';

// ── Dynamic header nav links (configurable via admin → Settings → System Config) ──
type HeaderNavLink = {
    id?: string;
    name: string;
    path: string;
    exact?: boolean;
    isHot?: boolean;
    external?: boolean;
};

const DEFAULT_HEADER_NAV_LINKS: HeaderNavLink[] = [
    { name: 'Home', path: '/', exact: true },
    { name: 'Casino', path: '/casino' },
    { name: 'Sports', path: '/sports' },
    { name: 'Fantasy', path: '/fantasy', isHot: true },
    { name: 'Live Dealers', path: '/live-dealers', isHot: true },
    { name: 'Support', path: '/support' },
];

// ── Dynamic logo ─────────────────────────────────────────────────────────────
type HeaderLogo = {
    imageUrl: string;
    text: string;
    accentText: string;
};

const DEFAULT_HEADER_LOGO: HeaderLogo = {
    imageUrl: '',
    text: 'ODD69',
    accentText: 'Ze',
};

function parseHeaderLogo(raw?: string): HeaderLogo {
    if (!raw) return DEFAULT_HEADER_LOGO;
    try {
        const parsed = JSON.parse(raw);
        return {
            imageUrl: typeof parsed?.imageUrl === 'string' ? parsed.imageUrl : '',
            text: typeof parsed?.text === 'string' && parsed.text ? parsed.text : DEFAULT_HEADER_LOGO.text,
            accentText: typeof parsed?.accentText === 'string' ? parsed.accentText : '',
        };
    } catch {
        return DEFAULT_HEADER_LOGO;
    }
}

function parseHeaderNavLinks(raw?: string): HeaderNavLink[] {
    if (!raw) return DEFAULT_HEADER_NAV_LINKS;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_HEADER_NAV_LINKS;
        return parsed
            .filter((x: any) => x && typeof x.name === 'string' && typeof x.path === 'string' && x.name && x.path)
            .map((x: any) => ({
                name: String(x.name),
                path: String(x.path),
                exact: Boolean(x.exact),
                isHot: Boolean(x.isHot),
                external: Boolean(x.external),
            }));
    } catch {
        return DEFAULT_HEADER_NAV_LINKS;
    }
}

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const { openLogin, openRegister, openDeposit } = useModal();
    const { logout, isAuthenticated, user } = useAuth();

    const {
        selectedWallet,
        selectedSubWallet,
        setSelectedSubWallet,
        fiatBalance,
        fiatCurrency,
        cryptoBalance,
        casinoBonus,
        sportsBonus,
        cryptoBonus,
        activeBalance,
    } = useWallet();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { isIconRail, toggleIconRail } = useLayout();
    const [navLinks, setNavLinks] = useState<HeaderNavLink[]>(DEFAULT_HEADER_NAV_LINKS);
    const [logo, setLogo] = useState<HeaderLogo>(DEFAULT_HEADER_LOGO);

    // Load dynamic header nav links + logo from admin-configurable SystemConfig
    useEffect(() => {
        api.get('/settings/public')
            .then((res) => {
                setNavLinks(parseHeaderNavLinks(res.data?.HEADER_NAV_LINKS));
                setLogo(parseHeaderLogo(res.data?.HEADER_LOGO));
            })
            .catch(() => {
                /* keep defaults on failure */
            });
    }, []);

    const renderLogo = () => {
        if (logo.imageUrl) {
            return (
                // Header logo is in the LCP path for many viewports; it's
                // also preloaded in layout.tsx <head>, so the browser should
                // already have the bytes in cache by the time this element
                // hydrates. fetchPriority=high ensures it's still prioritized
                // when the preload hint is missing (e.g. dev server).
                // Logo caps at ~160px wide so a 320w/480w srcset is plenty.
                <img
                    src={cfImage(logo.imageUrl, { width: 320, fit: 'contain' })}
                    srcSet={cfImageSrcSet(logo.imageUrl, [160, 320, 480], { fit: 'contain' })}
                    sizes="(max-width: 768px) 110px, 160px"
                    alt={logo.text || 'Logo'}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className="h-7 md:h-10 w-auto max-w-[110px] md:max-w-[160px] object-contain"
                />
            );
        }
        const text = logo.text || 'ODD69';
        const accent = logo.accentText || '';
        const hasAccent = accent && text.toLowerCase().startsWith(accent.toLowerCase());
        return (
            <div className="text-lg md:text-2xl font-extrabold text-white italic tracking-[-0.04em]">
                {hasAccent ? (
                    <>
                        <span className="text-brand-gold">{text.slice(0, accent.length)}</span>
                        {text.slice(accent.length)}
                    </>
                ) : (
                    text
                )}
            </div>
        );
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatFiat = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: fiatCurrency, minimumFractionDigits: 2 }).format(amount);

    const formatUSD = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);

    const formatActive = (amount: number) =>
        selectedWallet === 'crypto' ? formatUSD(amount) : formatFiat(amount);

    // ── Sub-wallet config ──────────────────────────────────────────────────────
    interface SubWalletMeta {
        id: SubWalletType;
        label: string;
        emoji: string;
        balance: number;
        note: string;
        color: 'gold' | 'purple' | 'blue' | 'green';
    }

    const fiatWallets: SubWalletMeta[] = [
        { id: 'fiat-main',   label: 'Main Wallet',  emoji: '🏦', balance: fiatBalance,  note: `${fiatCurrency} · Deposits & withdrawals`, color: 'gold' },
        { id: 'fiat-casino', label: 'Casino Bonus', emoji: '🎰', balance: casinoBonus,  note: `${fiatCurrency} · Casino play only`,        color: 'blue' },
        { id: 'fiat-sports', label: 'Sports Bonus', emoji: '⚽', balance: sportsBonus,  note: `${fiatCurrency} · Sports bets only`,        color: 'green' },
    ];

    const cryptoWallets: SubWalletMeta[] = [
        { id: 'crypto-main',   label: 'Main Wallet',  emoji: '💎', balance: cryptoBalance, note: 'USD · Crypto deposits',  color: 'purple' },
        { id: 'crypto-casino', label: 'Casino Bonus', emoji: '🎰', balance: cryptoBonus,   note: 'USD · Casino play only', color: 'blue' },
        { id: 'crypto-sports', label: 'Sports Bonus', emoji: '⚽', balance: cryptoBonus,   note: 'USD · Sports bets only', color: 'green' },
    ];

    const colorMap = {
        gold:   {
            active:  'border-brand-gold/70 shadow-glow-gold',
            dot:     'bg-brand-gold shadow-glow-gold',
            hover:   'hover:border-brand-gold/30',
            bg:      'bg-bg-hover',
            badge:   'bg-brand-gold text-text-inverse',
        },
        purple: {
            active:  'border-accent-purple/70 shadow-[0_0_10px_rgba(168,85,247,0.15)]',
            dot:     'bg-accent-purple shadow-[0_0_6px_rgba(168,85,247,0.6)]',
            hover:   'hover:border-accent-purple/30',
            bg:      'bg-accent-purple-alpha',
            badge:   'bg-accent-purple text-text-white',
        },
        blue:   {
            active:  'border-info/70 shadow-[0_0_10px_rgba(96,165,250,0.15)]',
            dot:     'bg-info border-[var(--info-primary)] shadow-[0_0_6px_rgba(96,165,250,0.6)]',
            hover:   'hover:border-info/30',
            bg:      'bg-info-soft/30',
            badge:   'bg-info text-text-white',
        },
        green:  {
            active:  'border-success-vivid/70 shadow-glow-success',
            dot:     'bg-success-vivid shadow-glow-success',
            hover:   'hover:border-success-vivid/30',
            bg:      'bg-success-soft/30',
            badge:   'bg-success text-text-white',
        },
    };

    const allWallets = [...fiatWallets, ...cryptoWallets];
    const activeMeta = allWallets.find(w => w.id === selectedSubWallet);
    const pillLabel = activeMeta?.label ?? 'Wallet';
    const pillBorder = selectedWallet === 'crypto' ? 'border-purple-500/40' : 'border-divider';
    const pillText   = selectedWallet === 'crypto' ? 'text-purple-300' : 'text-text-primary';

    // ──────────────────────────────────────────────────────────────────────────

    return (
        <header className="fixed top-0 left-0 right-0 h-[60px] md:h-[64px] z-50 flex items-center px-2.5 md:px-6 bg-[#100d0a] border-b border-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.04),0_4px_24px_rgba(0,0,0,0.4)]">
            {/* Left: Logo + Hamburger + Back */}
            <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
                {/* Hamburger — desktop only, toggles icon rail */}
                <button
                    onClick={toggleIconRail}
                    aria-label={isIconRail ? 'Expand sidebar' : 'Collapse sidebar'}
                    className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.06] text-text-secondary transition-all hover:border-brand-gold/30 hover:bg-brand-gold/8 hover:text-brand-gold"
                >
                    <motion.div
                        key={isIconRail ? 'x' : 'menu'}
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                    >
                        {isIconRail ? <X size={16} /> : <Menu size={16} />}
                    </motion.div>
                </button>

                <Link href="/" className="relative flex items-center flex-shrink-0">
                    {renderLogo()}
                </Link>

                {/* Back button — hidden on mobile */}
                {pathname !== '/' && (
                    <button
                        onClick={() => router.back()}
                        aria-label="Go back"
                        className="hidden md:flex items-center gap-1 text-text-muted hover:text-white transition-colors px-2 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06] hover:border-white/[0.12]"
                    >
                        <ChevronLeft size={18} />
                        <span className="text-xs font-bold uppercase tracking-wide">Back</span>
                    </button>
                )}
            </div>

            {/* Center: Nav */}
            <nav className="hidden lg:flex items-center gap-1 ml-8">
                {navLinks
                    .filter((item) => item.path !== '/fantasy' || !!user)
                    .map((item, idx) => {
                    const isExternal = item.external || /^https?:\/\//i.test(item.path);
                    const isActive = !isExternal && (item.exact ? pathname === item.path : pathname.startsWith(item.path));
                    const className = `text-[11px] font-semibold uppercase tracking-[0.08em] transition-all relative flex items-center gap-1 px-3.5 py-2 rounded-xl ${
                        isActive
                            ? 'text-white shadow-[0_4px_14px_rgba(255,106,0,0.35)]'
                            : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
                    }`;
                    const linkStyle = isActive
                        ? { background: 'linear-gradient(135deg,#ff9a3d,#ff6a00)' }
                        : undefined;
                    const content = (
                        <>
                            {item.name}
                            {item.isHot && (
                                <span className="text-[7px] font-black bg-gradient-to-r from-rose-500 to-orange-500 text-white px-1.5 py-0.5 rounded-full ml-0.5 absolute -top-2 -right-2 shadow-[0_0_8px_rgba(244,63,94,0.4)]">
                                    HOT
                                </span>
                            )}
                        </>
                    );
                    const key = `${item.id || item.name}-${idx}`;
                    if (isExternal) {
                        return (
                            <a
                                key={key}
                                href={item.path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={className}
                                style={linkStyle}
                            >
                                {content}
                            </a>
                        );
                    }
                    return (
                        <Link key={key} href={item.path} className={className} style={linkStyle}>
                            {content}
                        </Link>
                    );
                })}
            </nav>

            {/* Right */}
            <div className="flex items-center gap-1.5 md:gap-3 ml-auto">
                {isAuthenticated ? (
                    <div className="flex items-center gap-2">

                        {/* ── Wallet balance dropdown ── */}
                        <div className="relative" ref={dropdownRef}>
                            {/* Trigger pill */}
                            <button
                                onClick={() => setIsDropdownOpen(prev => !prev)}
                                className={`flex items-center gap-1 md:gap-1.5 bg-white/[0.06] border rounded-xl px-2 md:px-3.5 h-9 md:h-10 hover:border-brand-gold/40 hover:bg-white/[0.1] transition-all ${pillBorder}`}
                            >
                                <span className={`font-bold text-[11px] md:text-sm max-w-[72px] md:max-w-none truncate ${pillText}`}>
                                    {formatActive(activeBalance)}
                                </span>
                                <span className="hidden md:inline text-[9px] text-text-muted font-semibold uppercase tracking-wide border border-white/[0.06] rounded px-1 py-0.5">
                                    {pillLabel}
                                </span>
                                <ChevronDown
                                    size={12}
                                    className={`text-text-muted transition-transform shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            <AnimatePresence>
                                {isDropdownOpen && (
                                    <>
                                        {/* Mobile backdrop */}
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black/50 z-[99] md:hidden"
                                            onClick={() => setIsDropdownOpen(false)}
                                        />

                                        {/* Dropdown panel */}
                                        <motion.div
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.18 }}
                                            className="fixed top-[64px] md:top-[68px] left-1/2 -translate-x-1/2 w-[calc(100vw-24px)] max-w-[360px] md:absolute md:top-full md:left-auto md:right-0 md:translate-x-0 md:mt-2 md:w-80 md:max-w-none rounded-2xl md:rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden z-[100] flex flex-col border border-brand-gold/20 bg-[#1a1714]/95 backdrop-blur-xl"
                                        >
                                            {/* Wallet list – scrollable */}
                                            <div className="p-3 border-b border-brand-gold/10 overflow-y-auto max-h-[60vh] flex-1">
                                                <div className="text-[10px] text-text-muted mb-2.5 font-semibold uppercase tracking-wider">
                                                    Select Active Wallet
                                                </div>

                                                {/* ─ FIAT GROUP ─ */}
                                                <div className="mb-2">
                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                        <span className="text-[9px] font-bold uppercase tracking-widest text-brand-gold/80">🏦 Fiat Wallet</span>
                                                        <div className="flex-1 h-px bg-brand-gold/15" />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        {fiatWallets.map(w => {
                                                            const active = selectedSubWallet === w.id;
                                                            const c = colorMap[w.color];
                                                            return (
                                                                <button
                                                                    key={w.id}
                                                                    onClick={() => { setSelectedSubWallet(w.id); setIsDropdownOpen(false); }}
                                                                    className={`w-full ${c.bg} rounded-lg px-3 py-2 flex justify-between items-center transition-all border ${
                                                                        active ? c.active : `border-white/[0.04] ${c.hover}`
                                                                    }`}
                                                                >
                                                                    <div className="text-left">
                                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                                            <span className="text-sm leading-none">{w.emoji}</span>
                                                                            <span className="text-[11px] font-bold text-text-primary">{w.label}</span>
                                                                            {active && (
                                                                                <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded leading-none ${c.badge}`}>
                                                                                    ACTIVE
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-text-primary font-bold text-sm pl-[22px]">{formatFiat(w.balance)}</div>
                                                                        <div className="text-[9px] text-text-muted pl-[22px]">{w.note}</div>
                                                                    </div>
                                                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ml-2 ${active ? c.dot : 'bg-white/[0.08]'}`} />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* ─ CRYPTO GROUP ─ */}
                                                <div>
                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                        <span className="text-[9px] font-bold uppercase tracking-widest text-accent-purple/80">💎 Crypto Wallet</span>
                                                        <div className="flex-1 h-px bg-purple-500/20" />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        {cryptoWallets.map(w => {
                                                            const active = selectedSubWallet === w.id;
                                                            const c = colorMap[w.color];
                                                            return (
                                                                <button
                                                                    key={w.id}
                                                                    onClick={() => { setSelectedSubWallet(w.id); setIsDropdownOpen(false); }}
                                                                    className={`w-full ${c.bg} rounded-lg px-3 py-2 flex justify-between items-center transition-all border ${
                                                                        active ? c.active : `border-purple-500/10 ${c.hover}`
                                                                    }`}
                                                                >
                                                                    <div className="text-left">
                                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                                            <span className="text-sm leading-none">{w.emoji}</span>
                                                                            <span className="text-[11px] font-bold text-text-primary">{w.label}</span>
                                                                            {active && (
                                                                                <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded leading-none ${c.badge}`}>
                                                                                    ACTIVE
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-white font-bold text-sm pl-[22px]">{formatUSD(w.balance)}</div>
                                                                        <div className="text-[9px] text-text-muted pl-[22px]">{w.note}</div>
                                                                    </div>
                                                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ml-2 ${active ? c.dot : 'bg-white/[0.08]'}`} />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer links – static */}
                                            <div className="p-2 flex-shrink-0 border-t border-brand-gold/10 bg-brand-gold/[0.03]" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
                                                <Link
                                                    href="/profile"
                                                    onClick={() => setIsDropdownOpen(false)}
                                                    className="flex items-center gap-3 w-full p-3 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                                                >
                                                    <UserCircle size={20} className="text-brand-gold" />
                                                    <span className="font-bold text-sm">MY PROFILE</span>
                                                </Link>
                                                <button
                                                    onClick={logout}
                                                    className="flex items-center gap-3 w-full p-3 rounded hover:bg-bg-hover text-danger hover:text-danger transition-colors"
                                                >
                                                    <LogOut size={20} />
                                                    <span className="font-bold text-sm">LOGOUT</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Mobile deposit + offer icon */}
                        <div className="md:hidden flex items-center gap-1">
                            <button
                                onClick={openDeposit}
                                style={{ background: 'linear-gradient(135deg,#ff9a3d,#ff6a00)' }}
                                className="text-white font-bold h-9 px-3 rounded-xl text-[11px] uppercase transition-all hover:brightness-110 flex items-center gap-1 shadow-[0_4px_14px_rgba(255,106,0,0.35)]"
                            >
                                <Wallet size={12} />
                                <span>Deposit</span>
                            </button>
                            <DailyCheckInButton compact />
                        </div>

                        {/* Notification Bell */}
                        <NotificationBell />

                        {/* Desktop deposit + offer icon */}
                        <div className="hidden md:flex items-center gap-2">
                            <DailyCheckInButton compact />
                            <button
                                onClick={openDeposit}
                                style={{ background: 'linear-gradient(135deg,#ff9a3d,#ff6a00)' }}
                                className="text-white font-bold h-10 px-5 rounded-xl text-sm uppercase transition-all hover:brightness-110 shadow-[0_4px_14px_rgba(255,106,0,0.35)]"
                            >
                                1 CLICK DEPOSIT
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 md:gap-2">
                        <button
                            onClick={openLogin}
                            className="h-9 md:h-10 px-3.5 md:px-5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/80 text-[11px] md:text-xs font-semibold uppercase tracking-wide hover:bg-white/[0.1] hover:border-white/[0.15] hover:text-white transition-all"
                        >
                            Log In
                        </button>
                        <button
                            onClick={openRegister}
                            style={{ background: 'linear-gradient(135deg,#ff9a3d,#ff6a00)' }}
                            className="h-9 md:h-10 px-3.5 md:px-5 rounded-xl text-white text-[11px] md:text-xs font-bold uppercase tracking-wide hover:brightness-110 transition-all shadow-[0_4px_14px_rgba(255,106,0,0.35)]"
                        >
                            Register
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
