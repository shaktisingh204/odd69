'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
    type LucideIcon,
    Trophy, XCircle, Clock, TrendingUp, ChevronDown, ChevronUp,
    DollarSign, Loader2, AlertCircle, CheckCircle2, RotateCcw, Copy,
} from 'lucide-react';
import { betsApi, Bet as BaseBet, CashoutOffer, CashoutResult } from '@/services/bets';

type Bet = BaseBet & {
    oddsInfo?: {
        provider: 'SPORTRADAR' | 'DIAMOND' | string;
        acceptedOdds: number;
        submittedOdds: number | null;
        profit: number | null;
        marketType: string | null;
        oddsAdjusted: boolean;
    };
};
import { useWallet } from '@/context/WalletContext';
import {
    getBetNetPnL,
    getBetOriginalStake,
    getBetPartialCashoutValue,
    getBetPendingMaxReturn,
    getBetSettledReturn,
    hasPartialCashout,
} from '@/utils/sportsBetDisplay';
import { isLineBasedFancyMarket } from '@/utils/sportsBetPricing';

// ─── Status display config ─────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; icon: LucideIcon; color: string; bg: string; border: string }> = {
    WON: { label: 'Won', icon: Trophy, color: 'text-success-bright', bg: 'bg-success-alpha-10', border: 'border-success-primary/20' },
    LOST: { label: 'Lost', icon: XCircle, color: 'text-danger', bg: 'bg-danger-alpha-10', border: 'border-danger/20' },
    PENDING: { label: 'Accepted', icon: Clock, color: 'text-warning-bright', bg: 'bg-warning-alpha-08', border: 'border-amber-500/20' },
    VOID: { label: 'Void', icon: TrendingUp, color: 'text-white/40', bg: 'bg-white/[0.04]', border: 'border-white/[0.06]' },
    CASHED_OUT: { label: 'Cashed Out', icon: DollarSign, color: 'text-warning', bg: 'bg-warning-alpha-08', border: 'border-orange-500/20' },
};

type FilterStatus = 'ALL' | 'PENDING' | 'WON' | 'LOST' | 'VOID' | 'CASHED_OUT';

const getDisplayMarketName = (bet: Bet) =>
    bet.srMarketName || bet.marketName || bet.srMarketFullId || bet.marketId || '';

const getDisplaySelectionName = (bet: Bet) =>
    bet.srRunnerName || bet.selectionName || bet.selectedTeam || bet.srRunnerId || bet.selectionId || '';



// ─── Types ─────────────────────────────────────────────────────────────────────
type CashoutPhase =
    | 'LOADING'           // initial fetch
    | 'UNAVAILABLE'       // bet not eligible
    | 'SUSPENDED'         // market suspended
    | 'FULL_REFUND'       // pre-match, full stake back
    | 'IDLE'              // showing offer, waiting for first tap
    | 'CONFIRMING'        // first tap done — showing confirm + slider
    | 'PRICE_CHANGED'     // server returned new price — must re-confirm
    | 'EXECUTING'         // waiting for server
    | 'SUCCESS';          // done

