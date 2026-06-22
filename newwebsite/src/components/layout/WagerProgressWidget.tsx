'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Wallet } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';

const STORAGE_KEY = 'wagerWidget:v1';
const HIDDEN_KEY = 'wagerWidget:hidden';
const MARGIN = 16;

type Saved = { x: number; y: number; collapsed: boolean };

/** Smoothly interpolates a numeric value whenever the target changes. */
function useAnimatedNumber(target: number, duration = 700) {
    const [val, setVal] = useState(target);
    const fromRef = useRef(target);
    const startRef = useRef<number | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        fromRef.current = val;
        startRef.current = null;
        const tick = (t: number) => {
            if (startRef.current == null) startRef.current = t;
            const p = Math.min(1, (t - startRef.current) / duration);
            // easeOutCubic
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(fromRef.current + (target - fromRef.current) * eased);
            if (p < 1) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target, duration]);

    return val;
}

const fmtCompact = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_00_00_000) return (n / 1_00_00_000).toFixed(2).replace(/\.?0+$/, '') + 'Cr';
    if (abs >= 1_00_000) return (n / 1_00_000).toFixed(2).replace(/\.?0+$/, '') + 'L';
    if (abs >= 1_000) return (n / 1_000).toFixed(2).replace(/\.?0+$/, '') + 'K';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n));
};

