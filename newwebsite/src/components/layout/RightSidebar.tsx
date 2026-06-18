'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useModal } from '@/context/ModalContext';
import {
    X, ChevronUp, ChevronDown, CheckCircle, AlertCircle,
    Clock, Trash2, BookMarked, Zap, User, AlignJustify, Clipboard, Share2
} from 'lucide-react';
import { useBets } from '@/context/BetContext';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/context/WalletContext';
import SportsBetCashoutWidget from '@/components/sports/SportsBetCashoutWidget';
import { showBetErrorToast, showBetPlacedToast } from '@/utils/betToasts';
import { useEarlySixMatches } from '@/hooks/useEarlySixMatches';
import {
    getBetNetPnL,
    getBetOriginalStake,
    getBetPartialCashoutValue,
    getBetPendingMaxReturn,
    getBetSettledReturn,
    hasPartialCashout,
} from '@/utils/sportsBetDisplay';
import { isLineBasedFancyMarket } from '@/utils/sportsBetPricing';

// ─── constants ────────────────────────────────────────────────────────────────
const QUICK_STAKES = [100, 500, 1_000, 5_000];

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtOdds(odds: number, lb: boolean) {
    return lb ? String(odds) : `×${Number(odds).toFixed(2)}`;
}
function potentialProfit(stake: number, odds: number) {
    return Math.max(0, (Number(stake) || 0) * ((Number(odds) || 1) - 1));
}
function fmtMoney(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function statusStyle(s: string) {
    const m: Record<string, { chip: string; bar: string }> = {
        WON:        { chip: 'bg-success-alpha-12 text-success-bright border-success/25',           bar: 'bg-success-primary' },
        LOST:       { chip: 'bg-danger-alpha-10 text-danger border-danger/25',                    bar: 'bg-danger-primary' },
        CASHED_OUT: { chip: 'bg-warning-alpha-12 text-warning border-warning/25',                bar: 'bg-warning' },
        VOID:       { chip: 'bg-white/[0.06] text-white/30 border-white/[0.06]',                          bar: 'bg-white/20' },
        PENDING:    { chip: 'bg-warning-soft/80 text-warning-bright border-warning-bright/25',   bar: 'bg-warning-bright' },
    };
    return m[s] ?? m.PENDING;
}

interface RightSidebarProps {
    mode?: 'floating' | 'static';
    className?: string;
}

// ─── SingleBetCard ─────────────────────────────────────────────────────────────
interface BetCardProps {
    bet: {
        id: string; eventId: string; eventName: string;
        marketName: string; selectionName: string;
        odds: number; marketType?: string; rate?: number;
        stake: number; potentialWin: number;
    };
    sym: string;
    onRemove: (id: string) => void;
    onStake:  (id: string, v: number) => void;
}

function BetCard({ bet, sym, onRemove, onStake }: BetCardProps) {
    const [raw, setRaw] = useState(bet.stake > 0 ? String(bet.stake) : '');
    const ctxVal = bet.stake > 0 ? String(bet.stake) : '';
    useEffect(() => {
        const t = setTimeout(() => setRaw(p => p !== ctxVal ? ctxVal : p), 0);
        return () => clearTimeout(t);
    }, [ctxVal]);

    const lb = isLineBasedFancyMarket({ marketType: bet.marketType, marketName: bet.marketName, selectionName: bet.selectionName });
    const stakeNum = parseFloat(raw) || 0;
    const profit   = lb ? null : potentialProfit(stakeNum || bet.stake, bet.odds);

    return (
        <div className="relative rounded-xl bg-bg-surface-2 border border-white/[0.07] overflow-hidden">
            {/* gold left accent */}
            <div className="absolute left-0 inset-y-0 w-[3px] bg-brand-gold rounded-r-full" />
            <div className="pl-3.5 pr-2.5 py-2 space-y-1.5">
                {/* Row 1: Selection + odds badge + X */}
                <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black text-brand-gold truncate leading-none">{bet.selectionName}</p>
                        <p className="text-[9px] text-white/30 leading-none mt-0.5 truncate">{bet.eventName} · {bet.marketName}</p>
                    </div>
                    <span className="flex-shrink-0 text-[12px] font-black text-white bg-brand-gold/10 border border-brand-gold/20 px-1.5 py-0.5 rounded-lg leading-none tabular-nums">
                        {fmtOdds(bet.odds, lb)}
                    </span>
                    <button
                        onClick={() => onRemove(bet.id)}
                        className="p-1 rounded-lg text-white/15 hover:text-danger hover:bg-danger-alpha-08 transition-all active:scale-90 flex-shrink-0"
                    >
                        <X size={10} />
                    </button>
                </div>

                {/* Row 2: Stake input + profit inline */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/25 pointer-events-none">{sym}</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={raw}
                            placeholder="Stake"
                            onChange={e => {
                                const v = e.target.value.replace(/[^0-9.]/g, '');
                                setRaw(v);
                                onStake(bet.id, isNaN(parseFloat(v)) ? 0 : parseFloat(v));
                            }}
                            className="w-full rounded-lg bg-bg-deep-4 border border-white/[0.07] focus:border-brand-gold/30 text-text-white text-[12px] font-black pl-6 pr-2 py-1.5 outline-none transition-colors placeholder:text-white/10 tabular-nums"
                        />
                    </div>
                    <div className="text-right flex-shrink-0 min-w-[54px]">
                        <p className="text-[8px] text-white/25 leading-none">{profit !== null ? 'Profit' : 'Return'}</p>
                        <p className="text-[11px] font-black text-brand-gold tabular-nums leading-tight">
                            {sym}{fmtMoney(profit !== null ? profit : bet.potentialWin)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── BetslipList ──────────────────────────────────────────────────────────────
function isMatchOddsMarket(bet: BetCardProps['bet']) {
    const mt = String((bet as any).marketType || '').trim().toLowerCase();
    const mn = String(bet.marketName || '').trim().toLowerCase();
    return mt === 'match' || mt === 'match1' || mt === 'match_odds' || mn.includes('match odds') || mn.includes('match winner');
}

function BetslipList({ bets, sym, onRemove, onStake }: {
    bets: BetCardProps['bet'][]; sym: string;
    onRemove: (id: string) => void; onStake: (id: string, v: number) => void;
}) {
    const e6 = useEarlySixMatches();
    return (
        <div className="space-y-1.5">
            {bets.map(bet => (
                <div key={bet.id} className="space-y-1">
                    <BetCard bet={bet} sym={sym} onRemove={onRemove} onStake={onStake} />
                    {e6.has(bet.eventId) && isMatchOddsMarket(bet) && (
                        <div className="rounded-xl px-2.5 py-1.5 text-[9px] bg-emerald-500/8 border border-emerald-500/15 text-emerald-300/90">
                            <p className="font-black text-[9px] text-emerald-400">🎯 EARLY 6 REFUND OFFER</p>
                            <p>Qualifies for cashback · Pre-match Match Odds only</p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── AnimatedBadge ──────────────────────────────────────────────────────
/** Count pill with bounce-pop + floating "+(n)" particle on increment */
function AnimatedBadge({ count }: { count: number }) {
    const prevRef  = useRef(count);
    const [popKey,  setPopKey]  = useState(0);
    const [plusKey, setPlusKey] = useState(0);
    const [delta,   setDelta]   = useState(0);

    useEffect(() => {
        const prev = prevRef.current;
        if (count > prev) {
            setDelta(count - prev);
            setPopKey(k => k + 1);
            setPlusKey(k => k + 1);
        }
        prevRef.current = count;
    }, [count]);

    if (count === 0) return null;
    return (
        <span className="relative inline-flex items-center justify-center">
            {delta > 0 && (
                <span
                    key={`plus-${plusKey}`}
                    className="betslip-plus-float absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black text-brand-gold whitespace-nowrap"
                >
                    +{delta}
                </span>
            )}
            <span
                key={`badge-${popKey}`}
                className="betslip-badge-pop betslip-badge-alive h-5 min-w-[20px] px-1.5 rounded-full text-[9px] font-black flex items-center justify-center leading-none"
            >

                {count}
            </span>
        </span>
    );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function RightSidebar({ mode = 'floating', className = '' }: RightSidebarProps) {
    const {
        bets, removeBet, updateStake, placeBet, clearBets,
        totalStake, totalPotentialWin,
        myBets, refreshMyBets,
        isBetslipOpen, toggleBetslip,
        oneClickEnabled, setOneClickEnabled,
        oneClickStake, setOneClickStake,
        bookBets, loadBookedBet,
    } = useBets();

    const { isAuthenticated }  = useAuth();
    const { openLogin }        = useModal();
    const { activeSymbol: sym, selectedWallet, selectedSubWallet, activeBalance, refreshWallet } = useWallet();
    const pathname = usePathname();
    const isSportsRoute = pathname === '/sports'
        || pathname.startsWith('/sports/')
        || pathname.startsWith('/sportsbook');

    const [placing,  setPlacing]  = useState(false);
    const [booking,  setBooking]  = useState(false);
    const [bookedId, setBookedId] = useState<string | null>(null);
    const [bookedExpiresAt, setBookedExpiresAt] = useState<number | null>(null);
    const [bookedCountdown, setBookedCountdown] = useState(0);
    const [loadCode, setLoadCode] = useState('');
    const [loadingCode, setLoadingCode] = useState(false);
    const [tab,      setTab]      = useState<'slip' | 'mybets'>('slip');
    const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

    useEffect(() => {
        if (!feedback) return;
        const t = setTimeout(() => setFeedback(null), 3500);
        return () => clearTimeout(t);
    }, [feedback]);

    // Booking countdown timer
    useEffect(() => {
        if (!bookedExpiresAt) { setBookedCountdown(0); return; }
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((bookedExpiresAt - Date.now()) / 1000));
            setBookedCountdown(remaining);
            if (remaining <= 0) {
                setBookedId(null);
                setBookedExpiresAt(null);
            }
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [bookedExpiresAt]);

    // Auto-open when bet is added + dismiss any active booking
    useEffect(() => {
        if (bets.length > 0) {
            if (!isBetslipOpen) toggleBetslip();
            if (bookedId) dismissBooking();
        }
    }, [bets.length]); // eslint-disable-line

    useEffect(() => {
        if (!isAuthenticated || tab !== 'mybets') return;
        void refreshMyBets();
        const t = setInterval(() => void refreshMyBets(), 15_000);
        return () => clearInterval(t);
    }, [tab, isAuthenticated, refreshMyBets]);

    const desktopDrawerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isBetslipOpen || mode !== 'floating') return;

        const handleClickOutside = (e: MouseEvent) => {
            if (window.innerWidth < 768) return; // Only apply on desktop view
            
            const target = e.target as HTMLElement;
            // Never aggressive-close if clicking buttons/links (to not interrupt betting flow)
            if (target.closest('button') || target.closest('a')) return;

            if (desktopDrawerRef.current && !desktopDrawerRef.current.contains(target)) {
                toggleBetslip();
            }
        };

        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 50);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isBetslipOpen, mode, toggleBetslip]);

    const handlePlace = async () => {
        if (!isAuthenticated) { openLogin(); return; }
        if (!bets.some(b => b.stake > 0)) return;
        setPlacing(true);
        try {
            await placeBet();
            showBetPlacedToast();
            setFeedback({ ok: true, msg: 'Bet placed successfully!' });
            setTimeout(() => setTab('mybets'), 1200);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to place bet.';
            setFeedback({ ok: false, msg });
            showBetErrorToast(e);
        } finally { setPlacing(false); }
    };

    const dismissBooking = () => {
        setBookedId(null);
        setBookedExpiresAt(null);
        setBookedCountdown(0);
    };

    const handleBookBet = async () => {
        if (!bets.some(b => b.stake > 0)) {
            setFeedback({ ok: false, msg: 'Enter a stake to book bets.' });
            return;
        }
        setBooking(true);
        try {
            const id = await bookBets();
            setBookedId(id);
            setBookedExpiresAt(Date.now() + 2 * 60 * 1000); // 2 minutes validity
            clearBets(); // Lock this booking — bets are frozen in the code
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to book bet.';
            setFeedback({ ok: false, msg });
        } finally {
            setBooking(false);
        }
    };

    const copyBookingId = () => {
        if (!bookedId) return;
        navigator.clipboard.writeText(bookedId);
        setFeedback({ ok: true, msg: 'Booking ID copied!' });
    };

    const handleLoadCode = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const code = loadCode.trim();
        if (!code) return;
        setLoadingCode(true);
        try {
            await loadBookedBet(code);
            setFeedback({ ok: true, msg: 'Bets loaded — place your bet now!' });
            setLoadCode('');
            // Dismiss any active booking since this code is now consumed
            dismissBooking();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Invalid or expired booking code.';
            setFeedback({ ok: false, msg });
        } finally {
            setLoadingCode(false);
        }
    };

    const totalProfit = Math.max(0, totalPotentialWin - totalStake);
    const canPlace    = bets.some(b => b.stake > 0);

    // ── Shared sub-components ─────────────────────────────────────────────────

    /** Slim header bar — always visible in floating mode, acts as the toggle handle */
    const SlimHeader = ({ showTabs = true }: { showTabs?: boolean }) => (
        <div
            className={`w-full h-[52px] flex items-center justify-between px-4 ${mode === 'floating' ? '' : 'cursor-default'} bg-bg-deep-3 border-b border-white/[0.06]`}
        >
            {/* Left: click zone → toggle betslip */}
            <div
                onClick={mode === 'floating' ? toggleBetslip : undefined}
                className={`flex flex-1 items-center gap-2.5 h-full ${mode === 'floating' ? 'cursor-pointer select-none' : ''}`}
            >
                <div className="w-7 h-7 rounded-lg bg-brand-gold/15 flex items-center justify-center flex-shrink-0">
                    <AlignJustify size={13} className="text-brand-gold" />
                </div>
                <span className="text-[13px] font-black text-white tracking-tight">Betslip</span>
                <AnimatedBadge count={bets.length} />
            </div>

            {/* Right: isolated controls — no betslip toggle */}
            <div className="flex items-center gap-2 shrink-0">
                {/* Quick Bet toggle */}
                <button
                    type="button"
                    onClick={() => setOneClickEnabled(!oneClickEnabled)}
                    title="Quick Bet"
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all hover:bg-white/[0.05] active:scale-90"
                >
                    <Zap size={11} className={oneClickEnabled ? 'text-brand-gold' : 'text-white/30'} />
                    <span className={`text-[10px] font-bold ${oneClickEnabled ? 'text-brand-gold' : 'text-white/25'}`}>
                        Quick Bet
                    </span>
                    {/* pill toggle */}
                    <span className={`relative flex w-8 h-[18px] rounded-full transition-colors duration-200 ${
                        oneClickEnabled ? 'bg-brand-gold' : 'bg-white/[0.08]'
                    }`}>
                        <span className={`absolute top-[3px] w-3 h-3 rounded-full shadow transition-all duration-200 ${
                            oneClickEnabled ? 'translate-x-[17px] bg-black' : 'translate-x-[3px] bg-white/30'
                        }`} />
                    </span>
                </button>

                {mode === 'floating' && (
                    <button
                        type="button"
                        onClick={toggleBetslip}
                        className="flex items-center justify-center w-6 h-6 rounded-lg hover:bg-white/[0.05] text-white/30 hover:text-white/60 transition-all active:scale-90"
                    >
                        {isBetslipOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                )}
            </div>
        </div>
    );

    /** One-click stake picker — shown just below header when Quick Bet is on */
    const QuickStakeBar = () => (
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-deep border-b border-white/[0.04]">
            <Zap size={11} className="text-brand-gold shrink-0" />
            <span className="text-[10px] font-bold text-brand-gold/80 shrink-0">Stake</span>
            <input
                type="number"
                min={1}
                value={oneClickStake}
                onChange={(e) => setOneClickStake(Math.max(1, Number(e.target.value) || 1))}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] focus:border-brand-gold/40 rounded-lg px-2 py-1 text-[12px] font-black text-white tabular-nums outline-none w-full text-right"
            />
            <div className="flex gap-1">
                {[100, 500, 1000, 5000].map(amt => (
                    <button key={amt} type="button"
                        onClick={(e) => { e.stopPropagation(); setOneClickStake(amt); }}
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded-md transition-all active:scale-90 ${
                            oneClickStake === amt
                                ? 'bg-brand-gold text-text-inverse'
                                : 'bg-white/[0.04] text-white/30 hover:bg-white/[0.08] hover:text-white'
                        }`}>
                        {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                ))}
            </div>
        </div>
    );

    /** Slip / My Bets tab row */
    const TabRow = () => (
        <div className="flex border-b border-white/[0.06] bg-bg-game-dark flex-shrink-0">
            {(['slip', 'mybets'] as const).map((t, i) => (
                <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 py-2.5 text-[11px] font-black tracking-tight transition-all border-b-2 ${tab === t ? 'text-brand-gold border-brand-gold' : 'text-white/25 border-transparent hover:text-white/50'}`}
                >
                    {['Slip', 'My Bets'][i]}
                </button>
            ))}
        </div>
    );

    /** Scrollable content */
    const Content = () => (
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 bg-bg-game-dark"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e2228 transparent' }}>
            {tab === 'slip' ? (
                bets.length === 0 ? (
                    <div className="flex flex-col h-full items-center justify-center py-6">
                        {/* Empty state icon */}
                        {!(bookedId && bookedCountdown > 0) && (
                            <div className="flex flex-col items-center justify-center gap-3 text-center select-none mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
                                    <span className="text-2xl">🎟️</span>
                                </div>
                                <div>
                                    <p className="text-[12px] font-bold text-white/20">Betslip is empty</p>
                                    <p className="text-[10px] text-white/10 mt-0.5">Tap any odds to add a selection</p>
                                </div>
                            </div>
                        )}

                        {/* Load Booked Bet Form — hidden while an active booking is showing */}
                        {!(bookedId && bookedCountdown > 0) && (
                            <div className="w-full max-w-[280px] mt-auto border-t border-white/[0.06] pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <BookMarked size={12} className="text-white/30" />
                                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Load Booking Code</p>
                                </div>
                                <form onSubmit={handleLoadCode} className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="e.g. 0-NLCCV4"
                                        value={loadCode}
                                        onChange={(e) => setLoadCode(e.target.value.toUpperCase())}
                                        className="flex-1 bg-white/[0.04] border border-white/[0.08] focus:border-brand-gold/40 rounded-xl px-3 py-2.5 text-[12px] font-black tracking-widest text-white uppercase outline-none placeholder:text-white/20 placeholder:font-normal placeholder:tracking-normal"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!loadCode.trim() || loadingCode}
                                        className={`px-4 rounded-xl font-bold text-[11px] transition-all ${!loadCode.trim() || loadingCode ? 'bg-white/[0.04] text-white/20 cursor-not-allowed border border-white/[0.04]' : 'bg-brand-gold hover:bg-brand-gold-hover text-text-inverse shadow-glow-gold active:scale-[0.97]'}`}
                                    >
                                        {loadingCode ? <span className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin inline-block align-middle" /> : 'Load'}
                                    </button>
                                </form>
                                <p className="text-[9px] text-white/15 mt-2 text-center">Booking codes are valid for 2 minutes · one-time use</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <BetslipList bets={bets} sym={sym} onRemove={removeBet} onStake={updateStake} />
                )
            ) : myBets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-3 text-center select-none">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
                        <BookMarked size={22} className="text-white/10" />
                    </div>
                    <p className="text-[12px] font-bold text-white/20">No bets yet</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {myBets.map(bet => {
                        const { chip, bar } = statusStyle(bet.status);
                        const partial = hasPartialCashout(bet);
                        const lb = isLineBasedFancyMarket({ marketType: (bet as any).gtype, marketName: bet.marketName, selectionName: bet.selectionName });
                        const pnl = getBetNetPnL(bet);
                        return (
                            <div key={bet.id} className="relative rounded-xl bg-bg-surface-2 border border-white/[0.07] overflow-hidden">
                                <span className={`absolute inset-y-0 left-0 w-[3px] rounded-r-full ${bar}`} />
                                <div className="pl-4 pr-3 pt-3 pb-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider ${chip}`}>{bet.status.replace('_', ' ')}</span>
                                        <span className="text-[9px] text-white/20 flex items-center gap-1"><Clock size={9} />{new Date(bet.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-white truncate">{bet.eventName}</p>
                                        <p className="text-[10px] text-white/30 mt-0.5 flex items-center gap-1.5">
                                            <span className="text-white/55 font-semibold truncate">{bet.selectionName}</span>
                                            <span className="text-white/10">·</span>
                                            {lb ? <span>Runs <span className="text-white/55 font-bold">{bet.odds}</span></span>
                                                : <span>Odds <span className="text-white/55 font-bold">×{Number(bet.odds).toFixed(2)}</span></span>}
                                        </p>
                                    </div>
                                    {partial && (
                                        <p className="text-[10px] text-warning/80 bg-warning-alpha-08 rounded-lg px-2.5 py-1.5">
                                            Partial cash out: {sym}{getBetPartialCashoutValue(bet).toFixed(2)}
                                        </p>
                                    )}
                                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.04] px-3 py-2.5 text-[10px] grid grid-cols-2 gap-x-4 gap-y-1.5">
                                        <span className="text-white/30">{partial ? 'Remaining' : 'Stake'}</span>
                                        <span className="text-right font-bold text-white/55 tabular-nums">{sym}{bet.stake}</span>
                                        {partial && (<><span className="text-white/30">Original</span><span className="text-right font-bold text-white/55 tabular-nums">{sym}{getBetOriginalStake(bet).toFixed(2)}</span></>)}
                                        <span className="text-white/30">{bet.status === 'PENDING' ? 'Max Return' : 'Returned'}</span>
                                        <span className={`text-right font-bold tabular-nums ${bet.status === 'WON' ? 'text-success-bright' : bet.status === 'CASHED_OUT' ? 'text-warning' : bet.status === 'PENDING' ? 'text-warning-bright' : 'text-white/55'}`}>
                                            {sym}{(bet.status === 'PENDING' ? getBetPendingMaxReturn(bet) : (getBetSettledReturn(bet) ?? bet.potentialWin)).toFixed(2)}
                                        </span>
                                        {bet.status !== 'PENDING' && pnl !== null && (
                                            <><span className="text-white/30">Net P&amp;L</span><span className={`text-right font-bold tabular-nums ${pnl >= 0 ? 'text-success-bright' : 'text-danger'}`}>{pnl >= 0 ? '+' : '-'}{sym}{Math.abs(pnl).toFixed(2)}</span></>
                                        )}
                                    </div>
                                    {bet.status === 'PENDING' && <SportsBetCashoutWidget bet={bet} onSuccess={async () => { await Promise.all([refreshMyBets(), refreshWallet()]); }} compact />}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    /** Footer with quick stakes + summary + CTA */
    const Footer = () => (
        <div className="px-3 pt-3 pb-4 border-t border-white/[0.06] bg-bg-deep-3 space-y-3 flex-shrink-0">
            {/* Quick stakes */}
            <div className="grid grid-cols-4 gap-1.5">
                {QUICK_STAKES.map(amt => (
                    <button key={amt}
                        onClick={() => bets.forEach(b => updateStake(b.id, amt))}
                        className="py-2 rounded-xl bg-white/[0.04] hover:bg-brand-gold/10 text-white/35 hover:text-brand-gold text-[10px] font-bold border border-white/[0.04] hover:border-brand-gold/20 transition-all active:scale-95">
                        {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                ))}
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.04] text-[10px]">
                    <span className="text-white/30">Wallet</span>
                    <span className={`font-bold text-[9px] px-2 py-0.5 rounded-lg border ${selectedWallet === 'crypto' ? 'bg-brand-alpha-08 text-accent-purple border-accent-purple/20' : 'bg-brand-alpha-08 text-brand-gold border-brand-gold/20'}`}>
                        {selectedSubWallet.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')} · {sym}{activeBalance.toFixed(2)}
                    </span>
                </div>
                <div className="px-3.5 py-3 space-y-1.5 text-[11px]">
                    <div className="flex justify-between"><span className="text-white/30">Total Stake</span><span className="font-black text-white tabular-nums">{sym}{totalStake.toLocaleString('en-US')}</span></div>
                    <div className="flex justify-between"><span className="text-white/30">Potential Profit</span><span className="font-black text-brand-gold tabular-nums">{sym}{fmtMoney(totalProfit)}</span></div>
                    <div className="flex justify-between border-t border-white/[0.04] pt-1.5 mt-0.5">
                        <span className="text-white/50 font-bold">Total Return</span>
                        <span className="font-black text-white tabular-nums text-[13px]">{sym}{fmtMoney(totalPotentialWin)}</span>
                    </div>
                </div>
            </div>

            {/* Feedback banner */}
            {feedback && (
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-semibold ${feedback.ok ? 'bg-success-alpha-10 text-success-bright border border-success/15' : 'bg-danger-alpha-10 text-danger border border-danger/15'}`}>
                    {feedback.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                    {feedback.msg}
                </div>
            )}

            {/* Active booking code banner with countdown + dismiss */}
            {bookedId && bookedCountdown > 0 && (
                <div className="rounded-xl bg-brand-gold/10 border border-brand-gold/30 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] text-brand-gold/60 uppercase font-bold tracking-wider">Booking Code</span>
                            <span className="text-[15px] font-black text-brand-gold tracking-[0.2em]">{bookedId}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className="flex flex-col items-end">
                                <span className="text-[8px] text-white/30 uppercase font-bold">Expires</span>
                                <span className={`text-[12px] font-black tabular-nums ${bookedCountdown <= 30 ? 'text-danger' : bookedCountdown <= 60 ? 'text-warning-bright' : 'text-brand-gold'}`}>
                                    {Math.floor(bookedCountdown / 60)}:{String(bookedCountdown % 60).padStart(2, '0')}
                                </span>
                            </div>
                            <button onClick={copyBookingId} title="Copy code" className="p-1.5 bg-brand-gold/20 hover:bg-brand-gold/30 rounded-lg text-brand-gold transition-colors active:scale-90">
                                <Clipboard size={13} />
                            </button>
                            <button onClick={dismissBooking} title="Dismiss" className="p-1.5 bg-white/[0.04] hover:bg-danger-alpha-08 rounded-lg text-white/30 hover:text-danger transition-colors active:scale-90">
                                <X size={13} />
                            </button>
                        </div>
                    </div>
                    <div className="h-[2px] bg-black/20">
                        <div
                            className={`h-full transition-all duration-1000 ease-linear rounded-full ${bookedCountdown <= 30 ? 'bg-danger' : bookedCountdown <= 60 ? 'bg-warning-bright' : 'bg-brand-gold'}`}
                            style={{ width: `${(bookedCountdown / 120) * 100}%` }}
                        />
                    </div>
                    <p className="text-[9px] text-brand-gold/40 px-3 py-1.5 text-center">Share this code. It can only be used once within the timer.</p>
                </div>
            )}

            {/* Load booking code (shown when slip is empty and no active booking) */}
            {bets.length === 0 && !(bookedId && bookedCountdown > 0) && (
                <form onSubmit={handleLoadCode} className="flex gap-2">
                    <div className="relative flex-1">
                        <BookMarked size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Enter Booking Code"
                            value={loadCode}
                            onChange={(e) => setLoadCode(e.target.value.toUpperCase())}
                            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-brand-gold/40 rounded-xl pl-8 pr-3 py-2.5 text-[12px] font-black tracking-widest text-white uppercase outline-none placeholder:text-white/20 placeholder:font-normal placeholder:tracking-normal"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!loadCode.trim() || loadingCode}
                        className={`px-4 rounded-xl font-bold text-[11px] transition-all ${!loadCode.trim() || loadingCode ? 'bg-white/[0.04] text-white/20 cursor-not-allowed border border-white/[0.04]' : 'bg-brand-gold hover:bg-brand-gold-hover text-text-inverse shadow-glow-gold active:scale-[0.97]'}`}
                    >
                        {loadingCode ? <span className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin inline-block align-middle" /> : 'Load'}
                    </button>
                </form>
            )}

            {/* CTA row — only show when there are bets to act on (not during active booking view) */}
            {bets.length > 0 && (
                <div className="flex gap-2">
                    {bets.length > 1 && (
                        <button onClick={() => clearBets()} title="Clear all"
                            className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-danger-alpha-08 hover:border-danger/20 text-white/20 hover:text-danger transition-all active:scale-90">
                            <Trash2 size={13} />
                        </button>
                    )}
                    {!isAuthenticated ? (
                        <>
                            <button onClick={handleBookBet} disabled={booking || !canPlace}
                                className={`flex-1 h-11 flex items-center justify-center gap-1.5 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all active:scale-[0.97] ${booking || !canPlace ? 'bg-white/[0.04] text-white/20 cursor-not-allowed border border-white/[0.04]' : 'bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.06]'}`}>
                                {booking ? <span className="w-3 h-3 border-2 border-white/[0.12] border-t-white rounded-full animate-spin" /> : <Share2 size={13} />}
                                Book
                            </button>
                            <button onClick={openLogin}
                                className="flex-[1.5] h-11 flex items-center justify-center gap-1.5 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-white font-black text-[11px] uppercase tracking-wider transition-all active:scale-[0.97] shadow-glow-gold">
                                <User size={13} /> Login
                            </button>
                        </>
                    ) : (
                        <button onClick={handlePlace} disabled={placing || !canPlace}
                            className={`flex-1 h-11 flex items-center justify-center gap-2 rounded-xl font-black text-[12px] uppercase tracking-wider transition-all active:scale-[0.97] ${placing || !canPlace ? 'bg-white/[0.04] text-white/20 cursor-not-allowed border border-white/[0.04]' : 'bg-brand-gold hover:bg-brand-gold-hover text-white shadow-glow-gold'}`}>
                            {placing && <span className="w-3.5 h-3.5 border-[2.5px] border-black/20 border-t-black rounded-full animate-spin" />}
                            {placing ? 'Placing…' : `Place ${bets.length > 1 ? `${bets.length} Bets` : 'Bet'} · ${sym}${totalStake.toLocaleString('en-US')}`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    // ── STATIC mode (match detail sidebar) ────────────────────────────────────
    if (mode === 'static') {
        return (
            <div className={`w-full flex flex-col bg-bg-game-dark border border-white/[0.08] rounded-2xl overflow-hidden h-auto ${className}`}>
                <SlimHeader showTabs={false} />
                <TabRow />
                <div className="flex-1 overflow-hidden flex flex-col max-h-[440px]">
                    <Content />
                    {tab === 'slip' && (bets.length > 0 || (bookedId && bookedCountdown > 0)) && <Footer />}
                </div>
            </div>
        );
    }

    // ── FLOATING mode ─────────────────────────────────────────────────────────
    // Mobile:  Sheet slides up from bottom-0, sits BEHIND the nav (z-45 < z-50).
    //          FAB pill floats ABOVE the nav (z-51) as the toggle trigger.
    // Desktop: right-aligned 360px slide-up panel (z-60, unchanged).
    const CARD_H   = 68;
    const GAP      = 6;
    const maxBetsH = CARD_H * 3 + GAP * 2; // 216px — 3 cards

    return (
        <>
            {/* ════════════════════════════════════════════════════════════════
                MOBILE — only on /sports & /sports/match/... routes
             ════════════════════════════════════════════════════════════════ */}

            {/* ── Backdrop: behind nav (z-44 < nav z-50) ── */}
            {isBetslipOpen && (
                <div
                    className="fixed inset-0 z-[44] bg-black/55 backdrop-blur-[2px] md:hidden"
                    onClick={toggleBetslip}
                />
            )}

            {/* ── Bottom sheet: behind nav (z-45), starts at bottom-0 ── */}
            <div
                className={`fixed z-[45] inset-x-0 bottom-0 md:hidden ${className}`}
                style={{ pointerEvents: isBetslipOpen ? 'auto' : 'none' }}
            >
                <div
                    style={{
                        transform: isBetslipOpen ? 'translateY(0)' : 'translateY(100%)',
                        transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
                        willChange: 'transform',
                        height: 'calc(100dvh - 64px)',
                        paddingBottom: 'var(--mobile-nav-height)',
                    }}
                    className="flex flex-col rounded-t-2xl border border-b-0 border-white/[0.08] bg-bg-game-dark overflow-hidden shadow-betslip"
                >
                    {/* Drag handle */}
                    <div className="flex justify-center pt-2.5 pb-1">
                        <div className="w-10 h-1 rounded-full bg-white/15" />
                    </div>

                    <SlimHeader />
                    {oneClickEnabled && <QuickStakeBar />}
                    <TabRow />

                    <div className="flex-1 overflow-y-auto overscroll-contain bg-bg-game-dark flex flex-col pt-2 pb-16">
                        {tab === 'slip' && (
                            bets.length === 0 ? (
                                <div className="flex flex-col h-full items-center justify-center py-24 gap-2 text-center select-none bg-bg-game-dark">
                                    <span className="text-2xl">🎟️</span>
                                    <p className="text-[11px] font-bold text-white/20">Betslip is empty</p>
                                    <p className="text-[9px] text-white/10">Tap any odds to add a selection</p>
                                </div>
                            ) : (
                                <div className="px-2.5 h-full">
                                    <BetslipList bets={bets} sym={sym} onRemove={removeBet} onStake={updateStake} />
                                    <div className="h-4" />
                                </div>
                            )
                        )}

                        {tab === 'mybets' && (
                            myBets.length === 0 ? (
                                <div className="flex flex-col h-full items-center justify-center py-24 gap-2 text-center select-none bg-bg-game-dark">
                                    <BookMarked size={18} className="text-white/10" />
                                    <p className="text-[11px] font-bold text-white/20">No bets yet</p>
                                </div>
                            ) : (
                                <div className="px-2.5 space-y-1.5 h-full pt-2">
                                    {myBets.map(bet => {
                                        const { chip, bar } = statusStyle(bet.status);
                                        const lb = isLineBasedFancyMarket({ marketType: (bet as any).gtype, marketName: bet.marketName, selectionName: bet.selectionName });
                                        return (
                                            <div key={bet.id} className="relative rounded-xl bg-bg-surface-2 border border-white/[0.07] overflow-hidden">
                                                <span className={`absolute inset-y-0 left-0 w-[3px] rounded-r-full ${bar}`} />
                                                <div className="pl-3.5 pr-2.5 py-2 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${chip}`}>{bet.status === 'PENDING' ? 'ACCEPTED' : bet.status.replace('_', ' ')}</span>
                                                        <span className="text-[9px] text-white/20">{new Date(bet.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-white truncate">{bet.eventName}</p>
                                                    <p className="text-[9px] text-white/40 truncate">{bet.selectionName} · {lb ? `Runs ${bet.odds}` : `×${Number(bet.odds).toFixed(2)}`}</p>
                                                    <div className="flex justify-between text-[9px] pt-1 border-t border-white/[0.04]">
                                                        <span className="text-white/30">Stake <span className="text-white/55 font-bold">{sym}{bet.stake}</span></span>
                                                        <span className={`font-bold ${bet.status === 'WON' ? 'text-success-bright' : bet.status === 'CASHED_OUT' ? 'text-warning' : 'text-warning-bright'}`}>
                                                            {sym}{(bet.status === 'PENDING' ? getBetPendingMaxReturn(bet) : (getBetSettledReturn(bet) ?? bet.potentialWin)).toFixed(2)}
                                                        </span>
                                                    </div>
                                                    {bet.status === 'PENDING' && <SportsBetCashoutWidget bet={bet} onSuccess={async () => { await Promise.all([refreshMyBets(), refreshWallet()]); }} compact />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}
                    </div>

                    {tab === 'slip' && (bets.length > 0 || (bookedId && bookedCountdown > 0)) && (
                        <div className="mt-auto">
                            <Footer />
                        </div>
                    )}
                </div>
            </div>




            {/* ── Desktop (md+): Structural right sidebar (pushes main content) ── */}
            <div
                ref={desktopDrawerRef}
                className={`${isSportsRoute ? 'hidden md:block' : 'hidden'} sticky top-0 h-[100dvh] flex-shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] z-[40] ${className}`}
                style={{
                    width: isBetslipOpen ? 360 : 0,
                    pointerEvents: 'auto', // Always intercept clicks on the drawer (and its left handle)
                }}
            >
                {/* Inner fixed-width container */}
                <div 
                    className="absolute top-[64px] left-0 bottom-0 w-[360px] flex flex-col border-l border-white/[0.08] bg-bg-game-dark shadow-[var(--tw-shadow)]"
                    style={{
                        boxShadow: isBetslipOpen ? '-8px 0 30px rgba(0,0,0,0.5)' : 'none'
                    }}
                >
                {/* Desktop Toggle Button attached to sliding drawer */}
                <button
                    onClick={toggleBetslip}
                    className={`absolute top-1/2 -translate-y-1/2 -left-[40px] flex items-center justify-center bg-bg-deep-3 border border-white/[0.1] border-r-0 rounded-l-xl shadow-[-8px_0_24px_rgba(0,0,0,0.5)] transition-colors w-[40px] h-24 z-10 ${isBetslipOpen ? 'hover:bg-danger-alpha-10' : 'hover:bg-brand-gold/10'}`}
                    aria-label={isBetslipOpen ? "Close betslip" : "Open betslip"}
                >
                   <div className="flex flex-col items-center gap-2 text-brand-gold">
                      <AnimatedBadge count={bets.length} />
                      <span className="[writing-mode:vertical-lr] text-[11px] font-black tracking-widest rotate-180">BETSLIP</span>
                   </div>
                </button>

                <div className="flex flex-col h-full overflow-hidden bg-bg-game-dark">
                    <SlimHeader />
                    {oneClickEnabled && <QuickStakeBar />}
                    <TabRow />

                    <div className="flex-1 overflow-auto bg-bg-game-dark flex flex-col pt-2 pb-16">
                        {tab === 'slip' && (
                            bets.length === 0 ? (
                                <div className="flex flex-col h-full items-center justify-center py-24 gap-2 text-center select-none bg-bg-game-dark">
                                <span className="text-2xl">🎟️</span>
                                <p className="text-[11px] font-bold text-white/20">Betslip is empty</p>
                                <p className="text-[9px] text-white/10">Tap any odds to add a selection</p>
                            </div>
                        ) : (
                            <div className="px-2.5 h-full">
                                <BetslipList bets={bets} sym={sym} onRemove={removeBet} onStake={updateStake} />
                                <div className="h-4" />
                            </div>
                        )
                    )}

                    {tab === 'mybets' && (
                        myBets.length === 0 ? (
                            <div className="flex flex-col h-full items-center justify-center py-24 gap-2 text-center select-none bg-bg-game-dark">
                                <BookMarked size={18} className="text-white/10" />
                                <p className="text-[11px] font-bold text-white/20">No bets yet</p>
                            </div>
                        ) : (
                            <div className="px-2.5 space-y-1.5 h-full pt-2">
                                {myBets.map(bet => {
                                    const { chip, bar } = statusStyle(bet.status);
                                    const lb = isLineBasedFancyMarket({ marketType: (bet as any).gtype, marketName: bet.marketName, selectionName: bet.selectionName });
                                    return (
                                        <div key={bet.id} className="relative rounded-xl bg-bg-surface-2 border border-white/[0.07] overflow-hidden">
                                            <span className={`absolute inset-y-0 left-0 w-[3px] rounded-r-full ${bar}`} />
                                            <div className="pl-3.5 pr-2.5 py-2 space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${chip}`}>{bet.status === 'PENDING' ? 'ACCEPTED' : bet.status.replace('_', ' ')}</span>
                                                    <span className="text-[9px] text-white/20">{new Date(bet.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="text-[10px] font-bold text-white truncate">{bet.eventName}</p>
                                                <p className="text-[9px] text-white/40 truncate">{bet.selectionName} · {lb ? `Runs ${bet.odds}` : `×${Number(bet.odds).toFixed(2)}`}</p>
                                                <div className="flex justify-between text-[9px] pt-1 border-t border-white/[0.04]">
                                                    <span className="text-white/30">Stake <span className="text-white/55 font-bold">{sym}{bet.stake}</span></span>
                                                    <span className={`font-bold ${bet.status === 'WON' ? 'text-success-bright' : bet.status === 'CASHED_OUT' ? 'text-warning' : 'text-warning-bright'}`}>
                                                        {sym}{(bet.status === 'PENDING' ? getBetPendingMaxReturn(bet) : (getBetSettledReturn(bet) ?? bet.potentialWin)).toFixed(2)}
                                                    </span>
                                                </div>
                                                {bet.status === 'PENDING' && <SportsBetCashoutWidget bet={bet} onSuccess={async () => { await Promise.all([refreshMyBets(), refreshWallet()]); }} compact />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>

                {/* Footer pinned at bottom of drawer */}
                {tab === 'slip' && (bets.length > 0 || (bookedId && bookedCountdown > 0)) && (
                   <div className="mt-auto">
                       <Footer />
                   </div>
                )}
                </div>
                </div>
            </div>
        </>
    );
}