// ─── CashoutButton ─────────────────────────────────────────────────────────────
// Stake-style: double-tap confirm, partial slider, price-changed re-confirm,
// pre-match full-refund mode. Isolated per card so polling is independent.
function CashoutButton({ bet, onSuccess }: { bet: Bet; onSuccess: () => void }) {
    const { activeSymbol } = useWallet();
    const [offer, setOffer] = useState<CashoutOffer | null>(null);
    const [phase, setPhase] = useState<CashoutPhase>('LOADING');
    const [fraction, setFraction] = useState(1);            // 1 = full, 0.5 = 50% etc.
    const [error, setError] = useState<string | null>(null);
    const [priceChangedValue, setPriceChangedValue] = useState<number | null>(null);
    const [result, setResult] = useState<CashoutResult | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Fetch offer & derive phase ─────────────────────────────────────────────
    const fetchOffer = useCallback(async (signal?: AbortSignal) => {
        try {
            const data = await betsApi.getCashoutOffer(bet.id);
            if (signal?.aborted) return;
            setOffer(data);
            setPhase(prev => {
                // Don't overwrite mid-flow states
                if (prev === 'CONFIRMING' || prev === 'PRICE_CHANGED' || prev === 'EXECUTING' || prev === 'SUCCESS') return prev;
                if (data.status === 'UNAVAILABLE') return 'UNAVAILABLE';
                if (data.status === 'SUSPENDED') return 'SUSPENDED';
                if (data.fullRefundEligible) return 'FULL_REFUND';
                return 'IDLE';
            });
        } catch {
            /* silent — don't interrupt user mid-flow */
        }
    }, [bet.id]);

    useEffect(() => {
        const ctrl = new AbortController();
        const initialFetch = setTimeout(() => {
            void fetchOffer(ctrl.signal);
        }, 0);
        timerRef.current = setInterval(() => fetchOffer(ctrl.signal), 8000);
        return () => {
            clearTimeout(initialFetch);
            ctrl.abort();
            if (timerRef.current) clearInterval(timerRef.current);
            if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        };
    }, [fetchOffer]);

    // ── Execute ────────────────────────────────────────────────────────────────
    const doExecute = async (opts: { fraction: number; clientExpectedValue?: number; fullRefund?: boolean }) => {
        setPhase('EXECUTING');
        setError(null);
        if (timerRef.current) clearInterval(timerRef.current); // stop re-fetching mid-execute
        try {
            const res = await betsApi.executeCashout(bet.id, opts);
            if (res.status === 'PRICE_CHANGED') {
                // Server says price moved >2% — show new value & ask re-confirm
                setPriceChangedValue(res.newCashoutValue ?? null);
                setPhase('PRICE_CHANGED');
                // Resume polling with new offer
                timerRef.current = setInterval(() => fetchOffer(), 8000);
            } else {
                setResult(res);
                setPhase('SUCCESS');
                setTimeout(() => onSuccess(), 1400);
            }
        } catch (err: unknown) {
            const maybeAxiosError = err as { response?: { data?: { message?: string } }; message?: string };
            const msg = maybeAxiosError.response?.data?.message || maybeAxiosError.message || 'Cash out failed. Please try again.';
            setError(msg);
            setPhase('IDLE');
            fetchOffer();
            timerRef.current = setInterval(() => fetchOffer(), 8000);
        }
    };

    // ── First tap ──────────────────────────────────────────────────────────────
    const handleFirstTap = () => {
        setPhase('CONFIRMING');
        setError(null);
        // Auto-cancel confirm after 8s (Stake-style: confirm expires)
        confirmTimerRef.current = setTimeout(() => setPhase('IDLE'), 8000);
    };

    // ── Cancel confirm ─────────────────────────────────────────────────────────
    const handleCancel = () => {
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        setPhase('IDLE');
        setPriceChangedValue(null);
        setError(null);
    };

    // ── Computed values ────────────────────────────────────────────────────────
    const displayValue = offer?.cashoutValue ?? 0;
    const partialValue = parseFloat((displayValue * fraction).toFixed(2));
    const restStake = parseFloat(((offer?.stake ?? bet.stake) * (1 - fraction)).toFixed(2));

    // ══════════════════════════════════════════════════════════════════════════
    // Render
    // ══════════════════════════════════════════════════════════════════════════

    if (phase === 'LOADING') {
        return (
            <div className="flex items-center gap-1.5 text-[11px] text-white/20 py-1">
                <Loader2 size={10} className="animate-spin" />
                <span>Fetching offer…</span>
            </div>
        );
    }

    if (phase === 'UNAVAILABLE') return null;

    if (phase === 'SUSPENDED') {
        return (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2">
                <div className="flex items-center gap-1.5">
                    <AlertCircle size={12} className="text-white/20" />
                    <span className="text-[11px] font-medium text-white/30">Cash Out Suspended</span>
                </div>
            </div>
        );
    }

    if (phase === 'SUCCESS') {
        const isFull = !result?.remainingStake || result.remainingStake === 0;
        const isPartial = result?.status === 'PARTIAL_CASHED_OUT';
        return (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-success-alpha-10 border border-success-primary/20">
                <CheckCircle2 size={14} className="text-success-bright flex-shrink-0" />
                <div className="text-xs">
                    <p className="font-bold text-success-bright">
                        {isPartial ? 'Partial Cash Out Successful!' : 'Cashed Out!'}
                    </p>
                    {result?.cashoutValue && (
                        <p className="text-success-bright/60 text-[10px] mt-0.5">
                            {activeSymbol}{result.cashoutValue.toFixed(2)} added to wallet
                            {isFull ? '' : ` · ${activeSymbol}${result.remainingStake?.toFixed(2)} still active`}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // ── Full Refund (Pre-match) ─────────────────────────────────────────────────
    if (phase === 'FULL_REFUND' || (phase === 'IDLE' && offer?.fullRefundEligible)) {
        if (phase === 'IDLE') {
            return (
                <div className="space-y-2">
                    {/* Pre-match: two options side by side */}
                    <div className="flex gap-2">
                        <button
                            onClick={handleFirstTap}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl
                                       bg-warning-alpha-12 border border-amber-500/30 text-warning-bright text-[11px] font-bold
                                       hover:bg-amber-500/25 transition-all active:scale-[0.98]"
                        >
                            <DollarSign size={12} />
                            Cash Out {activeSymbol}{displayValue.toFixed(2)}
                        </button>
                        <button
                            onClick={() => doExecute({ fraction: 1, fullRefund: true })}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl
                                       bg-success-alpha-16 border border-success-primary/30 text-success-bright text-[11px] font-bold
                                       hover:bg-success-alpha-20 transition-all active:scale-[0.98]"
                        >
                            <RotateCcw size={12} />
                            Cancel Bet {activeSymbol}{offer?.fullRefundValue?.toFixed(2)}
                        </button>
                    </div>
                    <p className="text-[10px] text-white/25 text-center">
                        Pre-match · Cancel for full stake back
                    </p>
                </div>
            );
        }
    }

    // ── Price Changed re-confirm ────────────────────────────────────────────────
    if (phase === 'PRICE_CHANGED') {
        return (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.07] p-3 space-y-3">
                <div className="flex items-center gap-2">
                    <AlertCircle size={13} className="text-warning-bright flex-shrink-0" />
                    <p className="text-xs font-bold text-warning-bright">Odds Changed</p>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed">
                    The market moved. New offer:{' '}
                    <span className="font-bold text-white">{activeSymbol}{priceChangedValue?.toFixed(2)}</span>
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={handleCancel}
                        className="flex-1 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08]
                                   text-[11px] font-bold text-white/40 hover:text-white/60 transition-all"
                    >
                        Decline
                    </button>
                    <button
                        onClick={() => doExecute({ fraction, clientExpectedValue: priceChangedValue! })}
                        className="flex-1 py-2 rounded-lg bg-amber-500 text-text-inverse text-[11px] font-bold
                                   hover:bg-amber-400 transition-all active:scale-[0.98]"
                    >
                        Accept {activeSymbol}{priceChangedValue?.toFixed(2)}
                    </button>
                </div>
            </div>
        );
    }

    // ── Executing spinner ──────────────────────────────────────────────────────
    if (phase === 'EXECUTING') {
        return (
            <div className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-warning-alpha-08 border border-amber-500/20">
                <Loader2 size={14} className="animate-spin text-warning-bright" />
                <span className="text-xs font-bold text-warning-bright">Processing…</span>
            </div>
        );
    }

    // ── IDLE: first tap button ─────────────────────────────────────────────────
    if (phase === 'IDLE') {
        return (
            <div className="space-y-1.5">
                <button
                    onClick={handleFirstTap}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                               bg-warning-alpha-12 border border-amber-500/30 text-warning-bright
                               hover:bg-amber-500/25 hover:border-amber-500/50 transition-all
                               text-xs font-bold active:scale-[0.98]"
                >
                    <DollarSign size={13} />
                    Cash Out {activeSymbol}{displayValue.toFixed(2)}
                </button>
                <div className="flex justify-between text-[10px] text-white/20 px-1">
                    <span>Live odds: {offer?.currentOdds}</span>
                    <span>Original: {offer?.originalOdds}</span>
                </div>
                {error && (
                    <p className="text-[11px] text-danger flex items-center gap-1">
                        <AlertCircle size={10} /> {error}
                    </p>
                )}
            </div>
        );
    }

    // ── CONFIRMING: slider + second tap ───────────────────────────────────────
    // (phase === 'CONFIRMING')
    const isFullCashout = fraction >= 0.99;
    return (
        <div className="rounded-xl bg-bg-modal border border-amber-500/30 p-3 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-white">Confirm Cash Out</p>
                <button
                    onClick={handleCancel}
                    className="text-[10px] text-white/30 hover:text-white/60 transition-all"
                >
                    Cancel
                </button>
            </div>

            {/* Partial slider */}
            <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] text-white/40">
                    <span>Partial</span>
                    <span className="font-bold text-white">{Math.round(fraction * 100)}%</span>
                    <span>Full</span>
                </div>
                <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round(fraction * 100)}
                    onChange={e => setFraction(parseInt(e.target.value) / 100)}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                               [&::-webkit-slider-thumb]:appearance-none
                               [&::-webkit-slider-thumb]:w-4
                               [&::-webkit-slider-thumb]:h-4
                               [&::-webkit-slider-thumb]:rounded-full
                               [&::-webkit-slider-thumb]:bg-amber-400
                               [&::-webkit-slider-thumb]:cursor-pointer
                               bg-white/[0.08]"
                    style={{
                        background: `linear-gradient(to right, #8B5CF6 ${Math.round(fraction * 100)}%, rgba(255,255,255,0.1) ${Math.round(fraction * 100)}%)`,
                    }}
                />
                {/* Quick preset buttons */}
                <div className="flex gap-1.5 justify-center">
                    {[25, 50, 75, 100].map(pct => (
                        <button
                            key={pct}
                            onClick={() => setFraction(pct / 100)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${Math.round(fraction * 100) === pct
                                ? 'bg-amber-500 text-text-inverse'
                                : 'bg-white/[0.06] text-white/40 hover:text-white/70'
                                }`}
                        >
                            {pct}%
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                    <p className="text-white/30">You receive</p>
                    <p className="font-bold text-warning-bright text-xs mt-0.5">{activeSymbol}{partialValue.toFixed(2)}</p>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-2 text-center">
                    <p className="text-white/30">{isFullCashout ? 'Bet closed' : 'Still active'}</p>
                    <p className={`font-bold text-xs mt-0.5 ${isFullCashout ? 'text-white/30' : 'text-success-bright'}`}>
                        {isFullCashout ? '—' : `${activeSymbol}${restStake.toFixed(2)} stake`}
                    </p>
                </div>
            </div>

            {/* Confirm CTA */}
            <button
                onClick={() => {
                    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
                    doExecute({
                        fraction,
                        clientExpectedValue: partialValue,
                    });
                }}
                className="w-full py-2.5 rounded-xl bg-amber-500 text-text-inverse text-xs font-bold
                           hover:bg-amber-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
                <CheckCircle2 size={14} />
                {isFullCashout
                    ? `Cash Out ${activeSymbol}${partialValue.toFixed(2)}`
                    : `Partial Cash Out ${activeSymbol}${partialValue.toFixed(2)}`}
            </button>

            {error && (
                <p className="text-[11px] text-danger text-center flex items-center justify-center gap-1">
                    <AlertCircle size={10} /> {error}
                </p>
            )}
        </div>
    );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function BetHistoryPage() {
    const [bets, setBets] = useState<Bet[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterStatus>('ALL');
    const [expanded, setExpanded] = useState<string | null>(null);
    const { refreshWallet, activeSymbol } = useWallet();

    const loadBets = useCallback(async () => {
        try {
            const data = await betsApi.getMyBets();
            setBets(data);
        } catch {
            setBets([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadBets(); }, [loadBets]);

    const handleCashoutSuccess = useCallback(async () => {
        await Promise.all([loadBets(), refreshWallet()]);
    }, [loadBets, refreshWallet]);

    const filterKeys: FilterStatus[] = ['ALL', 'PENDING', 'WON', 'LOST', 'CASHED_OUT', 'VOID'];
    const filtered = filter === 'ALL' ? bets : bets.filter(b => b.status === filter);

    const counts: Record<FilterStatus, number> = {
        ALL: bets.length,
        PENDING: bets.filter(b => b.status === 'PENDING').length,
        WON: bets.filter(b => b.status === 'WON').length,
        LOST: bets.filter(b => b.status === 'LOST').length,
        VOID: bets.filter(b => b.status === 'VOID').length,
        CASHED_OUT: bets.filter(b => b.status === 'CASHED_OUT').length,
    };

    const totalPnl = bets.reduce((sum, b) => sum + (getBetNetPnL(b) ?? 0), 0);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <h1 className="text-lg font-bold text-white">Sports Bet History</h1>
                <p className="text-xs text-white/30">All your sports exchange bets</p>
            </div>

            {/* Summary strip */}
            {!loading && bets.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-bg-modal border border-white/[0.06] rounded-xl p-3 text-center">
                        <p className="text-[10px] text-white/30 mb-1">Total Bets</p>
                        <p className="text-base font-bold text-white">{bets.length}</p>
                    </div>
                    <div className="bg-bg-modal border border-white/[0.06] rounded-xl p-3 text-center">
                        <p className="text-[10px] text-white/30 mb-1">Win Rate</p>
                        <p className="text-base font-bold text-success-bright">
                            {counts.WON + counts.LOST > 0
                                ? Math.round((counts.WON / (counts.WON + counts.LOST)) * 100)
                                : 0}%
                        </p>
                    </div>
                    <div className="bg-bg-modal border border-white/[0.06] rounded-xl p-3 text-center">
                        <p className="text-[10px] text-white/30 mb-1">P&amp;L</p>
                        <p className={`text-base font-bold ${totalPnl >= 0 ? 'text-success-bright' : 'text-danger'}`}>
                            {totalPnl >= 0 ? '+' : '-'}{activeSymbol}{Math.abs(totalPnl).toFixed(0)}
                        </p>
                    </div>
                </div>
            )}

            {/* Filter tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {filterKeys.map(s => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === s
                            ? 'bg-brand-gold text-white'
                            : 'bg-bg-modal text-white/40 hover:text-white/60 border border-white/[0.06]'
                            }`}
                    >
                        {s === 'CASHED_OUT' ? 'Cashed Out' : s === 'PENDING' ? 'Accepted' : s}
                        {counts[s] > 0 && <span className="ml-1 opacity-60">{counts[s]}</span>}
                    </button>
                ))}
            </div>

            {/* Bet list */}
            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-bg-modal rounded-xl animate-pulse border border-white/[0.06]" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-bg-modal border border-white/[0.06] flex items-center justify-center mb-3">
                        <TrendingUp size={24} className="text-white/20" />
                    </div>
                    <p className="text-sm font-bold text-white/40">No bets found</p>
                    <p className="text-xs text-white/20 mt-1">Place bets on sports markets to see them here</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(bet => {
                        const cfg = statusConfig[bet.status] ?? statusConfig['VOID'];
                        const isExpanded = expanded === bet.id;
                        const originalStake = getBetOriginalStake(bet);
                        const partialCashoutValue = getBetPartialCashoutValue(bet);
                        const settledReturn = getBetSettledReturn(bet);
                        const pendingMaxReturn = getBetPendingMaxReturn(bet);
                        const betNetPnl = getBetNetPnL(bet);
                        const partialCashoutTaken = hasPartialCashout(bet);
                        const marketName = getDisplayMarketName(bet);
                        const selectionName = getDisplaySelectionName(bet);

                        return (
                            <div
                                key={bet.id}
                                className={`bg-bg-modal border rounded-xl overflow-hidden transition-all ${cfg.border}`}
                            >
                                {/* Main row */}
                                <button
                                    onClick={() => setExpanded(isExpanded ? null : bet.id)}
                                    className="w-full flex items-center gap-3 p-3.5 text-left"
                                >
                                    <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                                        <cfg.icon size={16} className={cfg.color} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-white truncate">{bet.eventName}</p>
                                        <p className="text-[11px] text-white/40 truncate">
                                            {selectionName}{' '}
                                            {isLineBasedFancyMarket({
                                                marketType: bet.gtype,
                                                marketName,
                                                selectionName,
                                            }) ? `· Runs: ${bet.oddsInfo?.acceptedOdds ?? bet.odds}` : `@ ${(bet.oddsInfo?.acceptedOdds ?? bet.odds as number).toFixed(2)}`}
                                            {bet.oddsInfo?.oddsAdjusted && (
                                                <span className="ml-1 text-[9px] text-warning-bright/80">⚡ adjusted</span>
                                            )}
                                        </p>
                                        {partialCashoutTaken && (
                                            <p className="text-[10px] text-warning-bright/75 truncate">
                                                Realized via cash out: {activeSymbol}{partialCashoutValue.toFixed(2)}
                                            </p>
                                        )}
                                    </div>

                                    <div className="text-right flex-shrink-0 mr-1">
                                        <p className="text-[11px] text-white/40">{activeSymbol}{bet.stake}</p>
                                        {bet.status === 'PENDING' && (
                                            <p className="text-[11px] text-warning-bright">
                                                Max {activeSymbol}{pendingMaxReturn.toFixed(0)}
                                            </p>
                                        )}
                                        {bet.status !== 'PENDING' && betNetPnl !== null && (
                                            <p className={`text-xs font-bold ${betNetPnl >= 0 ? cfg.color : 'text-danger'}`}>
                                                {betNetPnl >= 0 ? '+' : '-'}{activeSymbol}{Math.abs(betNetPnl).toFixed(0)}
                                            </p>
                                        )}
                                    </div>

                                    {isExpanded
                                        ? <ChevronUp size={14} className="text-white/20 flex-shrink-0" />
                                        : <ChevronDown size={14} className="text-white/20 flex-shrink-0" />}
                                </button>

                                {/* Cash Out Widget — only for PENDING bets */}
                                {bet.status === 'PENDING' && (
                                    <div className="px-3.5 pb-3">
                                        <CashoutButton bet={bet} onSuccess={handleCashoutSuccess} />
                                    </div>
                                )}

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div className="px-3.5 pb-3.5 pt-3 border-t border-white/[0.04] space-y-3">
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <p className="text-white/30">Bet ID</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <p className="text-white/70 font-mono select-all truncate max-w-[120px]">{bet.id}</p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(bet.id || '');
                                                        }}
                                                        className="text-white/30 hover:text-success-bright transition-colors p-1"
                                                        title="Copy Bet ID"
                                                    >
                                                        <Copy size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-white/30">Market</p>
                                                <p className="text-white/70 font-medium mt-0.5">{marketName}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/30">Selection</p>
                                                <p className="text-white/70 font-medium mt-0.5">{selectionName}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/30">Status</p>
                                                <p className={`font-bold ${cfg.color}`}>{cfg.label}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/30">{partialCashoutTaken ? 'Remaining Stake' : 'Stake'}</p>
                                                <p className="text-white/70 font-medium">{activeSymbol}{bet.stake}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/30">
                                                    {bet.status === 'PENDING' ? 'Current Max Return' : 'Total Returned'}
                                                </p>
                                                <p className="text-white/70 font-medium">
                                                    {activeSymbol}{(bet.status === 'PENDING'
                                                        ? pendingMaxReturn
                                                        : (settledReturn ?? bet.potentialWin)
                                                    ).toFixed(2)}
                                                </p>
                                            </div>
                                            {partialCashoutTaken && (
                                                <div>
                                                    <p className="text-white/30">Original Stake</p>
                                                    <p className="text-white/70 font-medium">{activeSymbol}{originalStake.toFixed(2)}</p>
                                                </div>
                                            )}
                                            {partialCashoutTaken && (
                                                <div>
                                                    <p className="text-white/30">Realized Cash Out</p>
                                                    <p className="text-warning-bright font-medium">{activeSymbol}{partialCashoutValue.toFixed(2)}</p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-white/30">Placed</p>
                                                <p className="text-white/70 font-medium">
                                                    {new Date(bet.createdAt).toLocaleString('en-US', {
                                                        day: '2-digit', month: 'short',
                                                        hour: '2-digit', minute: '2-digit',
                                                    })}
                                                </p>
                                            </div>
                                            {bet.oddsInfo && (
                                                <div>
                                                    <p className="text-white/30">Accepted Odds</p>
                                                    <p className="text-warning-bright font-mono font-bold">
                                                        {(bet.oddsInfo.acceptedOdds).toFixed(2)}
                                                    </p>
                                                </div>
                                            )}
                                            {bet.oddsInfo?.oddsAdjusted && bet.oddsInfo.submittedOdds != null && (
                                                <div>
                                                    <p className="text-white/30">Submitted Odds</p>
                                                    <p className="text-warning/80 font-mono text-xs">
                                                        {bet.oddsInfo.submittedOdds.toFixed(2)}
                                                        <span className="ml-1 text-[9px] text-warning/60">⚡ price moved</span>
                                                    </p>
                                                </div>
                                            )}
                                            {/* Stake → Profit → Return */}
                                            {bet.oddsInfo && (
                                                <div className="col-span-2">
                                                    <p className="text-white/30 mb-1">Stake → Profit → Total Return</p>
                                                    <p className="font-mono text-xs">
                                                        <span className="text-white/70">{bet.stake}</span>
                                                        <span className="text-white/20 mx-1.5">→</span>
                                                        <span className="text-success-bright">
                                                            +{((bet.oddsInfo.acceptedOdds - 1) * bet.stake).toFixed(2)}
                                                        </span>
                                                        <span className="text-white/20 mx-1.5">→</span>
                                                        <span className="text-brand-gold">
                                                            {(bet.oddsInfo.acceptedOdds * bet.stake).toFixed(2)}
                                                        </span>
                                                    </p>
                                                </div>
                                            )}
                                            {bet.status === 'CASHED_OUT' && bet.cashedOutAt && (
                                                <div className="col-span-2">
                                                    <p className="text-white/30">Cashed Out At</p>
                                                    <p className="text-white/70 font-medium">
                                                        {new Date(bet.cashedOutAt).toLocaleString('en-US', {
                                                            day: '2-digit', month: 'short',
                                                            hour: '2-digit', minute: '2-digit',
                                                        })}
                                                    </p>
                                                </div>
                                            )}
                                            {partialCashoutTaken && bet.lastPartialCashoutAt && bet.status !== 'CASHED_OUT' && (
                                                <div className="col-span-2">
                                                    <p className="text-white/30">Last Partial Cash Out</p>
                                                    <p className="text-white/70 font-medium">
                                                        {new Date(bet.lastPartialCashoutAt).toLocaleString('en-US', {
                                                            day: '2-digit', month: 'short',
                                                            hour: '2-digit', minute: '2-digit',
                                                        })}
                                                    </p>
                                                </div>
                                            )}
                                            {bet.settledReason && (
                                                <div className="col-span-2">
                                                    <p className="text-white/30">Settlement Note</p>
                                                    <p className="text-white/70 leading-relaxed">{bet.settledReason}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