export default function WagerProgressWidget() {
    const { token } = useAuth();
    const {
        depositWageringRequired,
        depositWageringDone,
        activeSymbol,
    } = useWallet();

    const ref = useRef<HTMLDivElement>(null);
    const [x, setX] = useState<number>(0);
    const [y, setY] = useState<number>(0);
    const [isMobile, setIsMobile] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [ready, setReady] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [hiddenWagerSnapshot, setHiddenWagerSnapshot] = useState<number>(0);
    const dragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number; moved: boolean } | null>(null);

    // Load persisted state + detect mobile
    useEffect(() => {
        const mobile = window.innerWidth < 640;
        setIsMobile(mobile);
        try {
            const savedHidden = localStorage.getItem(HIDDEN_KEY);
            if (savedHidden) {
                const parsed = JSON.parse(savedHidden);
                setHidden(true);
                setHiddenWagerSnapshot(parsed.wagerDone || 0);
            }
        } catch {}
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const s: Saved = JSON.parse(raw);
                if (typeof s.x === 'number') setX(s.x);
                if (typeof s.y === 'number') setY(s.y);
                if (typeof s.collapsed === 'boolean') setCollapsed(s.collapsed);
            } else {
                setX(window.innerWidth - (mobile ? 110 : 150) - MARGIN);
                setY(Math.max(MARGIN, Math.round(window.innerHeight * 0.45)));
            }
        } catch {}
        setReady(true);
        requestAnimationFrame(() => setMounted(true));
    }, []);

    const persist = useCallback(
        (next: Partial<Saved>) => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                const cur: Saved = raw ? JSON.parse(raw) : { x, y, collapsed };
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...next }));
            } catch {}
        },
        [x, y, collapsed],
    );

    // Clamp on resize + detect mobile
    useEffect(() => {
        const onResize = () => {
            const el = ref.current;
            if (!el) return;
            const w = el.offsetWidth;
            const h = el.offsetHeight;
            const maxX = window.innerWidth - w - MARGIN;
            const maxY = window.innerHeight - h - MARGIN;
            setX((prev) => Math.min(Math.max(MARGIN, prev), Math.max(MARGIN, maxX)));
            setY((prev) => Math.min(Math.max(MARGIN, prev), Math.max(MARGIN, maxY)));
            setIsMobile(window.innerWidth < 640);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Drag handlers (X + Y)
    const onPointerDown = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('[data-nodrag]')) return;
        const el = ref.current;
        if (!el) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = { startX: e.clientX, startY: e.clientY, startLeft: x, startTop: y, moved: false };
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
        const el = ref.current;
        if (!el) return;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const maxX = window.innerWidth - w - MARGIN;
        const maxY = window.innerHeight - h - MARGIN;
        setX(Math.min(Math.max(MARGIN, d.startLeft + dx), Math.max(MARGIN, maxX)));
        setY(Math.min(Math.max(MARGIN, d.startTop + dy), Math.max(MARGIN, maxY)));
    };

    const onPointerUp = (e: React.PointerEvent) => {
        const d = dragRef.current;
        dragRef.current = null;
        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}
        if (d) persist({ x, y });
        if (d && !d.moved && collapsed) {
            const expandedW = isMobile ? 260 : 300;
            const expandedH = 280;
            const clampedX = Math.min(Math.max(MARGIN, x), Math.max(MARGIN, window.innerWidth - expandedW - MARGIN));
            const clampedY = Math.min(Math.max(MARGIN, y), Math.max(MARGIN, window.innerHeight - expandedH - MARGIN));
            setX(clampedX);
            setY(clampedY);
            setCollapsed(false);
            persist({ x: clampedX, y: clampedY, collapsed: false });
        }
    };

    // animated values (must be called unconditionally)
    const pctTarget = depositWageringRequired > 0
        ? Math.min(100, (depositWageringDone / depositWageringRequired) * 100)
        : 0;
    const remainingTarget = Math.max(0, depositWageringRequired - depositWageringDone);
    const animatedPct = useAnimatedNumber(pctTarget);
    const animatedRemaining = useAnimatedNumber(remainingTarget);

    const hideWidget = useCallback(() => {
        setHidden(true);
        setHiddenWagerSnapshot(depositWageringDone);
        localStorage.setItem(HIDDEN_KEY, JSON.stringify({ wagerDone: depositWageringDone }));
    }, [depositWageringDone]);

    // Auto-show when wagering progress changes (new payment success moves wagerDone)
    useEffect(() => {
        if (hidden && depositWageringDone !== hiddenWagerSnapshot) {
            setHidden(false);
            localStorage.removeItem(HIDDEN_KEY);
        }
    }, [hidden, depositWageringDone, hiddenWagerSnapshot]);

    if (!ready) return null;
    if (!token) return null;
    if (!(depositWageringRequired > 0)) return null;
    if (depositWageringDone >= depositWageringRequired) return null;
    if (hidden) return null;

    return (
        <>
            <style jsx>{`
                @keyframes wagerSlideIn {
                    from {
                        opacity: 0;
                        transform: translateX(40px) scale(0.96);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                }
                @keyframes wagerShimmer {
                    0% {
                        transform: translateX(-120%);
                    }
                    100% {
                        transform: translateX(220%);
                    }
                }
                @keyframes wagerPulse {
                    0%,
                    100% {
                        box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.6);
                    }
                    50% {
                        box-shadow: 0 0 0 6px rgba(168, 85, 247, 0);
                    }
                }
                @keyframes wagerFloat {
                    0%,
                    100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-2px);
                    }
                }
                @keyframes wagerIconGlow {
                    0%,
                    100% {
                        box-shadow: 0 4px 12px rgba(109, 40, 217, 0.55),
                            0 0 0 0 rgba(168, 85, 247, 0.4);
                    }
                    50% {
                        box-shadow: 0 4px 16px rgba(109, 40, 217, 0.75),
                            0 0 0 5px rgba(168, 85, 247, 0);
                    }
                }
                .wager-root {
                    animation: wagerSlideIn 0.45s cubic-bezier(0.2, 0.9, 0.25, 1.15) both;
                }
                .wager-card {
                    animation: wagerFloat 4.5s ease-in-out infinite;
                }
                .wager-icon {
                    animation: wagerIconGlow 2.4s ease-in-out infinite;
                }
                .wager-dot {
                    animation: wagerPulse 1.8s ease-out infinite;
                }
                .wager-bar-shine {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    width: 40%;
                    background: linear-gradient(
                        90deg,
                        transparent,
                        rgba(255, 255, 255, 0.55),
                        transparent
                    );
                    animation: wagerShimmer 2.2s ease-in-out infinite;
                    pointer-events: none;
                }
                .wager-close:hover {
                    transform: rotate(90deg);
                }
            `}</style>

            <div
                ref={ref}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{
                    position: 'fixed',
                    top: y,
                    left: x,
                    zIndex: 60,
                    touchAction: 'none',
                    userSelect: 'none',
                    cursor: dragRef.current?.moved ? 'grabbing' : 'grab',
                    opacity: mounted ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                }}
                className="wager-root select-none"
            >
                {collapsed ? (
                    isMobile ? (
                        /* Mobile collapsed: compact 50px circle */
                        <div
                            className="wager-card relative flex items-center justify-center rounded-full transition-transform hover:scale-105"
                            style={{
                                width: 50,
                                height: 50,
                                background: 'rgba(255, 255, 255, 0.10)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                boxShadow:
                                    '0 6px 20px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                            }}
                            title="Wagering Pending"
                        >
                            <div
                                className="wager-icon flex items-center justify-center rounded-full"
                                style={{
                                    width: 30,
                                    height: 30,
                                    background: 'linear-gradient(135deg, #a855f7, #e85f00)',
                                    boxShadow: '0 3px 10px rgba(255, 122, 26, 0.4)',
                                }}
                            >
                                <Wallet size={14} className="text-white" />
                            </div>
                            <span
                                className="wager-dot absolute rounded-full"
                                style={{ top: 2, right: 2, width: 6, height: 6, background: '#a855f7' }}
                            />
                        </div>
                    ) : (
                        /* Desktop collapsed */
                        <div
                            className="wager-card relative flex flex-col items-center justify-center rounded-2xl transition-transform hover:scale-[1.03]"
                            style={{
                                width: 104,
                                padding: '16px 12px 14px',
                                gap: 8,
                                background: 'rgba(255, 255, 255, 0.10)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                boxShadow:
                                    '0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                            }}
                            title="Deposit Wager Progress"
                        >
                            <div
                                className="wager-icon flex items-center justify-center rounded-full"
                                style={{
                                    width: 36,
                                    height: 36,
                                    background: 'linear-gradient(135deg, #a855f7, #e85f00)',
                                    boxShadow: '0 4px 14px rgba(255, 122, 26, 0.4)',
                                }}
                            >
                                <Wallet size={18} className="text-white" />
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[11px] font-semibold text-white/90 leading-tight">
                                    Wagering
                                </span>
                                <span className="text-[11px] font-semibold text-white/90 leading-tight">
                                    Pending
                                </span>
                            </div>
                            <span
                                className="wager-dot absolute rounded-full"
                                style={{ top: 6, right: 6, width: 6, height: 6, background: '#a855f7' }}
                            />
                        </div>
                    )
                ) : (
                    // Expanded card
                    <div
                        className="wager-card relative rounded-2xl overflow-hidden"
                        style={{
                            width: isMobile ? Math.min(260, window.innerWidth - MARGIN * 2) : 300,
                            maxHeight: 'calc(100vh - 80px)',
                            overflowY: 'auto',
                            background: 'rgba(20, 25, 30, 0.98)',
                            border: '1px solid rgba(255, 255, 255, 0.10)',
                            boxShadow:
                                '0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.07)',
                            backdropFilter: 'blur(24px)',
                            WebkitBackdropFilter: 'blur(24px)',
                        }}
                    >
                        {/* Header bar */}
                        <div
                            className="flex items-center justify-between px-3 py-2"
                            style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className="wager-dot w-2 h-2 rounded-full shrink-0"
                                    style={{ background: '#a855f7' }}
                                />
                                <span className={`${isMobile ? 'text-[11px]' : 'text-[12px]'} font-bold text-white/90 uppercase tracking-wide`}>
                                    Wagering Pending
                                </span>
                            </div>
                            <button
                                data-nodrag
                                onClick={() => {
                                    setCollapsed(true);
                                    persist({ collapsed: true });
                                }}
                                aria-label="Minimize"
                                className="wager-close w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
                            >
                                <X size={13} />
                            </button>
                        </div>

                        {/* Center section: icon + percentage + remaining */}
                        <div className={`flex flex-col items-center gap-2 ${isMobile ? 'pt-3 pb-2 px-3' : 'pt-4 pb-3 px-4'}`}>
                            <div
                                className={`wager-icon ${isMobile ? 'w-9 h-9' : 'w-11 h-11'} rounded-full flex items-center justify-center mb-1`}
                                style={{
                                    background: 'linear-gradient(135deg, #a855f7, #e85f00)',
                                    boxShadow: '0 4px 14px rgba(255, 122, 26, 0.4)',
                                }}
                            >
                                <Wallet size={isMobile ? 16 : 20} className="text-white" />
                            </div>

                            {/* Percentage */}
                            <span className={`${isMobile ? 'text-[18px]' : 'text-[22px]'} font-extrabold text-white tabular-nums leading-tight`}>
                                {animatedPct.toFixed(1)}%
                            </span>

                            {/* Progress bar */}
                            <div className="relative w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${animatedPct}%`,
                                        background: 'linear-gradient(90deg, #a855f7, #c084fc)',
                                        boxShadow: '0 0 10px rgba(168, 85, 247, 0.6)',
                                        transition: 'width 0.3s ease-out',
                                    }}
                                />
                                <div className="wager-bar-shine" />
                            </div>

                            {/* Remaining */}
                            <div className="flex items-center justify-between w-full mt-1">
                                <span className={`${isMobile ? 'text-[10px]' : 'text-[11px]'} text-white/40`}>Remaining</span>
                                <span className={`${isMobile ? 'text-[12px]' : 'text-[13px]'} font-bold text-white tabular-nums`}>
                                    {activeSymbol}{fmtCompact(animatedRemaining)}
                                </span>
                            </div>
                        </div>

                        {/* Hide button */}
                        <button
                            data-nodrag
                            onClick={hideWidget}
                            className="w-full py-2 text-[10px] font-medium text-white/30 hover:text-white/60 transition-colors text-center"
                        >
                            Hide
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
